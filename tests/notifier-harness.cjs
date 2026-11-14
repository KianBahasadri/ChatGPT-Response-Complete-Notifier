const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../userscript/chatgpt-answer-notifier.user.js'), 'utf8');

class Clock {
  constructor() { this.time = 0; this.epoch = 1800000000000; this.jobs = new Map(); this.nextId = 1; }
  now() { return this.epoch + this.time; }
  add(callback, delay, interval = false) {
    const id = this.nextId++;
    this.jobs.set(id, { callback, at: this.time + delay, interval: interval ? delay : 0 });
    return id;
  }
  clear(id) { this.jobs.delete(id); }
  async flush() { for (let i = 0; i < 24; i += 1) await Promise.resolve(); }
  async tick(milliseconds) {
    const target = this.time + milliseconds;
    await this.flush();
    for (let count = 0; count < 10000; count += 1) {
      let next;
      for (const [id, job] of this.jobs) {
        if (job.at <= target && (!next || job.at < next.job.at)) next = { id, job };
      }
      if (!next) { this.time = target; await this.flush(); return; }
      this.time = next.job.at;
      if (next.job.interval) next.job.at += next.job.interval;
      else this.jobs.delete(next.id);
      next.job.callback();
      await this.flush();
    }
    throw new Error('Timer loop exceeded the test budget');
  }
}

class MemoryStorage {
  constructor() { this.items = new Map(); }
  getItem(key) { return this.items.get(key) ?? null; }
  setItem(key, value) { this.items.set(key, String(value)); }
}

function sharedLocks() {
  const queues = new Map();
  return {
    request(name, callback) {
      const next = (queues.get(name) || Promise.resolve()).then(callback);
      queues.set(name, next.catch(() => {}));
      return next;
    }
  };
}

