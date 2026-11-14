const assert = require('node:assert/strict');
const test = require('node:test');
const { Clock, MemoryStorage, sharedLocks, loadNotifier } = require('./notifier-harness.cjs');

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
  await notifier.advance(3500);
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
  await notifier.advance(1);
  assert.equal(notifier.notes.length, 0);
});

test('a manager promise that waits for dismissal does not block completion handling', async t => {
  const notifier = loadNotifier(t, { manager: 'pending' });
  await notifier.alert();
  assert.equal(notifier.managerCalls.length, 1);
});

test('reload during an active response recovers without its original network request', async t => {
  const clock = new Clock(), session = new MemoryStorage(), local = new MemoryStorage();
  const first = loadNotifier(t, { clock, session, local, view: { busy: true, answer: 'Working...' } });
  await first.advance(500);
  first.close();
  const refreshed = loadNotifier(t, { clock, session, local, view: { busy: true, answer: 'Still working...' } });
  await refreshed.advance(10000);
  assert.equal(refreshed.managerCalls.length, 0);
  refreshed.setView({ busy: false, answer: 'Finished after the reload.' });
  await refreshed.advance(4000);
  assert.equal(refreshed.managerCalls.length, 1);
  assert.equal(refreshed.managerCalls[0].text, 'Finished after the reload.');
});

test('completion during the reload itself is recovered after hydration settles', async t => {
  const clock = new Clock(), session = new MemoryStorage(), local = new MemoryStorage();
  const first = loadNotifier(t, { clock, session, local, view: { busy: true } });
  first.close();
  const refreshed = loadNotifier(t, { clock, session, local, blockedAudio: true });
  await refreshed.advance(4500);
  assert.equal(refreshed.managerCalls.length, 0);
  await refreshed.advance(4000);
  assert.equal(refreshed.managerCalls.length, 1);
  assert.equal(refreshed.managerCalls[0].silent, false, 'Desktop delivery must not wait for audio to be unlocked');
});

test('refreshing an already-notified response does not notify again', async t => {
  const clock = new Clock(), session = new MemoryStorage(), local = new MemoryStorage();
  const first = loadNotifier(t, { clock, session, local, view: { busy: true } });
  first.setView({ busy: false });
  await first.advance(4000);
  assert.equal(first.managerCalls.length, 1);
  first.close();
  const refreshed = loadNotifier(t, { clock, session, local });
  await refreshed.advance(15000);
  assert.equal(refreshed.managerCalls.length, 0);
});

test('opening an old finished conversation produces no historical alert', async t => {
  const notifier = loadNotifier(t);
  await notifier.advance(15000);
  assert.equal(notifier.managerCalls.length, 0);
  assert.equal(notifier.resourceConfig().buffered, false);
});

test('DOM monitoring detects completion even if no network observer is available', async t => {
  const notifier = loadNotifier(t, { networkAvailable: false, view: { busy: true, answer: 'Working...' } });
  await notifier.advance(1500);
  notifier.setView({ busy: false, answer: 'Done without network timing.' });
  await notifier.advance(4000);
  assert.equal(notifier.managerCalls.length, 1);
});

test('periodic scans recover when DOM observers are unavailable', async t => {
  const notifier = loadNotifier(t, { mutationsAvailable: false, networkAvailable: false, view: { busy: true } });
  notifier.setView({ busy: false, answer: 'Done through the periodic fallback.' });
  await notifier.advance(5000);
  assert.equal(notifier.managerCalls.length, 1);
});

test('long agent runs remain tracked beyond the old ten-minute timeout', async t => {
  const notifier = loadNotifier(t, { view: { busy: true, answer: 'Working...' } });
  await notifier.advance(12 * 60 * 1000);
  assert.equal(notifier.managerCalls.length, 0);
  notifier.setView({ busy: false, answer: 'Long job finished.' });
  await notifier.advance(4000);
  assert.equal(notifier.managerCalls.length, 1);
});

