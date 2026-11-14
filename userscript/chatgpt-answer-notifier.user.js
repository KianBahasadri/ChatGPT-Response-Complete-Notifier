// ==UserScript==
// @name         ChatGPT Prompt-Bound Completion Alert
// @namespace    https://github.com/KianBahasadri/ChatGPT-Response-Complete-Notifier
// @version      1.2.0
// @description  Loud repeating chime + desktop notification when ChatGPT finishes, with previews bound to the latest user prompt.
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

  const VERSION = '1.2.0';
  const CHIME_VOLUME = 0.70; // Peak amplitude, from 0 to 1.
  const NOTIFICATION_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAADR0lEQVR4nO2dXXIiMQwGzdYeYS7B/Q/DcbJPVLEkBHuQ9fd1PxPiSG3J9jg1l+M4vgbI8id6ABALAoiDAOIggDgIIA4CiIMA4iCAOAggDgKIgwDiIIA4CCAOAoiDAOL8jR7AGGPcbrfoIYRwvV6jhzAuURdCVJP+iigZ3AUg8b/jLYKbACR+DS8RXBaBJH8dr5htrQAk3oad1WBbBSD5duyM5RYBSL49u2Ka4hxgjBx7Yk+yTBLzNcDKH6aW9FdExsy0BZD8c6zEwrpyuLcAEv8z97h4twazCjAzcJL/npkYWUrC00BxTARg9tviWQVcKgDJX6fVswDIy8cCZDnQUMQi9tsrAOX/PB6xS3MU7MW7WaMmrIQAK6Xy8bMKMrQW4NMeef/5ziK0FMB6YdpZhHbbwJ27ko47nlYCeCSomwRtBPBMTCcJWggQkZAuEpQXIDIRHSQovQs4m4BXq/kz33e73UrvDkoLsMq7REXdyomkbAtYvX+4MktXP19ZmJICeF0+VZCgpACzWPTmyv19hnICzM40y8TNflfFKlBOALClpQA7ynbXVlBKgAoltsIYHyklwAw7Z2rHKtBOAFgDAcQpI0Cl3lpprGUEmMGjR3dbB7QSANZBAHHSPg6u1Ed/4nn8WVsHFUCctBVghqhZ9fx7K1crKoA4CCAOAoiDAOIggDgIIA4CiIMA4iCAOAggDgKIgwDiIIA4CCAOAoiDAOKUvhBS+SJGFqgA4iCAOAggDgKIk3YRWP3mbdb/A3iGCiAOAoiDAOKkXQM8Y9FTebv5d6gA4iCAOAggDgKIIyXA7MJOZQE4hoMA2U7wZl8akQGP2H0sQKaAzfJqzNX+FovxljkHsKZasnfhsgbI1gYq4BUzEwFmZhMSzDMTK6sKJrULgO+YCUAVsMFz9o8RsAjs/Cr2T4iaHKYtQOE1azuIfEp5OY7jy/Qbx7nkqlWELDFKcw5ARYhhyy5AbTZ7sCum27aBSGDHzlhuWQM8Q3k/h8ckcjkIohqs4xUzlwrwCNXgd7wni7sAdxDhf6KqZJgAj6jKkKE1phAA4uBpoDgIIA4CiIMA4iCAOAggDgKIgwDiIIA4CCAOAoiDAOIggDgIIA4CiPMPMxH82wgo8LsAAAAASUVORK5CYII=';
  const RESPONSE_PREVIEW_MAX_CHARS = 260;
  const FINAL_TURN_WAIT_MS = 30000;
  const ANSWER_CHECK_THROTTLE_MS = 150;
  const STREAM_SETTLE_MS = 900;
  const STREAM_POLL_MS = 500;
  const GENERATION_HARD_CAP_MS = 600000;
  const STOP_BUTTON_SELECTOR =
    'button[data-testid="stop-button"], button[data-testid="fruitjuice-stop-button"]';
  const MAX_PROCESSED_ENTRIES = 100;
  const RETURN_DISMISS_GRACE_MS = 500;
  const ACTIVE_NOTIFICATION_STORAGE_KEY = 'chatgpt-prompt-bound-active-notification';
  const CONVERSATION_PATHS = new Set([
    '/backend-api/f/conversation',
    '/backend-api/conversation'
  ]);
  const PAGE = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

  let audioContext = null;
  let lastManualStopEpoch = 0;
  let lastCompletionEpoch = 0;
  let activeNotification = null;
  const processedEntries = new Set();
  const notifiedCompletionKeys = new Set();
  let notificationChannel = 'not requested';
  const resourceTimingDiagnostics = {
    seen: 0,
    conversationCandidates: 0,
    accepted: 0,
    rejectedStatus: 0,
    lastResponseStatus: null,
    clears: 0
  };

  const log = (...args) => console.debug('[ChatGPT Prompt-Bound Alert]', ...args);
  const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();

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

  function answerBoundToLatestPrompt() {
    const turns = turnNodes();
    let latestUserIndex = -1;
    for (let i = 0; i < turns.length; i += 1) {
      if (roleOf(turns[i]) === 'user') latestUserIndex = i;
    }
    if (latestUserIndex < 0) return '';

    let candidate = '';
    for (let i = latestUserIndex + 1; i < turns.length; i += 1) {
      if (roleOf(turns[i]) !== 'assistant') continue;
      const text = assistantText(turns[i]);
      if (text) candidate = text;
    }
    return candidate;
  }

  function conversationObserverRoot() {
    const turns = turnNodes();
    const latestTurn = turns[turns.length - 1];
    if (latestTurn) {
      const main = latestTurn.closest?.('main');
      if (main) return main;
      if (latestTurn.parentElement) return latestTurn.parentElement;
    }
    return document.querySelector('main') || document.body || document.documentElement;
  }

  function waitForAnswerBoundToLatestPrompt() {
    return new Promise((resolve) => {
      let settled = false;
      let observer = null;
      let watchdogId = null;
      let pollId = null;
      let throttleId = null;
      let frameId = null;
      let lastCheckAt = 0;
      let stableText = '';
      let stableSince = 0;
      let generationEndedAt = 0;
      const startedAt = Date.now();

      const cleanupScheduledCheck = () => {
        if (throttleId !== null) {
          clearTimeout(throttleId);
          throttleId = null;
        }
        if (frameId !== null && typeof cancelAnimationFrame === 'function') {
          cancelAnimationFrame(frameId);
          frameId = null;
        }
      };

      const finish = (text) => {
        if (settled) return;
        settled = true;
        if (observer) observer.disconnect();
        if (watchdogId !== null) clearInterval(watchdogId);
        if (pollId !== null) clearInterval(pollId);
        cleanupScheduledCheck();
        resolve(text);
      };

      const check = () => {
        if (settled) return;
        lastCheckAt = performance.now();

        // Safety valve: a stop button that never clears must not wedge the
        // watcher. Abort without notifying, because the answer never finished.
        if (Date.now() - startedAt >= GENERATION_HARD_CAP_MS) {
          finish(null);
          return;
        }

        // The stop button is the authoritative "still working" signal. While it
        // is present ChatGPT is thinking or streaming, which is not completion.
        if (isGenerating()) {
          stableText = '';
          stableSince = 0;
          generationEndedAt = 0;
          return;
        }

        const text = answerBoundToLatestPrompt();
        if (!text) {
          stableText = '';
          stableSince = 0;
          return;
        }

        const now = Date.now();
        if (text !== stableText) {
          stableText = text;
          stableSince = now;
          return;
        }

        // Generation ended and the text stopped changing. Only now is the
        // answer actually finished, so a late repaint cannot cut it short.
        if (now - stableSince >= STREAM_SETTLE_MS) finish(text);
      };

      const scheduleCheck = () => {
        if (settled || throttleId !== null || frameId !== null) return;
        const elapsed = performance.now() - lastCheckAt;
        const delay = Math.max(0, ANSWER_CHECK_THROTTLE_MS - elapsed);
        throttleId = setTimeout(() => {
          throttleId = null;
          const run = () => {
            frameId = null;
            check();
          };
          if (document.visibilityState !== 'hidden' && typeof requestAnimationFrame === 'function') {
            frameId = requestAnimationFrame(run);
          } else {
            run();
          }
        }, delay);
      };

      const root = conversationObserverRoot();
      if (root && typeof MutationObserver === 'function') {
        observer = new MutationObserver(scheduleCheck);
        observer.observe(root, { childList: true, subtree: true, characterData: true });
      }

      // Interval fallback: background tabs freeze requestAnimationFrame, so the
      // observer chain alone can stall until the tab regains focus.
      pollId = setInterval(check, STREAM_POLL_MS);

      // Only counted once generation has ended, so a long reasoning phase is
      // not mistaken for the 30s "no answer text appeared" fallback.
      watchdogId = setInterval(() => {
        if (settled) return;
        if (isGenerating()) {
          generationEndedAt = 0;
          return;
        }
        const now = Date.now();
        if (generationEndedAt === 0) generationEndedAt = now;
        if (now - generationEndedAt >= FINAL_TURN_WAIT_MS) finish(answerBoundToLatestPrompt());
      }, STREAM_POLL_MS);

      check();
    });
  }

  function getAudioContext() {
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

  async function playCompletionChime(deadline = Number.POSITIVE_INFINITY) {
    const ctx = getAudioContext();
    if (!ctx) return false;
    try {
      if (ctx.state === 'suspended') await ctx.resume();
      if (ctx.state !== 'running' || performance.now() > deadline) return false;
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

  document.addEventListener('click', (event) => {
    if (isStopButton(event.target)) {
      lastManualStopEpoch = Date.now();
      log('Manual Stop recorded.');
    }
  }, true);

  function conversationPath(url) {
    try {
      return new URL(url, location.href).pathname.replace(/\/+$/, '');
    } catch {
      return '';
    }
  }

  function isConversationResource(entry) {
    if (!entry || entry.entryType !== 'resource') return false;
    resourceTimingDiagnostics.seen += 1;
    if (!CONVERSATION_PATHS.has(conversationPath(entry.name))) return false;
    resourceTimingDiagnostics.conversationCandidates += 1;
    if (entry.initiatorType && !['fetch', 'xmlhttprequest'].includes(entry.initiatorType)) return false;

    const responseStatus = typeof entry.responseStatus === 'number' ? entry.responseStatus : null;
    resourceTimingDiagnostics.lastResponseStatus = responseStatus;
    if (responseStatus !== null && responseStatus !== 0 && (responseStatus < 200 || responseStatus >= 300)) {
      resourceTimingDiagnostics.rejectedStatus += 1;
      return false;
    }

    resourceTimingDiagnostics.accepted += 1;
    return true;
  }

  function entryKey(entry) {
    return [
      entry.name,
      Number(entry.startTime || 0).toFixed(3),
      Number(entry.responseEnd || entry.duration || 0).toFixed(3)
    ].join('|');
  }

  function wasManuallyStopped(entry) {
    if (!lastManualStopEpoch) return false;
    const origin = Number(performance.timeOrigin || (Date.now() - performance.now()));
    const startEpoch = origin + Number(entry.startTime || 0);
    const endEpoch = origin + Number(entry.responseEnd || (entry.startTime || 0) + (entry.duration || 0));
    return lastManualStopEpoch >= startEpoch - 100 && lastManualStopEpoch <= endEpoch + 1500;
  }

  function pageIsActive() {
    try {
      return document.visibilityState === 'visible' && document.hasFocus();
    } catch {
      return document.visibilityState === 'visible';
    }
  }

  async function playCompletionChimeWithFallback() {
    const deadline = performance.now() + 250;
    let timeoutId;
    try {
      return await Promise.race([
        playCompletionChime(deadline),
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

  function createDesktopNotification({ title, text, silent }) {
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
          tag: `chatgpt-completion:${location.pathname}`,
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

  async function showReadyNotification(responseText) {
    const title = cleanSessionTitle(document.title);
    const text = truncateResponse(responseText);

    const customChimePlayed = await playCompletionChimeWithFallback();
    createDesktopNotification({
      title,
      text,
      silent: customChimePlayed
    });
  }

  function rememberProcessedEntry(key) {
    if (processedEntries.has(key)) return false;
    while (processedEntries.size >= MAX_PROCESSED_ENTRIES) {
      const oldest = processedEntries.values().next().value;
      if (oldest === undefined) break;
      processedEntries.delete(oldest);
    }
    processedEntries.add(key);
    return true;
  }

  async function handleConversationCompletion(entry) {
    const key = entryKey(entry);
    if (!rememberProcessedEntry(key)) return;

    if (wasManuallyStopped(entry)) {
      log('Request ended after manual Stop; notification suppressed.');
      return;
    }

    const now = Date.now();
    if (now - lastCompletionEpoch < 400) return;
    lastCompletionEpoch = now;

    log('Conversation request completed; resolving assistant turn after latest user turn.');
    const responseText = await waitForAnswerBoundToLatestPrompt();
    if (!responseText) {
      log('Watcher aborted without a finished answer; notification suppressed.');
      return;
    }
    const completionKey = `${location.pathname}|${normalize(responseText).slice(0, 1000)}`;
    if (notifiedCompletionKeys.has(completionKey)) return;
    await showReadyNotification(responseText);
    while (notifiedCompletionKeys.size >= MAX_PROCESSED_ENTRIES) {
      const oldest = notifiedCompletionKeys.values().next().value;
      if (oldest === undefined) break;
      notifiedCompletionKeys.delete(oldest);
    }
    notifiedCompletionKeys.add(completionKey);
  }

  function processResourceEntries(entries) {
    try {
      for (const entry of entries) {
        if (!isConversationResource(entry)) continue;
        handleConversationCompletion(entry).catch((error) => {
          console.error('[ChatGPT Prompt-Bound Alert] completion failed:', error);
        });
      }
    } finally {
      try {
        performance.clearResourceTimings?.();
        resourceTimingDiagnostics.clears += 1;
      } catch {}
    }
  }

  function installNetworkCompletionObserver() {
    try { performance.setResourceTimingBufferSize?.(1000); } catch {}

    if (typeof PerformanceObserver === 'function') {
      try {
        const observer = new PerformanceObserver((list) => processResourceEntries(list.getEntries()));
        observer.observe({ type: 'resource', buffered: true });
        log('Network completion detector installed.');
        return;
      } catch (error) {
        log('PerformanceObserver install failed:', error);
      }
    }

    processResourceEntries(performance.getEntriesByType?.('resource') || []);
  }

  GM_registerMenuCommand('Test sound + notification', async () => {
    const customChimePlayed = await playCompletionChimeWithFallback();

    createDesktopNotification({
      title: 'ChatGPT Prompt-Bound test',
      text: 'If you heard a sound and saw this notification, both channels work.',
      silent: customChimePlayed
    });
  });

  GM_registerMenuCommand('Log prompt-bound status', () => {
    const turns = turnNodes().map((turn, index) => ({
      index,
      testid: turn.getAttribute('data-testid'),
      role: roleOf(turn),
      preview: roleOf(turn) === 'assistant' ? assistantText(turn).slice(0, 100) : ''
    }));
    console.info('[ChatGPT Prompt-Bound Alert] status', {
      version: VERSION,
      title: document.title,
      resolvedLatestAnswer: answerBoundToLatestPrompt().slice(0, 260),
      processedEntryCount: processedEntries.size,
      resourceTiming: { ...resourceTimingDiagnostics },
      notificationChannel,
      managerNotificationAvailable: typeof GM_notification === 'function',
      websiteNotificationPermission: PAGE.Notification?.permission || 'unsupported',
      turns
    });
  });

  installNetworkCompletionObserver();
})();