function loadNotifier(t, options = {}) {
  const { manager = 'success', permission = 'denied', blockedAudio = false } = options;
  const clock = options.clock || new Clock();
  const session = options.session || new MemoryStorage();
  const local = options.local || new MemoryStorage();
  const view = {
    context: '/c/example', userId: 'user-1', userText: 'Question', answerId: 'answer-1',
    answer: 'The finished answer.', busy: false, error: false, streaming: false,
    visibility: 'hidden', readyState: 'complete', ...options.view
  };
  const menus = new Map();
  const managerCalls = [], nativeCalls = [], notes = [], gains = [];
  const timeouts = new Set(), intervals = new Set();
  const events = new Map(), windowEvents = new Map();
  const stats = { permissionRequests: 0, focusCalls: 0, timingClears: 0 };
  let resourceObserver, mutationObserver, releaseAudio;
  let onNotification = () => {};
  let closed = false;

  function listen(map, name, callback) {
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(callback);
  }
  function fire(map, name, event = {}) { for (const callback of map.get(name) || []) callback(event); }
  class Element {
    constructor(role = '', text = '', id = '') {
      this.role = role; this.textContent = text; this.id = id;
      this.children = []; this.style = {}; this.parentElement = null;
      this.attributes = new Map();
    }
    getAttribute(name) {
      if (this.attributes.has(name)) return this.attributes.get(name);
      if (name === 'data-turn') return this.role;
      if (name === 'data-message-id') return this.messageId || '';
      return '';
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getClientRects() { return this.hidden ? [] : [{}]; }
    matches(selector) { return Boolean(this.role && selector.includes(`"${this.role}"`)); }
    querySelector(selector) {
      if (selector.includes('data-message-id')) return null;
      if (selector.includes('error-message')) return view.error ? {} : null;
      if (selector.includes('data-is-streaming')) return view.streaming ? {} : null;
      if (selector.includes('markdown') || selector.includes('prose')) {
        return this.role === 'assistant' ? { textContent: this.textContent } : null;
      }
      return null;
    }
    closest(selector) { return this.isStop && selector.includes('stop') ? this : null; }
    append(...children) { children.forEach(child => { child.parentElement = this; this.children.push(child); }); }
    remove() {
      if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this);
    }
    addEventListener() {}
  }
  const root = new Element();
  const stop = new Element(); stop.isStop = true;
  const document = {
    title: 'Example conversation - ChatGPT',
    get visibilityState() { return view.visibility; },
    get readyState() { return view.readyState; },
    hasFocus: () => view.visibility === 'visible',
    body: root, documentElement: root,
    addEventListener: (name, callback) => listen(events, name, callback),
    querySelector: () => root,
    querySelectorAll(selector) {
      if (selector.includes('conversation-turn-')) {
        if (view.userText === null) return [];
        const user = new Element('user', view.userText); user.messageId = view.userId;
        const assistant = new Element('assistant', view.answer); assistant.messageId = view.answerId;
        return view.answer === null ? [user] : [user, assistant];
      }
      if (selector.includes('stop-button')) {
        stop.hidden = Boolean(view.hiddenStop);
        return view.busy ? [stop] : [];
      }
      return [];
    },
    createElement: () => new Element(),
    getElementById: id => root.children.find(child => child.id === id)
  };
  class AudioContext {
    constructor() { this.currentTime = 10; this.destination = {}; this.state = blockedAudio ? 'suspended' : 'running'; }
    resume() {
      if (!blockedAudio) { this.state = 'running'; return Promise.resolve(); }
      return new Promise(resolve => { releaseAudio = () => { this.state = 'running'; resolve(); }; });
    }
    close() { this.state = 'closed'; return Promise.resolve(); }
    createGain() {
      const values = [];
      const node = {
        values, disconnected: false,
        gain: {
          setValueAtTime: (value, time) => values.push({ value, time }),
          linearRampToValueAtTime: (value, time) => values.push({ value, time }),
          exponentialRampToValueAtTime: (value, time) => values.push({ value, time })
        },
        connect() {}, disconnect() { this.disconnected = true; }
      };
      gains.push(node); return node;
    }
    createOscillator() {
      const note = {
        frequency: { setValueAtTime: value => { note.pitch = value; } },
        connect() {}, disconnect() { this.disconnected = true; },
        start(time) { this.startAt = time; }, stop(time) { this.stopAt = time; }
      };
      notes.push(note); return note;
    }
  }
  class Notification {
    static permission = permission;
    static requestPermission() { stats.permissionRequests += 1; return Promise.resolve(permission); }
    constructor(title, details) { this.title = title; this.details = details; nativeCalls.push(this); onNotification(); }
    close() { this.closed = true; }
  }
  const page = {
    AudioContext, Notification, sessionStorage: session, localStorage: local,
    navigator: { locks: options.locks },
    focus: () => { stats.focusCalls += 1; },
    addEventListener: (name, callback) => listen(windowEvents, name, callback)
  };
  const location = { pathname: view.context, href: 'https://chatgpt.com' + view.context };
  const context = {
    document, window: page, unsafeWindow: page, Element, URL, location,
    Date: class extends Date { static now() { return clock.now(); } },
    console: { debug() {}, info() {}, warn() {}, error() {} },
    performance: {
      now: () => clock.time, timeOrigin: clock.epoch,
      clearResourceTimings() { stats.timingClears += 1; },
      getEntriesByType: () => [], setResourceTimingBufferSize() {}
    },
    PerformanceObserver: class {
      constructor(callback) { this.callback = callback; resourceObserver = this; }
      observe(config) { this.config = config; }
      disconnect() { this.disconnected = true; }
    },
    MutationObserver: class {
      constructor(callback) { this.callback = callback; mutationObserver = this; }
      observe() { this.disconnected = false; }
      disconnect() { this.disconnected = true; }
    },
    GM_registerMenuCommand: (name, callback) => menus.set(name, callback),
    setTimeout(callback, delay) {
      const id = clock.add(() => { timeouts.delete(id); callback(); }, delay); timeouts.add(id); return id;
    },
    clearTimeout(id) { clock.clear(id); timeouts.delete(id); },
    setInterval(callback, delay) { const id = clock.add(callback, delay, true); intervals.add(id); return id; },
    clearInterval(id) { clock.clear(id); intervals.delete(id); }
  };
  if (manager !== 'missing' && /@grant\s+GM_notification\s/.test(source)) {
    context.GM_notification = details => {
      managerCalls.push(details);
      if (manager === 'throw') throw new Error('Notification API unavailable');
      if (manager === 'reject') return Promise.reject(new Error('Notification request rejected'));
      onNotification();
      return manager === 'pending' ? new Promise(() => {}) : undefined;
    };
  }
  if (options.networkAvailable === false) context.PerformanceObserver = undefined;
  if (options.mutationsAvailable === false) context.MutationObserver = undefined;
  function close() {
    if (closed) return;
    fire(windowEvents, 'pagehide'); closed = true;
    timeouts.forEach(id => clock.clear(id)); intervals.forEach(id => clock.clear(id));
  }
  t.after(close);
  vm.runInNewContext(source, context, { filename: 'chatgpt-answer-notifier.user.js' });
  return {
    managerCalls, nativeCalls, notes, gains, stats, root, document, view, clock, session, local, page,
    advance: milliseconds => clock.tick(milliseconds),
    async alert() { const done = menus.get('Test sound + notification')(); await clock.tick(300); await done; },
    releaseAudio: () => releaseAudio(),
    nextNotification: () => new Promise(resolve => { onNotification = resolve; }),
    setView(patch) {
      Object.assign(view, patch);
      location.pathname = view.context; location.href = 'https://chatgpt.com' + view.context;
      if (mutationObserver && !mutationObserver.disconnected) mutationObserver.callback([]);
    },
    stop() { fire(events, 'click', { target: stop }); },
    show() { view.visibility = 'visible'; fire(events, 'visibilitychange'); },
    restore() { closed = false; fire(windowEvents, 'pageshow', { persisted: true }); },
    close,
    resourceConfig: () => resourceObserver?.config,
    completeResponse(overrides = {}) {
      if (!resourceObserver || resourceObserver.disconnected) return;
      resourceObserver.callback({ getEntries: () => [{
        entryType: 'resource', name: 'https://chatgpt.com/backend-api/f/conversation',
        initiatorType: 'fetch', responseStatus: 200, startTime: clock.time,
        responseEnd: clock.time + 1, ...overrides
      }] });
    }
  };
}

module.exports = { Clock, MemoryStorage, sharedLocks, loadNotifier };
