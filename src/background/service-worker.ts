// src/background/service-worker.ts
// Sends TOGGLE to the active tab each time the toolbar icon is clicked.

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE' });
  } catch {
    // Tab may not have the content script yet (e.g. chrome:// pages). Ignore.
  }
});