test('manual Stop stays suppressed across a reload', async t => {
  const clock = new Clock(), session = new MemoryStorage(), local = new MemoryStorage();
  const first = loadNotifier(t, { clock, session, local, view: { busy: true, answer: 'Partial answer' } });
  first.stop();
  first.setView({ busy: false });
  await first.advance(4000);
  first.close();
  const refreshed = loadNotifier(t, { clock, session, local, view: { answer: 'Partial answer' } });
  await refreshed.advance(10000);
  assert.equal(refreshed.managerCalls.length, 0);
  assert.equal(first.managerCalls.length, 0);
  refreshed.setView({ busy: true, answerId: 'retry-1' });
  await refreshed.advance(1000);
  refreshed.setView({ busy: false, answer: 'Finished after retry.' });
  await refreshed.advance(4000);
  assert.equal(refreshed.managerCalls.length, 1);
});

test('navigation cannot attribute an unfinished response to a different conversation', async t => {
  const notifier = loadNotifier(t, { view: { busy: true, answer: 'Working in A' } });
  notifier.setView({ context: '/c/other', userId: 'other-user', busy: false, answer: 'Old answer in B' });
  await notifier.advance(10000);
  assert.equal(notifier.managerCalls.length, 0);
  notifier.setView({ context: '/c/example', userId: 'user-1', answer: 'A finished while you were away.' });
  await notifier.advance(9000);
  assert.equal(notifier.managerCalls.length, 1);
  assert.equal(notifier.managerCalls[0].text, 'A finished while you were away.');
});

test('a new-chat URL transition migrates its pending run before refresh', async t => {
  const clock = new Clock(), session = new MemoryStorage(), local = new MemoryStorage();
  const first = loadNotifier(t, { clock, session, local, view: { context: '/', busy: true } });
  first.setView({ context: '/c/assigned-conversation', busy: true });
  await first.advance(500);
  first.close();
  const refreshed = loadNotifier(t, { clock, session, local, view: { context: '/c/assigned-conversation' } });
  await refreshed.advance(9000);
  assert.equal(refreshed.managerCalls.length, 1);
});

test('partial text marked as an error is not announced as successful completion', async t => {
  const notifier = loadNotifier(t, { view: { busy: true, answer: 'Partial answer' } });
  notifier.setView({ busy: false, error: true });
  await notifier.advance(10000);
  assert.equal(notifier.managerCalls.length, 0);
  notifier.setView({ busy: true, error: false, answerId: 'retry-answer' });
  await notifier.advance(1000);
  notifier.setView({ busy: false, answer: 'Successful retry.' });
  await notifier.advance(4000);
  assert.equal(notifier.managerCalls.length, 1);
});

test('hydration showing an older prompt cannot consume a recovered pending run', async t => {
  const clock = new Clock(), session = new MemoryStorage(), local = new MemoryStorage();
  const first = loadNotifier(t, { clock, session, local, view: { busy: true } });
  first.close();
  const refreshed = loadNotifier(t, { clock, session, local, view: {
    userId: 'older-user', userText: 'Older question', answer: 'Older answer', busy: true, readyState: 'loading'
  } });
  await refreshed.advance(3000);
  refreshed.setView({ userId: 'user-1', userText: 'Question', busy: false, readyState: 'complete', answer: 'Current answer.' });
  await refreshed.advance(6000);
  assert.equal(refreshed.managerCalls.length, 1);
  assert.equal(refreshed.managerCalls[0].text, 'Current answer.');
});

test('regeneration can notify again even if its final answer text is identical', async t => {
  const notifier = loadNotifier(t, { view: { busy: true, answer: 'Same answer.' } });
  notifier.setView({ busy: false });
  await notifier.advance(4000);
  assert.equal(notifier.managerCalls.length, 1);
  notifier.setView({ busy: true });
  await notifier.advance(150);
  notifier.setView({ busy: false });
  await notifier.advance(4000);
  assert.equal(notifier.managerCalls.length, 2);
});

test('different prompts with identical answers each receive an alert', async t => {
  const notifier = loadNotifier(t, { view: { busy: true, answer: 'OK' } });
  notifier.setView({ busy: false });
  await notifier.advance(4000);
  notifier.setView({ userId: 'user-2', userText: 'A different question', busy: true, answerId: 'answer-2' });
  await notifier.advance(500);
  notifier.setView({ busy: false });
  await notifier.advance(4000);
  assert.equal(notifier.managerCalls.length, 2);
});

