# ChatGPT Completion Notifier

A loud completion chime and desktop notification for ChatGPT, with recovery after refreshing an active conversation. This fork is maintained under [KianBahasadri/ChatGPT-Response-Complete-Notifier](https://github.com/KianBahasadri/ChatGPT-Response-Complete-Notifier), based on [ramhaidar's project](https://github.com/ramhaidar/ChatGPT-Response-Complete-Notifier).

[Install or update the userscript](https://raw.githubusercontent.com/KianBahasadri/ChatGPT-Response-Complete-Notifier/main/userscript/chatgpt-answer-notifier.user.js).

## Install and check

1. Install Tampermonkey or Violentmonkey in your browser.
2. Open the userscript link above and confirm the installation or update. Accept its notification grant if your manager requests it.
3. Reload ChatGPT and click or type inside the page once to enable audio.
4. Open your userscript manager's menu on ChatGPT and choose **Test sound + notification**.

The current userscript version is **1.3.0**. Its installation, update, homepage, and support URLs point to this fork. Keep the same installed copy when updating; enabling an additional old notifier can produce extra alerts.

## Recovery and completion detection

The userscript observes the current conversation's rendered state. A visible generation control or streaming marker arms the latest user prompt. Once generation ends, it waits for the corresponding answer to stop changing before notifying. Fresh conversation-resource completion events are additional hints; they are not required for reload recovery.

Pending runs are recorded before completion, so refreshing does not discard their tracking. After a refresh, the script waits for the page to settle, reconnects the saved pending prompt, and can notify even if the answer finished while the page was reloading. Opening an already-finished chat without pending state does not create a historical alert.

Recovery also handles temporary message IDs being replaced, assignment of a new conversation URL, and back/forward restoration. Long jobs are not subject to the previous ten-minute timeout. Manual Stop clicks and explicit error markers suppress success alerts; a later retry can still notify normally.

A document observer catches UI changes, and a periodic fallback catches missed updates. The script does not wrap ChatGPT's fetch function, capture request bodies, or clear the page's resource-timing buffer.

## Sound and desktop notifications

The chime is generated locally: two ascending three-note bursts over roughly 1.8 seconds. Every note has its own envelope with a 0.70 peak amplitude, so later notes do not fade into near silence. No sound file is downloaded.

Desktop notifications use the manager's **GM_notification** API. That channel does not depend on ChatGPT's website notification permission. If the manager API fails, an already-permitted website notification is used. If both channels are unavailable, the script shows an on-page warning with permission guidance.

Audio initialization cannot hold up the desktop alert indefinitely. If audio remains blocked, the script requests the normal notification sound and avoids playing a delayed custom chime after you return to the page.

## Duplicate suppression and saved state

Completed responses are remembered across reloads. A regeneration, or a different prompt with the same answer text, can still generate a fresh notification.

Tabs share bounded delivery receipts. Web Locks serialize short bookkeeping operations when available; a short-lived ownership claim provides best-effort duplicate suppression otherwise. A reload that interrupts delivery can recover after its abandoned claim expires. Browser locks are never held while waiting for audio or a notification to be dismissed.

The script saves only conversation/message identifiers, prompt/answer fingerprints, timestamps, and delivery status. It does not persist prompt or answer text. Pending state uses this tab's session storage; cross-tab receipts use local storage on ChatGPT's origin. State expires after 48 hours, with at most 24 conversation records and 128 receipts retained. Unfinished runs are prioritized over finished history. If storage is unavailable or full, normal alerts continue with in-memory state, with reduced recovery or cross-tab guarantees.

## Controls

- **Test sound + notification** checks both alert channels.
- **Recheck running response** immediately scans the current conversation again.
- **Log prompt-bound status** prints the version, pending-run count, storage availability, audio state, and notification channel to the local console. It does not log the content of your chats.

## Practical limits

Keep the agent conversation open in a tab. Refreshing that tab is supported. If you switch to a different conversation in the same tab, the previous run is remembered and checked when you return; keep separate conversations in separate tabs to observe them concurrently.

A userscript cannot keep running after every relevant tab is closed, the browser is exited, or the browser fully suspends the page. A suspended page checks again when it resumes. Notification delivery still depends on Firefox/browser and operating-system notification settings, including Do Not Disturb. After a refresh, autoplay rules may require another click or keystroke before the custom chime can play; the desktop notification path does not wait for that gesture.

ChatGPT's DOM can change. The tests exercise known structural patterns and failure paths, and the menu test lets you verify actual sound and desktop delivery on your machine.

## Validation

Run:

```sh
node --test tests/userscript.test.cjs
```

The 38 deterministic regression tests simulate DOM updates, reloads, storage, notifications, browser lifecycle events, and audio scheduling. They cover recovery during and after reload, background completion, duplicate tabs, manual Stop, retries, long jobs, navigation, partial errors, optimistic IDs, storage failures, stale delivery claims, and blocked audio.

## Repository contents

- `userscript/chatgpt-answer-notifier.user.js`: the maintained userscript.
- `userscript/chatgpt-answer-notifier.meta.js`: its matching metadata header for update checks. Bump both metadata and code versions together.
- `tests/userscript.test.cjs` and `tests/notifier-harness.cjs`: regression tests and deterministic browser-API fixtures.
- `extension/`: the original Chromium Manifest V3 extension. The 1.3.0 recovery changes described above apply to the userscript; the separate extension retains its upstream implementation.
- `LICENSE`: the project's license.

The Chromium extension supports manual source installation through **Load unpacked** on Chromium 116+ browsers. There is no Firefox extension package here; Firefox users should use the userscript with a compatible manager. This project is distributed through source/manual installation rather than extension stores.

No backend, telemetry, or external analytics service is added. Notification previews are read locally and passed to the browser/OS notification system. Not affiliated with or endorsed by OpenAI.
