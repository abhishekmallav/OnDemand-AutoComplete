import { Storage, EXTENSION_NAME } from "./storage.js";

// Handle installation and updates
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    // console.log(`${EXTENSION_NAME} installed successfully.`);
    await Storage.initDefaults();
  } else if (details.reason === "update") {
    // console.log(`${EXTENSION_NAME} updated to version ${chrome.runtime.getManifest().version}`);
  }
});

// Central message listener for popup, options, and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.type) {
    case "GET_SNIPPETS":
      Storage.getSnippets().then(sendResponse);
      return true; // Keep message channel open for async response

    case "SAVE_SNIPPET":
      Storage.saveSnippet(request.payload).then(sendResponse);
      return true;

    case "DELETE_SNIPPET":
      Storage.deleteSnippet(request.payload.id).then(sendResponse);
      return true;

    case "GET_STATS":
      Storage.getUsageStats().then(sendResponse);
      return true;

    case "TRACK_USAGE":
      Storage.trackUsage(request.payload.snippetId).then(sendResponse);
      return true;

    default:
      console.warn("Unknown message type:", request.type);
  }
});

// Keyboard shortcut listener for opening the in-page snippet picker
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "open_snippet_picker") {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (activeTab && activeTab.id) {
      try {
        await chrome.tabs.sendMessage(activeTab.id, { type: "OPEN_SNIPPET_PICKER" });
      } catch (err) {
        // Ignored if tab has no content script (e.g., chrome:// pages or unrefreshed tabs)
      }
    }
  }
});