test('two tabs observing the same response produce one alert when Web Locks are available', async t => {
  const clock = new Clock(), local = new MemoryStorage(), locks = sharedLocks();
  const first = loadNotifier(t, { clock, local, locks, view: { busy: true } });
  const second = loadNotifier(t, { clock, local, locks, view: { busy: true } });
  first.setView({ busy: false }); second.setView({ busy: false });
  await clock.tick(5000);
  assert.equal(first.managerCalls.length + second.managerCalls.length, 1);
});

test('shared receipts also suppress duplicate tabs without Web Locks', async t => {
  const clock = new Clock(), local = new MemoryStorage();
  const first = loadNotifier(t, { clock, local, view: { busy: true } });
  const second = loadNotifier(t, { clock, local, view: { busy: true } });
  first.setView({ busy: false }); second.setView({ busy: false });
  await clock.tick(6000);
  assert.equal(first.managerCalls.length + second.managerCalls.length, 1);
});

test('blocked storage degrades to an in-memory notifier instead of breaking alerts', async t => {
  const blocked = { getItem() { throw new Error('Storage blocked'); }, setItem() { throw new Error('Storage blocked'); } };
  const notifier = loadNotifier(t, { session: blocked, local: blocked, view: { busy: true } });
  notifier.setView({ busy: false });
  await notifier.advance(5000);
  assert.equal(notifier.managerCalls.length, 1);
});

test('corrupt persistence is ignored and old pending records expire', async t => {
  const session = new MemoryStorage();
  session.setItem('kian-chatgpt-notifier.runs.v1', '{invalid JSON');
  const notifier = loadNotifier(t, { session, view: { busy: true } });
  notifier.setView({ busy: false });
  await notifier.advance(4000);
  assert.equal(notifier.managerCalls.length, 1);
  notifier.setView({ busy: true });
  await notifier.advance(500);
  notifier.close();
  notifier.clock.time += 49 * 60 * 60 * 1000;
  const reopened = loadNotifier(t, { clock: notifier.clock, session });
  await reopened.advance(10000);
  assert.equal(reopened.managerCalls.length, 0);
});

test('back-forward restoration resumes monitoring after pagehide', async t => {
  const notifier = loadNotifier(t, { view: { busy: true } });
  notifier.close(); notifier.restore();
  notifier.setView({ busy: false, answer: 'Finished after returning.' });
  await notifier.advance(5000);
  assert.equal(notifier.managerCalls.length, 1);
});

test('duplicate or unrelated resource hints cannot retrigger old answers', async t => {
  const notifier = loadNotifier(t);
  const entry = { startTime: notifier.clock.time, responseEnd: notifier.clock.time + 1 };
  notifier.completeResponse(entry);
  await notifier.advance(4000);
  assert.equal(notifier.managerCalls.length, 1);
  notifier.completeResponse(entry);
  notifier.completeResponse({ name: 'https://unrelated.example/backend-api/f/conversation' });
  notifier.completeResponse({ responseStatus: 500 });
  await notifier.advance(10000);
  assert.equal(notifier.managerCalls.length, 1);
  assert.equal(notifier.stats.timingClears, 0, 'The notifier must not clear the page resource-timing buffer');
});

test('hidden stop buttons do not block idle detection, while actual streaming still does', async t => {
  const idle = loadNotifier(t, { view: { busy: true, hiddenStop: true } });
  await idle.advance(10000);
  assert.equal(idle.managerCalls.length, 0);
  const streaming = loadNotifier(t, { view: { streaming: true, busy: false, answer: 'Still streaming' } });
  await streaming.advance(10000);
  assert.equal(streaming.managerCalls.length, 0);
  streaming.setView({ streaming: false, answer: 'Stream finished.' });
  await streaming.advance(4000);
  assert.equal(streaming.managerCalls.length, 1);
});

test('saved state contains identifiers and digests, not prompts or response text', async t => {
  const notifier = loadNotifier(t, { view: { busy: true, userText: 'Secret user prompt ABC', answer: 'Secret answer XYZ' } });
  notifier.setView({ busy: false });
  await notifier.advance(4000);
  const stored = [...notifier.session.items.values(), ...notifier.local.items.values()].join('');
  assert.ok(stored.length > 0);
  assert.doesNotMatch(stored, /Secret user prompt ABC|Secret answer XYZ/);
});

