// ==UserScript==
// @name         ChatGPT Prompt-Bound Completion Alert
// @namespace    https://github.com/KianBahasadri/ChatGPT-Response-Complete-Notifier
// @version      1.3.0
// @description  Loud completion alerts with reload recovery, DOM monitoring, and duplicate suppression.
// @author       Local
// @homepageURL  https://github.com/KianBahasadri/ChatGPT-Response-Complete-Notifier
// @supportURL   https://github.com/KianBahasadri/ChatGPT-Response-Complete-Notifier/issues
// @updateURL    https://raw.githubusercontent.com/KianBahasadri/ChatGPT-Response-Complete-Notifier/main/userscript/chatgpt-answer-notifier.meta.js
// @downloadURL  https://raw.githubusercontent.com/KianBahasadri/ChatGPT-Response-Complete-Notifier/main/userscript/chatgpt-answer-notifier.user.js
// @license      AGPL-3.0-or-later
// @icon         data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAADR0lEQVR4nO2dXXIiMQwGzdYeYS7B/Q/DcbJPVLEkBHuQ9fd1PxPiSG3J9jg1l+M4vgbI8id6ABALAoiDAOIggDgIIA4CiIMA4iCAOAggDgKIgwDiIIA4CCAOAoiDAOL8jR7AGGPcbrfoIYRwvV6jhzAuURdCVJP+iigZ3AUg8b/jLYKbACR+DS8RXBaBJH8dr5htrQAk3oad1WBbBSD5duyM5RYBSL49u2Ka4hxgjBx7Yk+yTBLzNcDKH6aW9FdExsy0BZD8c6zEwrpyuLcAEv8z97h4twazCjAzcJL/npkYWUrC00BxTARg9tviWQVcKgDJX6fVswDIy8cCZDnQUMQi9tsrAOX/PB6xS3MU7MW7WaMmrIQAK6Xy8bMKMrQW4NMeef/5ziK0FMB6YdpZhHbbwJ27ko47nlYCeCSomwRtBPBMTCcJWggQkZAuEpQXIDIRHSQovQs4m4BXq/kz33e73UrvDkoLsMq7REXdyomkbAtYvX+4MktXP19ZmJICeF0+VZCgpACzWPTmyv19hnICzM40y8TNflfFKlBOALClpQA7ynbXVlBKgAoltsIYHyklwAw7Z2rHKtBOAFgDAcQpI0Cl3lpprGUEmMGjR3dbB7QSANZBAHHSPg6u1Ed/4nn8WVsHFUCctBVghqhZ9fx7K1crKoA4CCAOAoiDAOIggDgIIA4CiIMA4iCAOAggDgKIgwDiIIA4CCAOAoiDAOKUvhBS+SJGFqgA4iCAOAggDgKIk3YRWP3mbdb/A3iGCiAOAoiDAOKkXQM8Y9FTebv5d6gA4iCAOAggDgKIIyXA7MJOZQE4hoMA2U7wZl8akQGP2H0sQKaAzfJqzNX+FovxljkHsKZasnfhsgbI1gYq4BUzEwFmZhMSzDMTK6sKJrULgO+YCUAVsMFz9o8RsAjs/Cr2T4iaHKYtQOE1azuIfEp5OY7jy/Qbx7nkqlWELDFKcw5ARYhhyy5AbTZ7sCum27aBSGDHzlhuWQM8Q3k/h8ckcjkIohqs4xUzlwrwCNXgd7wni7sAdxDhf6KqZJgAj6jKkKE1phAA4uBpoDgIIA4CiIMA4iCAOAggDgKIgwDiIIA4CCAOAoiDAOIggDgIIA4CiPMPMxH82wgo8LsAAAAASUVORK5CYII=
// @match        https://chatgpt.com/*
// @run-at       document-start
// @sandbox      JavaScript
// @grant        unsafeWindow
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @grant        window.focus
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  const VERSION = '1.3.0';
  const CHIME_VOLUME = 0.70;
  const RESPONSE_PREVIEW_MAX_CHARS = 260;
  const STOP_BUTTON_SELECTOR = 'button[data-testid="stop-button"], button[data-testid="fruitjuice-stop-button"], button[aria-label="Stop streaming"], button[aria-label="Stop generating"]';
  const PAGE = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  let audioContext = null;
  let notificationChannel = 'not requested';
  const log = (...args) => console.debug('[ChatGPT Completion Alert]', ...args);
  const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
  const NOTIFICATION_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAADR0lEQVR4nO2dXXIiMQwGzdYeYS7B/Q/DcbJPVLEkBHuQ9fd1PxPiSG3J9jg1l+M4vgbI8id6ABALAoiDAOIggDgIIA4CiIMA4iCAOAggDgKIgwDiIIA4CCAOAoiDAOL8jR7AGGPcbrfoIYRwvV6jhzAuURdCVJP+iigZ3AUg8b/jLYKbACR+DS8RXBaBJH8dr5htrQAk3oad1WBbBSD5duyM5RYBSL49u2Ka4hxgjBx7Yk+yTBLzNcDKH6aW9FdExsy0BZD8c6zEwrpyuLcAEv8z97h4twazCjAzcJL/npkYWUrC00BxTARg9tviWQVcKgDJX6fVswDIy8cCZDnQUMQi9tsrAOX/PB6xS3MU7MW7WaMmrIQAK6Xy8bMKMrQW4NMeef/5ziK0FMB6YdpZhHbbwJ27ko47nlYCeCSomwRtBPBMTCcJWggQkZAuEpQXIDIRHSQovQs4m4BXq/kz33e73UrvDkoLsMq7REXdyomkbAtYvX+4MktXP19ZmJICeF0+VZCgpACzWPTmyv19hnICzM40y8TNflfFKlBOALClpQA7ynbXVlBKgAoltsIYHyklwAw7Z2rHKtBOAFgDAcQpI0Cl3lpprGUEmMGjR3dbB7QSANZBAHHSPg6u1Ed/4nn8WVsHFUCctBVghqhZ9fx7K1crKoA4CCAOAoiDAOIggDgIIA4CiIMA4iCAOAggDgKIgwDiIIA4CCAOAoiDAOKUvhBS+SJGFqgA4iCAOAggDgKIk3YRWP3mbdb/A3iGCiAOAoiDAOKkXQM8Y9FTebv5d6gA4iCAOAggDgKIIyXA7MJOZQE4hoMA2U7wZl8akQGP2H0sQKaAzfJqzNX+FovxljkHsKZasnfhsgbI1gYq4BUzEwFmZhMSzDMTK6sKJrULgO+YCUAVsMFz9o8RsAjs/Cr2T4iaHKYtQOE1azuIfEp5OY7jy/Qbx7nkqlWELDFKcw5ARYhhyy5AbTZ7sCum27aBSGDHzlhuWQM8Q3k/h8ckcjkIohqs4xUzlwrwCNXgd7wni7sAdxDhf6KqZJgAj6jKkKE1phAA4uBpoDgIIA4CiIMA4iCAOAggDgKIgwDiIIA4CCAOAoiDAOIggDgIIA4CiPMPMxH82wgo8LsAAAAASUVORK5CYII=';

  function cleanSessionTitle(rawTitle) {
    const raw = normalize(rawTitle);
    if (!raw) return 'ChatGPT';
    const cleaned = raw
      .replace(/\s*[-|\u2013\u2014]\s*ChatGPT\s*$/i, '')
      .replace(/^ChatGPT\s*[-|\u2013\u2014]\s*/i, '')
      .trim();
    return cleaned && cleaned.toLowerCase() !== 'chatgpt' ? cleaned : 'ChatGPT';
  }

  function truncateResponse(text, maxChars = RESPONSE_PREVIEW_MAX_CHARS) {
    const normalized = normalize(text);
    if (!normalized) return 'Response finished.';
    if (normalized.length <= maxChars) return normalized;
    const slice = normalized.slice(0, Math.max(1, maxChars - 3));
    const lastSpace = slice.lastIndexOf(' ');
    const safeCut = lastSpace >= Math.floor(maxChars * 0.7) ? slice.slice(0, lastSpace) : slice;
    return `${safeCut.trimEnd()}...`;
  }

  function turnNodes() {
    try {
      const turns = Array.from(document.querySelectorAll('[data-testid^="conversation-turn-"]'));
      if (turns.length > 0) return turns;
      const fallbackTurns = Array.from(document.querySelectorAll('[data-chatgpt-search-unit-key*="fallback-turn-"]'));
      if (fallbackTurns.length > 0) return fallbackTurns;
      return Array.from(document.querySelectorAll(
        '[data-message-author-role="user"], [data-message-author-role="assistant"]'
      ));
    } catch {
      return [];
    }
  }

  function roleOf(turn) {
    if (!turn) return '';
    try {
      const key = turn.getAttribute('data-chatgpt-search-unit-key') || '';
      const direct = normalize(
        turn.getAttribute('data-turn') ||
        turn.getAttribute('data-message-author-role') ||
        turn.getAttribute('data-conversation-role') ||
        (key.match(/:(user|assistant)$/) || [])[1] || ''
      ).toLowerCase();
      if (direct === 'user' || direct === 'assistant') return direct;
      if (turn.querySelector('[data-message-author-role="user"], [data-conversation-role="user"]')) return 'user';
      if (turn.querySelector('[data-message-author-role="assistant"], [data-conversation-role="assistant"]')) return 'assistant';
    } catch {}
    return '';
  }

  function assistantText(turn) {
    if (!turn) return '';
    try {
      const roleNode = turn.matches?.('[data-message-author-role="assistant"]')
        ? turn
        : turn.querySelector('[data-message-author-role="assistant"]') || turn;
      const rendered = roleNode.querySelector(
        '[data-markdown-text-style="assistant-message"], .markdown, [class*="prose"], [data-message-content], [class*="whitespace-pre-wrap"]'
      );
      const renderedText = rendered?.textContent || rendered?.innerText || '';
      return normalize(renderedText || roleNode.textContent || roleNode.innerText || '');
    } catch {
      return '';
    }
  }

  function getAudioContext() {
    if (audioContext?.state === 'closed') audioContext = null;
    if (audioContext) return audioContext;
    const Ctor = PAGE.AudioContext || PAGE.webkitAudioContext;
    if (!Ctor) return null;
    try {
      audioContext = new Ctor();
      return audioContext;
    } catch {
      return null;
    }
  }

  async function unlockAudio() {
    const ctx = getAudioContext();
    if (!ctx) return false;
    try {
      if (ctx.state === 'suspended') await ctx.resume();
      return ctx.state === 'running';
    } catch {
      return false;
    }
  }

  async function playCompletionChime(deadline = Number.POSITIVE_INFINITY, valid = () => true) {
    const ctx = getAudioContext();
    if (!ctx) return false;
    try {
      if (ctx.state === 'suspended') await ctx.resume();
      if (ctx.state !== 'running' || performance.now() > deadline || !valid()) return false;
      const now = ctx.currentTime + 0.01;
      const pitches = [880, 1174.66, 1567.98];

      // Two ascending three-note bursts. Give each note its own envelope so
      // the later notes remain just as audible as the first.
      for (let repeat = 0; repeat < 2; repeat += 1) {
        pitches.forEach((pitch, index) => {
          const start = now + repeat * 1.05 + index * 0.26;
          const oscillator = ctx.createOscillator();
          const gain = ctx.createGain();
          oscillator.type = 'triangle';
          oscillator.frequency.setValueAtTime(pitch, start);
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.linearRampToValueAtTime(CHIME_VOLUME, start + 0.008);
          gain.gain.setValueAtTime(CHIME_VOLUME, start + 0.16);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
          oscillator.connect(gain);
          gain.connect(ctx.destination);
          oscillator.onended = () => {
            oscillator.disconnect();
            gain.disconnect();
          };
          oscillator.start(start);
          oscillator.stop(start + 0.23);
        });
      }
      return true;
    } catch (error) {
      log('Custom sound failed:', error);
      return false;
    }
  }

  document.addEventListener('pointerdown', () => {
    unlockAudio().catch(() => {});
    if (typeof GM_notification !== 'function' && pageIsActive()) {
      ensureNativeNotificationPermission().catch(() => {});
    }
  }, { capture: true, passive: true });
  document.addEventListener('keydown', () => {
    unlockAudio().catch(() => {});
    if (typeof GM_notification !== 'function' && pageIsActive()) {
      ensureNativeNotificationPermission().catch(() => {});
    }
  }, { capture: true, passive: true });

  function isStopButton(node) {
    if (!(node instanceof Element)) return false;
    return Boolean(node.closest(STOP_BUTTON_SELECTOR));
  }

  function isElementVisible(node) {
    if (!node) return false;
    try {
      // A stop button kept mounted but display:none must not count as
      // "generating", otherwise completion would never be detected.
      return typeof node.getClientRects !== 'function' || node.getClientRects().length > 0;
    } catch {
      return true;
    }
  }

  function isGenerating() {
    try {
      const stopButtons = document.querySelectorAll(STOP_BUTTON_SELECTOR);
      for (const button of stopButtons) {
        if (isElementVisible(button)) return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  function pageIsActive() {
    try {
      return document.visibilityState === 'visible' && document.hasFocus();
    } catch {
      return document.visibilityState === 'visible';
    }
  }

  async function playCompletionChimeWithFallback(valid = () => true) {
    const deadline = performance.now() + 250;
    let timeoutId;
    try {
      return await Promise.race([
        playCompletionChime(deadline, valid),
        new Promise((resolve) => { timeoutId = setTimeout(() => resolve(false), 250); })
      ]);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function ensureNativeNotificationPermission() {
    const NotificationConstructor = PAGE.Notification;
    if (typeof NotificationConstructor !== 'function') return false;
    if (NotificationConstructor.permission === 'default') {
      try {
        return await NotificationConstructor.requestPermission() === 'granted';
      } catch {
        return false;
      }
    }
    return NotificationConstructor.permission === 'granted';
  }

  function createNativeNotification({ title, text, silent }) {
    // Permission prompts need a user gesture, so never ask during completion.
    // The interaction listeners above arm this fallback only when needed.
    const NotificationConstructor = PAGE.Notification;
    if (typeof NotificationConstructor !== 'function' || NotificationConstructor.permission !== 'granted') {
      return null;
    }
    try {
      const notification = new NotificationConstructor(title, {
        body: text,
        icon: NOTIFICATION_ICON,
        silent,
        requireInteraction: true
      });
      notification.onclick = () => {
        try { window.focus(); } catch {}
        notification.close();
      };
      notification.onerror = reportNotificationFailure;
      return notification;
    } catch (error) {
      log('Website notification failed:', error);
      return null;
    }
  }

  function reportNotificationFailure() {
    notificationChannel = 'unavailable';
    console.warn('[ChatGPT Prompt-Bound Alert] Desktop notification unavailable; check userscript-manager and OS notification permissions.');
    if (!document.body || document.getElementById('chatgpt-notifier-warning')) return;
    const notice = document.createElement('div');
    notice.id = 'chatgpt-notifier-warning';
    notice.setAttribute('role', 'alert');
    notice.style.cssText = 'position:fixed;right:24px;bottom:24px;z-index:2147483647;max-width:360px;padding:16px;background:#222;color:#fff;border:2px solid #fbbf24;border-radius:12px;font:14px/1.5 system-ui;box-shadow:0 8px 24px #0006';
    const message = document.createElement('span');
    message.textContent = 'Desktop notification unavailable. Update this script and accept its notification permission in your userscript manager. Check browser and OS notification settings too. ';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Dismiss';
    close.addEventListener('click', () => notice.remove());
    notice.append(message, close);
    document.body.append(notice);
    setTimeout(() => notice.remove(), 20000);
  }

  function showNativeNotificationOrWarning(details) {
    const notification = createNativeNotification(details);
    if (notification) {
      notificationChannel = 'website fallback';
      return true;
    }
    reportNotificationFailure();
    return false;
  }

  function createDesktopNotification({ title, text, silent, context = location.pathname }) {
    const details = { title, text, silent };
    // The manager uses the extension notification permission, so a blocked
    // chatgpt.com website permission does not silently swallow the toast.
    if (typeof GM_notification === 'function') {
      try {
        const request = GM_notification({
          ...details,
          image: NOTIFICATION_ICON,
          timeout: 20000,
          highlight: false,
          tag: `chatgpt-completion:${context}`,
          onclick: () => { try { window.focus(); } catch {} }
        });
        notificationChannel = 'userscript manager';
        // Some manager versions expose a Promise. Do not wait for dismissal
        // before marking the completion as handled, but catch async failures.
        if (request && typeof request.catch === 'function') {
          request.catch(() => showNativeNotificationOrWarning(details));
        }
        return true;
      } catch (error) {
        log('Userscript-manager notification failed:', error);
      }
    }
    return showNativeNotificationOrWarning(details);
  }

  async function showReadyNotification(responseText, title = cleanSessionTitle(document.title), context = location.pathname, valid = () => true) {
    if (suspended || !valid()) return false;
    const text = truncateResponse(responseText);
    const customChimePlayed = await playCompletionChimeWithFallback(valid);
    if (suspended || !valid()) return false;
    createDesktopNotification({ title, text, silent: customChimePlayed, context });
    return true;
  }

  const SETTLE_MS = 1800;
  const RECOVERY_GRACE_MS = 5000;
  const STATE_TTL_MS = 48 * 60 * 60 * 1000;
  const SESSION_KEY = 'kian-chatgpt-notifier.runs.v1';
  const RECEIPTS_KEY = 'kian-chatgpt-notifier.receipts.v1';
  const PAGE_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const bootPerformance = performance.now();
  const inFlight = new Set();
  const observedHere = new Set();
  const processedResources = new Set();
  let storageAvailable = true;
  let receiptStorageWritable = true;
  let receiptMemory = [];
  let records = new Map();
  let previousSnapshot = null;
  let currentContext = '';
  let candidate = null;
  let warmupUntil = Date.now() + RECOVERY_GRACE_MS;
  let suspended = false;
  let scanTimer = null;
  let scanInterval = null;
  let domObserver = null;
  let networkObserver = null;
  let lastManualStopAt = 0;

  function fingerprint(value) {
    const text = normalize(value);
    let first = 2166136261;
    let second = 5381;
    for (let i = 0; i < text.length; i += 1) {
      first = Math.imul(first ^ text.charCodeAt(i), 16777619);
      second = Math.imul(second, 33) ^ text.charCodeAt(i);
    }
    return `${(first >>> 0).toString(36)}-${(second >>> 0).toString(36)}-${text.length}`;
  }

  function readStorage(kind, key) {
    try {
      const raw = window[kind]?.getItem(key);
      return raw && raw.length < 131072 ? JSON.parse(raw) : null;
    } catch {
      storageAvailable = false;
      return null;
    }
  }

  function writeStorage(kind, key, value) {
    try {
      if (!window[kind]) { storageAvailable = false; return false; }
      window[kind].setItem(key, JSON.stringify(value));
      return true;
    } catch {
      storageAvailable = false;
      return false;
    }
  }

  function validPrompt(prompt) {
    return prompt && typeof prompt.id === 'string' && prompt.id.length <= 256 &&
      typeof prompt.hash === 'string' && prompt.hash.length <= 128;
  }

  function readSavedRuns() {
    const saved = readStorage('sessionStorage', SESSION_KEY);
    if (saved?.version !== 1 || !Array.isArray(saved.runs)) return;
    const now = Date.now();
    for (const item of saved.runs.slice(-24)) {
      if (!item || typeof item.context !== 'string' || item.context.length > 512 ||
        typeof item.id !== 'string' || item.id.length > 128 || !validPrompt(item.prompt) ||
        !['pending', 'notified', 'stopped', 'failed', 'superseded'].includes(item.status) ||
        !Number.isFinite(item.startedAt) || !Number.isFinite(item.updatedAt) ||
        item.updatedAt > now + 60000 || now - item.updatedAt > STATE_TTL_MS) continue;
      records.set(item.context, {
        context: item.context, id: item.id, prompt: { ...item.prompt },
        status: item.status, startedAt: item.startedAt, updatedAt: item.updatedAt,
        stopLatch: Boolean(item.stopLatch),
        answerId: typeof item.answerId === 'string' ? item.answerId.slice(0, 256) : '',
        answerHash: typeof item.answerHash === 'string' ? item.answerHash.slice(0, 128) : ''
      });
    }
  }

  function saveRuns() {
    const now = Date.now();
    const fresh = [...records.values()].filter(run => now - run.updatedAt <= STATE_TTL_MS)
      .sort((a, b) => a.updatedAt - b.updatedAt);
    // Finished conversations must not evict a long-running job when the user
    // works through many shorter chats in the same tab.
    const pending = fresh.filter(run => run.status === 'pending').slice(-24);
    const finishedLimit = 24 - pending.length;
    const finished = finishedLimit > 0 ? fresh.filter(run => run.status !== 'pending').slice(-finishedLimit) : [];
    const kept = [...pending, ...finished].slice(0, 24);
    records = new Map(kept.map(run => [run.context, run]));
    writeStorage('sessionStorage', SESSION_KEY, { version: 1, runs: kept });
  }

  function contextKey() {
    const path = location.pathname.replace(/\/+$/, '') || '/';
    return /\/c\/[^/]+/.test(path) ? path : `draft:${path}`;
  }

  function messageId(turn) {
    try {
      const node = turn.querySelector('[data-message-id]');
      return String(turn.getAttribute('data-message-id') || turn.getAttribute('data-turn-id') ||
        node?.getAttribute('data-message-id') || '').slice(0, 256);
    } catch { return ''; }
  }

  function samePrompt(left, right) {
    if (!validPrompt(left) || !validPrompt(right)) return false;
    if (left.id && right.id) return left.id === right.id;
    return left.hash === right.hash;
  }

  function snapshot() {
    const turns = turnNodes();
    let userIndex = -1;
    const userIds = [];
    for (let i = 0; i < turns.length; i += 1) {
      if (roleOf(turns[i]) === 'user') {
        userIndex = i;
        const id = messageId(turns[i]);
        if (id) userIds.push(id);
      }
    }
    let prompt = null;
    let answer = null;
    let error = false;
    let streaming = false;
    if (userIndex >= 0) {
      const user = turns[userIndex];
      const text = normalize(user.textContent || user.innerText);
      if (text) prompt = { id: messageId(user), hash: fingerprint(text) };
      for (let i = userIndex + 1; i < turns.length; i += 1) {
        const turn = turns[i];
        if (roleOf(turn) !== 'assistant') continue;
        const text = assistantText(turn);
        if (text) answer = { id: messageId(turn), hash: fingerprint(text), text };
        // Only inspect the latest assistant turn, not errors in older turns.
        error = Boolean(turn.querySelector('[data-testid="error-message"], [data-testid="conversation-turn-error"], [role="alert"]'));
        streaming = Boolean(turn.querySelector('[data-is-streaming="true"], .result-streaming'));
      }
    }
    const busy = [...document.querySelectorAll(STOP_BUTTON_SELECTOR)].some(isElementVisible) || streaming;
    return { context: contextKey(), prompt, answer, busy, error, userIds };
  }

  function startRun(view) {
    const now = Date.now();
    const run = {
      context: view.context, id: `${PAGE_ID}-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      prompt: { ...view.prompt }, status: 'pending', startedAt: now, updatedAt: now,
      stopLatch: false, answerId: '', answerHash: ''
    };
    records.set(view.context, run);
    candidate = null;
    saveRuns();
    return run;
  }

  function noteObserved(run) {
    observedHere.add(run.id);
    if (observedHere.size > 128) observedHere.delete(observedHere.values().next().value);
  }

  function adoptDraftRun(view) {
    if (view.context.startsWith('draft:') || records.has(view.context) || !view.prompt) return;
    for (const run of records.values()) {
      if (!run.context.startsWith('draft:') || run.status !== 'pending' || !samePrompt(run.prompt, view.prompt)) continue;
      // Across a reload, require a stable message ID. Within a live new-chat
      // transition, the prompt digest is sufficient to transfer its run.
      if (run.context !== currentContext && !(run.prompt.id && run.prompt.id === view.prompt.id)) continue;
      records.delete(run.context);
      run.context = view.context;
      run.updatedAt = Date.now();
      records.set(view.context, run);
      saveRuns();
      break;
    }
  }

  function receipts() {
    const saved = receiptStorageWritable ? readStorage('localStorage', RECEIPTS_KEY) : null;
    const list = saved?.version === 1 && Array.isArray(saved.items) ? saved.items : receiptMemory;
    const now = Date.now();
    return list.filter(item => item && typeof item.key === 'string' && item.key.length < 160 &&
      Number.isFinite(item.at) && item.at <= now + 60000 && now - item.at < STATE_TTL_MS).slice(-128);
  }

  function putReceipt(receipt) {
    receiptMemory = receipts().filter(item => item.key !== receipt.key);
    receiptMemory.push(receipt);
    receiptMemory = receiptMemory.slice(-128);
    if (!writeStorage('localStorage', RECEIPTS_KEY, { version: 1, items: receiptMemory })) {
      receiptStorageWritable = false;
    }
  }

  function markNotified(run, answer) {
    if (suspended || records.get(run.context)?.id !== run.id) return;
    run.status = 'notified';
    run.answerId = answer.id;
    run.answerHash = answer.hash;
    run.updatedAt = Date.now();
    saveRuns();
    candidate = null;
  }

  function stillReady(run, answer) {
    if (suspended || records.get(run.context)?.id !== run.id || run.status !== 'pending') return false;
    const current = snapshot();
    return current.context === run.context && samePrompt(current.prompt, run.prompt) &&
      !current.busy && !current.error && current.answer?.hash === answer.hash;
  }

  async function deliver(run, answer, title) {
    if (inFlight.has(run.id)) return;
    inFlight.add(run.id);
    const key = fingerprint(`${run.context}|${run.prompt.id || run.prompt.hash}|${answer.id}|${answer.hash}`);
    const claim = () => {
      if (!stillReady(run, answer)) return false;
      const existing = receipts().find(item => item.key === key);
      if (existing?.status === 'done' && existing.at >= run.startedAt) {
        markNotified(run, answer);
        return false;
      }
      if (existing?.status === 'claim' && existing.owner !== PAGE_ID && Date.now() - existing.at < 5000) return false;
      putReceipt({ key, at: Date.now(), status: 'claim', owner: PAGE_ID });
      return true;
    };
    try {
      let claimed = false;
      const locks = window.navigator?.locks;
      if (locks?.request) {
        try {
          // Hold the lock only for synchronous bookkeeping, never for sound
          // playback or timers that a background browser could suspend.
          claimed = await locks.request('kian-chatgpt-notifier.delivery.v1', claim);
        } catch {
          claimed = claim();
        }
      } else {
        claimed = claim();
      }
      if (!claimed) return;
      // Without Web Locks this ownership check is best-effort cross-tab
      // deduplication, bounded to a 50ms delay.
      await new Promise(resolve => setTimeout(resolve, 50));
      const owner = receipts().find(item => item.key === key);
      if (owner && owner.owner !== PAGE_ID) return;
      if (!stillReady(run, answer)) return;
      const sent = await showReadyNotification(answer.text, title, run.context, () => stillReady(run, answer));
      if (!sent || suspended) return;
      putReceipt({ key, at: Date.now(), status: 'done', owner: PAGE_ID });
      markNotified(run, answer);
    } catch (error) {
      log('Completion delivery failed; it will be retried:', error);
    } finally {
      inFlight.delete(run.id);
    }
  }

  function scan() {
    if (suspended) return;
    try {
      const view = snapshot();
      const now = Date.now();
      adoptDraftRun(view);
      if (currentContext !== view.context) {
        currentContext = view.context;
        candidate = null;
        previousSnapshot = null;
        warmupUntil = now + RECOVERY_GRACE_MS;
      }
      let run = records.get(view.context);
      const previous = previousSnapshot;
      previousSnapshot = view;
      if (!view.prompt) { candidate = null; return; }
      let reassignedId = false;
      if (run?.status === 'pending' && !samePrompt(run.prompt, view.prompt) &&
        run.prompt.hash === view.prompt.hash && !view.userIds.includes(run.prompt.id) &&
        (view.busy || (document.readyState !== 'loading' &&
          (now >= warmupUntil || (observedHere.has(run.id) && previous?.prompt?.id === run.prompt.id))))) {
        // React can replace an optimistic message ID with its server ID. If
        // the previous ID is no longer in the document, keep the pending run
        // attached to the same prompt digest rather than losing it.
        run.prompt = { ...view.prompt };
        run.updatedAt = now;
        reassignedId = true;
        saveRuns();
      }
      if (run?.status === 'pending' && !samePrompt(run.prompt, view.prompt)) {
        // Hydration can briefly show earlier turns. Do not discard recovery
        // state until the page has settled or a genuinely new run is visible.
        if (now < warmupUntil && !(run.prompt.id && view.userIds.includes(run.prompt.id))) {
          candidate = null; return;
        }
        run.status = 'superseded';
        run.updatedAt = now;
        saveRuns();
      }
      if (view.busy) {
        candidate = null;
        if (run && samePrompt(run.prompt, view.prompt) && run.status === 'stopped' && run.stopLatch) return;
        if (!run || run.status !== 'pending' || !samePrompt(run.prompt, view.prompt)) {
          run = startRun(view);
        }
        noteObserved(run);
        // Message IDs may be assigned after a temporary user turn appears.
        if ((!run.prompt.id && view.prompt.id) || now - run.updatedAt > 30000) {
          run.prompt = { ...view.prompt };
          run.updatedAt = now;
          saveRuns();
        }
        return;
      }
      if (run?.stopLatch) { run.stopLatch = false; saveRuns(); }
      if (now >= warmupUntil && document.readyState !== 'loading' &&
        ((!view.answer && (!run || !samePrompt(run.prompt, view.prompt))) ||
          (!reassignedId && previous?.prompt && !samePrompt(previous.prompt, view.prompt)))) {
        run = startRun(view);
        noteObserved(run);
      }
      if (!run || run.status !== 'pending' || !samePrompt(run.prompt, view.prompt)) { candidate = null; return; }
      if (view.error) {
        run.status = 'failed'; run.updatedAt = now; saveRuns(); candidate = null; return;
      }
      if (!view.answer || document.readyState === 'loading' ||
        (!observedHere.has(run.id) && now < warmupUntil)) { candidate = null; return; }
      const key = `${run.id}|${view.answer.id}|${view.answer.hash}`;
      if (candidate?.key !== key) { candidate = { key, since: now }; return; }
      if (now - candidate.since >= SETTLE_MS) {
        void deliver(run, { ...view.answer }, cleanSessionTitle(document.title));
      }
    } catch (error) {
      log('DOM scan failed; waiting for the next page update:', error);
    }
  }

  function scheduleScan() {
    if (suspended || scanTimer !== null) return;
    scanTimer = setTimeout(() => { scanTimer = null; scan(); }, 100);
  }

  function resourceHint(entries) {
    for (const entry of entries) {
      try {
        if (entry.entryType !== 'resource' || entry.startTime < bootPerformance ||
          (entry.initiatorType && !['fetch', 'xmlhttprequest'].includes(entry.initiatorType))) continue;
        const url = new URL(entry.name, location.href);
        if (url.origin !== new URL(location.href).origin ||
          !['/backend-api/f/conversation', '/backend-api/conversation'].includes(url.pathname.replace(/\/+$/, ''))) continue;
        const status = entry.responseStatus;
        if (status && (status < 200 || status >= 300)) continue;
        const resourceKey = `${entry.name}|${entry.startTime}|${entry.responseEnd}`;
        if (processedResources.has(resourceKey)) continue;
        processedResources.add(resourceKey);
        if (processedResources.size > 128) processedResources.delete(processedResources.values().next().value);
        const startAt = performance.timeOrigin + entry.startTime;
        if (lastManualStopAt >= startAt) continue;
        const view = snapshot();
        if (!view.prompt) continue;
        let run = records.get(view.context);
        if (run?.status === 'stopped' && samePrompt(run.prompt, view.prompt)) continue;
        if (run?.status === 'notified' && samePrompt(run.prompt, view.prompt) && startAt <= run.updatedAt) continue;
        if (!run || run.status !== 'pending' || !samePrompt(run.prompt, view.prompt)) run = startRun(view);
        noteObserved(run);
      } catch {}
    }
    scheduleScan();
  }

  function startObservers() {
    if (scanInterval !== null) return;
    if (typeof MutationObserver === 'function') {
      try {
        domObserver = new MutationObserver(scheduleScan);
        domObserver.observe(document, {
          subtree: true, childList: true, characterData: true, attributes: true,
          attributeFilter: ['data-testid', 'aria-label', 'disabled', 'hidden', 'aria-busy', 'data-is-streaming', 'class']
        });
      } catch { domObserver = null; }
    }
    if (typeof PerformanceObserver === 'function') {
      try {
        networkObserver = new PerformanceObserver(list => resourceHint(list.getEntries()));
        // Old buffered requests must not turn a previously completed chat into
        // a new notification. DOM state is the primary recovery mechanism.
        networkObserver.observe({ type: 'resource', buffered: false });
      } catch { networkObserver = null; }
    }
    scanInterval = setInterval(scan, 1000);
    scan();
  }

  function pauseObservers() {
    saveRuns();
    suspended = true;
    clearInterval(scanInterval); scanInterval = null;
    clearTimeout(scanTimer); scanTimer = null;
    domObserver?.disconnect(); domObserver = null;
    networkObserver?.disconnect(); networkObserver = null;
    if (audioContext?.close) audioContext.close().catch(() => {});
    audioContext = null;
  }

  document.addEventListener('click', event => {
    if (!isStopButton(event.target)) return;
    lastManualStopAt = Date.now();
    const view = snapshot();
    if (!view.prompt) return;
    const run = records.get(view.context);
    const stopped = run && samePrompt(run.prompt, view.prompt) ? run : startRun(view);
    stopped.status = 'stopped'; stopped.stopLatch = true; stopped.updatedAt = Date.now();
    candidate = null;
    saveRuns();
  }, true);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') candidate = null;
    scheduleScan();
  });
  document.addEventListener('DOMContentLoaded', scheduleScan);
  window.addEventListener('pagehide', pauseObservers);
  window.addEventListener('pageshow', () => {
    suspended = false; candidate = null; warmupUntil = Date.now() + RECOVERY_GRACE_MS;
    startObservers(); scheduleScan();
  });
  window.addEventListener('focus', scheduleScan);
  window.addEventListener('popstate', scheduleScan);
  window.addEventListener('hashchange', scheduleScan);

  readSavedRuns();
  startObservers();

  GM_registerMenuCommand('Test sound + notification', () => showReadyNotification(
    'If you heard a sound and saw this notification, both channels work.',
    'ChatGPT completion alert test'
  ));
  GM_registerMenuCommand('Recheck running response', scan);
  GM_registerMenuCommand('Log prompt-bound status', () => {
    console.info('[ChatGPT Completion Alert] status', {
      version: VERSION,
      pendingRuns: [...records.values()].filter(run => run.status === 'pending').length,
      currentRunStatus: records.get(contextKey())?.status || 'idle',
      persistenceAvailable: storageAvailable,
      notificationChannel,
      managerNotificationAvailable: typeof GM_notification === 'function',
      websiteNotificationPermission: PAGE.Notification?.permission || 'unsupported',
      audioState: audioContext?.state || 'not initialized',
      suspended
    });
  });
})();
