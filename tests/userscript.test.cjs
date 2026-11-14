const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../userscript/chatgpt-answer-notifier.user.js'), 'utf8');

function loadNotifier(t, { manager = 'success', permission = 'denied', blockedAudio = false } = {}) {
  const menus = new Map();
  const managerCalls = [];
  const nativeCalls = [];
  const notes = [];
  const gains = [];
  const timeouts = new Set();
  const intervals = new Set();
  const events = new Map();
  const stats = { permissionRequests: 0, focusCalls: 0 };
  let resourceObserver;
  let releaseAudio;
  let onNotification = () => {};

  class Element {
    constructor(role = '', text = '') {
      this.role = role;
      this.textContent = text;
      this.children = [];
      this.style = {};
      this.parentElement = null;
    }
    getAttribute(name) { return name === 'data-turn' ? this.role : ''; }
    setAttribute() {}
    matches(selector) { return selector.includes(`"${this.role}"`); }
    querySelector() { return this.role === 'assistant' ? { textContent: this.textContent } : null; }
    closest() { return root; }
    append(...children) {
      children.forEach(child => { child.parentElement = this; this.children.push(child); });
    }
    remove() {
      if (this.parentElement) {
        this.parentElement.children = this.parentElement.children.filter(child => child !== this);
      }
    }
    addEventListener() {}
  }
  const root = new Element();
  const turns = [new Element('user', 'Question'), new Element('assistant', 'The finished answer.')];
  const document = {
    title: 'Example conversation - ChatGPT',
    visibilityState: 'hidden',
    hasFocus: () => false,
    body: root,
    documentElement: root,
    addEventListener(name, callback) { events.set(name, callback); },
    querySelector: () => root,
    querySelectorAll(selector) {
      return selector.includes('conversation-turn-') ? turns : [];
    },
    createElement: () => new Element(),
    getElementById(id) { return root.children.find(child => child.id === id); }
  };
  class AudioContext {
    constructor() {
      this.currentTime = 10;
      this.destination = {};
      this.state = blockedAudio ? 'suspended' : 'running';
    }
    resume() {
      if (!blockedAudio) { this.state = 'running'; return Promise.resolve(); }
      return new Promise(resolve => {
        releaseAudio = () => { this.state = 'running'; resolve(); };
      });
    }
    createGain() {
      const values = [];
      const node = {
        values,
        disconnected: false,
        gain: {
          setValueAtTime: (value, time) => values.push({ value, time }),
          linearRampToValueAtTime: (value, time) => values.push({ value, time }),
          exponentialRampToValueAtTime: (value, time) => values.push({ value, time })
        },
        connect() {},
        disconnect() { this.disconnected = true; }
      };
      gains.push(node);
      return node;
    }
    createOscillator() {
      const note = {
        frequency: { setValueAtTime: value => { note.pitch = value; } },
        connect() {},
        disconnect() { this.disconnected = true; },
        start(time) { this.startAt = time; },
        stop(time) { this.stopAt = time; }
      };
      notes.push(note);
      return note;
    }
  }
  class Notification {
    static permission = permission;
    static requestPermission() { stats.permissionRequests += 1; return Promise.resolve(permission); }
    constructor(title, details) {
      this.title = title;
      this.details = details;
      nativeCalls.push(this);
      onNotification();
    }
    close() { this.closed = true; }
  }
  const page = { AudioContext, Notification, focus: () => { stats.focusCalls += 1; } };
  const context = {
    document,
    window: page,
    unsafeWindow: page,
    Element,
    URL,
    location: { href: 'https://chatgpt.com/c/example', pathname: '/c/example' },
    console: { debug() {}, info() {}, warn() {}, error() {} },
    performance: {
      now: () => performance.now(),
      timeOrigin: performance.timeOrigin,
      setResourceTimingBufferSize() {},
      clearResourceTimings() {},
      getEntriesByType: () => []
    },
    PerformanceObserver: class {
      constructor(callback) { resourceObserver = callback; }
      observe() {}
    },
    MutationObserver: class { observe() {} disconnect() {} },
    GM_registerMenuCommand: (name, callback) => menus.set(name, callback),
    setTimeout(callback, delay) {
      const id = setTimeout(() => { timeouts.delete(id); callback(); }, delay);
      timeouts.add(id);
      return id;
    },
    clearTimeout(id) { clearTimeout(id); timeouts.delete(id); },
    setInterval(callback, delay) {
      const id = setInterval(callback, delay);
      intervals.add(id);
      return id;
    },
    clearInterval(id) { clearInterval(id); intervals.delete(id); }
  };
  // A userscript manager exposes this API only when its grant is declared.
  if (manager !== 'missing' && /@grant\s+GM_notification\s/.test(source)) {
    context.GM_notification = details => {
      managerCalls.push(details);
      if (manager === 'throw') throw new Error('Notification API unavailable');
      if (manager === 'reject') return Promise.reject(new Error('Notification request rejected'));
      onNotification();
      if (manager === 'pending') return new Promise(() => {});
      return undefined; // Tampermonkey's synchronous API returns no handle.
    };
  }
  t.after(() => {
    timeouts.forEach(clearTimeout);
    intervals.forEach(clearInterval);
  });
  vm.runInNewContext(source, context, { filename: 'chatgpt-answer-notifier.user.js' });
  return {
    managerCalls, nativeCalls, notes, gains, stats, root, document,
    alert: () => menus.get('Test sound + notification')(),
    releaseAudio: () => releaseAudio(),
    nextNotification: () => new Promise(resolve => { onNotification = resolve; }),
    completeResponse: () => resourceObserver({ getEntries: () => [{
      entryType: 'resource',
      name: 'https://chatgpt.com/backend-api/f/conversation',
      initiatorType: 'fetch',
      responseStatus: 200,
      startTime: 10,
      responseEnd: 1000
    }] })
  };
}