test('temporary message IDs can be replaced before a fast response completes', async t => {
  const notifier = loadNotifier(t, { view: { busy: true, userId: 'temporary-user', answer: 'Working' } });
  await notifier.advance(300);
  notifier.setView({ busy: false, userId: 'server-user', answer: 'Final answer after ID assignment.' });
  await notifier.advance(10000);
  assert.equal(notifier.managerCalls.length, 1);
});

test('navigation while audio is resuming cannot send an alert for the wrong page', async t => {
  const notifier = loadNotifier(t, { blockedAudio: true, view: { busy: true } });
  notifier.setView({ busy: false });
  await notifier.advance(2051);
  notifier.setView({ context: '/c/other', userId: 'other', answer: 'An older unrelated answer' });
  notifier.releaseAudio();
  await notifier.advance(1000);
  assert.equal(notifier.managerCalls.length, 0);
  assert.equal(notifier.notes.length, 0);
  notifier.setView({ context: '/c/example', userId: 'user-1', answer: 'The finished answer.' });
  await notifier.advance(9000);
  assert.equal(notifier.managerCalls.length, 1);
});

test('late output changes restart the completion settling period', async t => {
  const notifier = loadNotifier(t, { view: { busy: true } });
  notifier.setView({ busy: false, answer: 'Almost done' });
  await notifier.advance(1600);
  notifier.setView({ answer: 'The actual final answer.' });
  await notifier.advance(1600);
  assert.equal(notifier.managerCalls.length, 0);
  await notifier.advance(2000);
  assert.equal(notifier.managerCalls[0].text, 'The actual final answer.');
});

test('a reload during notification delivery recovers after the abandoned claim expires', async t => {
  const clock = new Clock(), session = new MemoryStorage(), local = new MemoryStorage();
  const first = loadNotifier(t, { clock, session, local, view: { busy: true } });
  first.setView({ busy: false });
  await first.advance(2025);
  first.close();
  const refreshed = loadNotifier(t, { clock, session, local });
  await refreshed.advance(10000);
  assert.equal(first.managerCalls.length, 0);
  assert.equal(refreshed.managerCalls.length, 1);
});

test('a fast new prompt can complete without ever showing a stop button', async t => {
  const notifier = loadNotifier(t, { networkAvailable: false });
  await notifier.advance(10000);
  notifier.setView({ userId: 'fast-user', userText: 'New question', answer: null });
  await notifier.advance(300);
  notifier.setView({ answer: 'Fast answer.', answerId: 'fast-answer' });
  await notifier.advance(4000);
  assert.equal(notifier.managerCalls.length, 1);
});

test('a rejected Web Locks request falls back without losing the notification', async t => {
  const notifier = loadNotifier(t, { locks: { request: () => Promise.reject(new Error('Locks unavailable')) }, view: { busy: true } });
  notifier.setView({ busy: false });
  await notifier.advance(4000);
  assert.equal(notifier.managerCalls.length, 1);
});

test('completed-chat history cannot evict an older unfinished run from recovery storage', async t => {
  const notifier = loadNotifier(t, { view: { busy: true } });
  for (let i = 0; i < 26; i += 1) {
    notifier.setView({ context: `/c/short-${i}`, userId: `short-user-${i}`, busy: true });
    await notifier.advance(200);
    notifier.setView({ busy: false, answerId: `short-answer-${i}`, answer: `Finished short task ${i}` });
    await notifier.advance(4000);
  }
  const count = notifier.managerCalls.length;
  notifier.setView({ context: '/c/example', userId: 'user-1', answer: 'The original long run finished.' });
  await notifier.advance(9000);
  assert.equal(notifier.managerCalls.length, count + 1);
  const saved = JSON.parse(notifier.session.getItem('kian-chatgpt-notifier.runs.v1'));
  assert.ok(saved.runs.length <= 24);
});

test('readable storage with rejected writes cannot wedge a later regeneration', async t => {
  const clock = new Clock(), local = new MemoryStorage();
  const first = loadNotifier(t, { clock, local, view: { busy: true } });
  first.setView({ busy: false });
  await first.advance(4000);
  first.close();
  const readOnly = { getItem: key => local.getItem(key), setItem() { throw new Error('Quota exceeded'); } };
  const next = loadNotifier(t, { clock, local: readOnly, view: { busy: true } });
  next.setView({ busy: false });
  await next.advance(5000);
  assert.equal(next.managerCalls.length, 1);
});