test('desktop alerts use the manager even when website permission is denied and the tab is hidden', async t => {
  const notifier = loadNotifier(t);
  await notifier.alert();
  assert.equal(notifier.managerCalls.length, 1);
  assert.equal(notifier.nativeCalls.length, 0);
  assert.equal(notifier.stats.permissionRequests, 0);
  assert.equal(notifier.managerCalls[0].silent, true);
});

test('a completed background response delivers both the chime and answer notification', async t => {
  const notifier = loadNotifier(t);
  const delivered = notifier.nextNotification();
  notifier.completeResponse();
  await delivered;
  assert.equal(notifier.managerCalls.length, 1);
  assert.equal(notifier.managerCalls[0].title, 'Example conversation');
  assert.equal(notifier.managerCalls[0].text, 'The finished answer.');
  assert.ok(notifier.notes.length > 0);
});

test('the alert has sustained loud notes in repeated bursts and releases its audio nodes', async t => {
  const notifier = loadNotifier(t);
  await notifier.alert();
  assert.ok(notifier.notes.length >= 6);
  const duration = Math.max(...notifier.notes.map(note => note.stopAt)) - Math.min(...notifier.notes.map(note => note.startAt));
  assert.ok(duration >= 1.5 && duration <= 3, 'Alert should be noticeable but finite');
  for (const gain of notifier.gains) {
    const peak = Math.max(...gain.values.map(event => event.value));
    assert.ok(peak >= 0.6 && peak <= 1, 'Each note should be louder without exceeding full scale');
  }
  notifier.notes.forEach(note => note.onended());
  assert.ok(notifier.notes.every(note => note.disconnected));
  assert.ok(notifier.gains.every(gain => gain.disconnected));
});

test('a failed manager request falls back to an already-permitted website notification', async t => {
  const notifier = loadNotifier(t, { manager: 'throw', permission: 'granted' });
  await notifier.alert();
  assert.equal(notifier.nativeCalls.length, 1);
  assert.equal(notifier.stats.permissionRequests, 0);
  notifier.nativeCalls[0].onclick();
  assert.equal(notifier.stats.focusCalls, 1);
  assert.equal(notifier.nativeCalls[0].closed, true);
});

test('asynchronous manager failures also use the native fallback', async t => {
  const notifier = loadNotifier(t, { manager: 'reject', permission: 'granted' });
  await notifier.alert();
  await Promise.resolve();
  assert.equal(notifier.nativeCalls.length, 1);
});

test('unavailable desktop channels produce an actionable on-page warning', async t => {
  const notifier = loadNotifier(t, { manager: 'missing' });
  await notifier.alert();
  assert.equal(notifier.nativeCalls.length, 0);
  assert.equal(notifier.stats.permissionRequests, 0);
  const notice = notifier.document.getElementById('chatgpt-notifier-warning');
  assert.ok(notice);
  assert.match(notice.children[0].textContent, /userscript manager/);
});

test('blocked audio cannot hold up notifications or play a stale alert after later resuming', async t => {
  const notifier = loadNotifier(t, { blockedAudio: true });
  await notifier.alert();
  assert.equal(notifier.managerCalls.length, 1);
  assert.equal(notifier.managerCalls[0].silent, false);
  assert.equal(notifier.notes.length, 0);
  notifier.releaseAudio();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(notifier.notes.length, 0);
});

test('a manager promise that waits for dismissal does not block completion handling', async t => {
  const notifier = loadNotifier(t, { manager: 'pending' });
  await notifier.alert();
  assert.equal(notifier.managerCalls.length, 1);
});
