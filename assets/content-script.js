import { S as Storage } from "./storage.js";
import { d as debounce, e as escapeHtml } from "./utils.js";

function findTriggerWithPrefix(text, prefix) {
  if (!text || !prefix) return null;
  const idx = text.lastIndexOf(prefix);
  if (idx === -1) return null;
  const word = text.substring(idx + prefix.length);
  return !word || /\s/.test(word) ? null : word;
}

function findLastWord(text) {
  const match = /(\S+)$/.exec(text || "");
  return match ? match[1] : null;
}

function evaluateDynamicPlaceholders(body, options = {}) {
  let result = body;
  const now = new Date();
  const placeholders = {
    "{{date}}": now.toLocaleDateString(),
    "{{time}}": now.toLocaleTimeString(),
    "{{datetime}}": now.toLocaleString(),
    "{{clipboard}}": options.clipboard || "",
    "{{day}}": now.toLocaleDateString("en-US", { weekday: "long" }),
    "{{month}}": now.toLocaleDateString("en-US", { month: "long" }),
    "{{year}}": now.getFullYear().toString(),
    ...options.custom,
  };
  for (const [key, val] of Object.entries(placeholders)) {
    result = result.replaceAll(key, val);
  }
  return result;
}

const CURSOR_TAG = "{{cursor}}";
let snippetMap = new Map();
let snippetList = [];
let triggerPrefix = "/";
let triggerMode = "instant"; // "instant" | "tab" | "space" | "enter"
let showNotifications = true;
let lastActiveElement = null;

async function init() {
  await loadData();
  setupInputListeners();
  setupStorageListener();
  setupMessageListener();
  console.log("[OnDemand AutoComplete] Content script active.");
}

async function loadData() {
  try {
    const [snippets, settings] = await Promise.all([
      Storage.getSnippets(),
      Storage.getSettings().catch(() => ({})),
    ]);
    snippetList = snippets || [];
    triggerPrefix =
      settings && typeof settings.triggerPrefix === "string"
        ? settings.triggerPrefix.trim()
        : "/";
    triggerMode =
      settings && settings.triggerKey ? settings.triggerKey : "instant";
    showNotifications = settings && settings.notifications !== false;

    snippetMap.clear();
    snippetList
      .filter((s) => s && s.trigger && s.enabled !== false)
      .forEach((s) => {
        const key =
          triggerPrefix &&
          s.trigger.length > triggerPrefix.length &&
          s.trigger.startsWith(triggerPrefix)
            ? s.trigger.slice(triggerPrefix.length)
            : s.trigger;
        snippetMap.set(key, s);
      });
  } catch (err) {
    console.error("[OnDemand AutoComplete] Failed to load data:", err);
  }
}

function setupStorageListener() {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.tep_snippets || changes.tep_settings)) {
      loadData();
    }
  });
}

function setupInputListeners() {
  // Listen for typing events (instant trigger)
  document.addEventListener("input", debounce(handleInput, 30), true);

  // Listen for keydown events (shortcut triggers & Tab / Space / Enter trigger keys)
  document.addEventListener("keydown", handleKeyDown, true);

  // Track focused element for in-page picker
  document.addEventListener(
    "focusin",
    (e) => {
      if (isEditable(e.target)) {
        lastActiveElement = e.target;
      }
    },
    true,
  );
}

function isEditable(el) {
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || el.isContentEditable;
}

function getDeepActiveElement() {
  let el = document.activeElement;
  while (el && el.shadowRoot && el.shadowRoot.activeElement) {
    el = el.shadowRoot.activeElement;
  }
  return el;
}

function isTextControl(el) {
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea";
}

function getTextBeforeCaret(el) {
  if (isTextControl(el)) {
    const pos = el.selectionStart;
    return pos == null ? "" : el.value.substring(0, pos);
  }
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return "";
  const range = sel.getRangeAt(0);
  const node = range.startContainer;
  return node.nodeType === Node.TEXT_NODE
    ? (node.textContent || "").substring(0, range.startOffset)
    : "";
}

async function handleInput(e) {
  if (triggerMode !== "instant") return;
  if (e.isComposing || e.keyCode === 229) return;

  const target = getEventTarget(e);
  if (!target || !isEditable(target)) return;

  const textBefore = getTextBeforeCaret(target);
  if (!textBefore) return;

  const matchKey = triggerPrefix
    ? findTriggerWithPrefix(textBefore, triggerPrefix)
    : findLastWord(textBefore);
  if (matchKey && snippetMap.has(matchKey)) {
    await expandSnippet(target, matchKey, snippetMap.get(matchKey));
  }
}

async function handleKeyDown(e) {
  const target = getEventTarget(e);

  // Keyboard shortcut: Alt+X to open in-page picker or expand immediately
  if (
    e.altKey &&
    (e.key === "x" || e.key === "X") &&
    !e.ctrlKey &&
    !e.metaKey
  ) {
    e.preventDefault();
    if (isEditable(target)) {
      const textBefore = getTextBeforeCaret(target);
      const matchKey = triggerPrefix
        ? findTriggerWithPrefix(textBefore, triggerPrefix)
        : findLastWord(textBefore);
      if (matchKey && snippetMap.has(matchKey)) {
        await expandSnippet(target, matchKey, snippetMap.get(matchKey));
        return;
      }
    }
    openSnippetPickerModal(target);
    return;
  }

  // Key-press triggers: Tab, Space, or Enter (when configured in settings)
  if (
    triggerMode === "tab" &&
    e.key === "Tab" &&
    !e.shiftKey &&
    !e.ctrlKey &&
    !e.altKey
  ) {
    if (isEditable(target)) {
      const textBefore = getTextBeforeCaret(target);
      const matchKey = triggerPrefix
        ? findTriggerWithPrefix(textBefore, triggerPrefix)
        : findLastWord(textBefore);
      if (matchKey && snippetMap.has(matchKey)) {
        e.preventDefault();
        await expandSnippet(target, matchKey, snippetMap.get(matchKey));
        return;
      }
    }
  }

  if (triggerMode === "space" && e.key === " " && !e.ctrlKey && !e.altKey) {
    if (isEditable(target)) {
      const textBefore = getTextBeforeCaret(target);
      const matchKey = triggerPrefix
        ? findTriggerWithPrefix(textBefore, triggerPrefix)
        : findLastWord(textBefore);
      if (matchKey && snippetMap.has(matchKey)) {
        e.preventDefault();
        await expandSnippet(target, matchKey, snippetMap.get(matchKey));
        return;
      }
    }
  }

  if (
    triggerMode === "enter" &&
    e.key === "Enter" &&
    !e.shiftKey &&
    !e.ctrlKey &&
    !e.altKey
  ) {
    if (isEditable(target)) {
      const textBefore = getTextBeforeCaret(target);
      const matchKey = triggerPrefix
        ? findTriggerWithPrefix(textBefore, triggerPrefix)
        : findLastWord(textBefore);
      if (matchKey && snippetMap.has(matchKey)) {
        e.preventDefault();
        await expandSnippet(target, matchKey, snippetMap.get(matchKey));
        return;
      }
    }
  }
}

function getEventTarget(e) {
  const path = typeof e.composedPath === "function" ? e.composedPath() : null;
  let target = path && path[0] ? path[0] : e.target;
  if (!isEditable(target)) {
    target = getDeepActiveElement();
  }
  return target;
}

async function processSnippetText(body) {
  let clipboardText = "";
  if (body.includes("{{clipboard}}")) {
    try {
      clipboardText = await navigator.clipboard.readText();
    } catch {
      clipboardText = "";
    }
  }
  let evaluated = evaluateDynamicPlaceholders(body, {
    clipboard: clipboardText,
  });
  let caretPos = -1;
  const cursorIdx = evaluated.indexOf(CURSOR_TAG);
  if (cursorIdx !== -1) {
    caretPos = cursorIdx;
    evaluated = evaluated.replace(CURSOR_TAG, "");
  }
  return { text: evaluated, caret: caretPos };
}

async function expandSnippet(target, triggerKey, snippet) {
  const fullTrigger = triggerPrefix + triggerKey;
  const { text, caret } = await processSnippetText(snippet.body || "");

  if (isTextControl(target)) {
    const end = target.selectionStart;
    const start = end - fullTrigger.length;
    if (start < 0) return;

    target.setRangeText(text, start, end, "end");
    const newPos = caret >= 0 ? start + caret : start + text.length;
    target.selectionStart = target.selectionEnd = newPos;
    target.dispatchEvent(new InputEvent("input", { bubbles: true }));
  } else {
    // ContentEditable
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      for (let i = 0; i < fullTrigger.length; i++) {
        sel.modify("extend", "backward", "character");
      }
      document.execCommand("insertText", false, text);
    }
  }

  // Trigger subtle animation effect!
  triggerExpansionAnimation(target, fullTrigger);

  // Track usage
  try {
    chrome.runtime.sendMessage({
      type: "TRACK_USAGE",
      payload: { snippetId: snippet.id },
    });
  } catch {}
}

// ----------------------------------------------------------------------------
// Subtle Animation on Expansion
// ----------------------------------------------------------------------------

function triggerExpansionAnimation(target, triggerLabel) {
  // 1. Element subtle glow/pulse animation
  if (target && target.classList) {
    target.classList.remove("tep-expanded-pulse");
    // Trigger DOM reflow to restart animation if multiple expansions happen rapidly
    void target.offsetWidth;
    target.classList.add("tep-expanded-pulse");
    setTimeout(() => {
      target.classList.remove("tep-expanded-pulse");
    }, 600);
  }

  // 2. Subtle micro-toast feedback indicator
  if (showNotifications) {
    showMicroToast(`✓ Expanded ${triggerLabel}`);
  }
}

let toastTimeout = null;
function showMicroToast(message) {
  let toast = document.getElementById("tep-expansion-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "tep-expansion-toast";
    toast.className = "tep-expansion-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("visible");

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove("visible");
  }, 1400);
}

// ----------------------------------------------------------------------------
// In-Page Spotlight Snippet Picker (Triggered via Shortcut or Context Menu)
// ----------------------------------------------------------------------------

let activePickerOverlay = null;

function openSnippetPickerModal(targetEl) {
  if (activePickerOverlay) {
    closeSnippetPickerModal();
    return;
  }

  const activeTarget = isEditable(targetEl)
    ? targetEl
    : lastActiveElement || getDeepActiveElement();

  const overlay = document.createElement("div");
  overlay.className = "tep-overlay";

  const picker = document.createElement("div");
  picker.className = "tep-picker";

  picker.innerHTML = `
    <div class="tep-picker-header">
      <input type="text" class="tep-picker-search" placeholder="Type to search snippets..." autocomplete="off" spellcheck="false" />
    </div>
    <div class="tep-picker-list"></div>
    <div class="tep-picker-footer">
      <span>Use <kbd>↑</kbd> <kbd>↓</kbd> to navigate, <kbd>Enter</kbd> to insert</span>
      <span><kbd>Esc</kbd> to close</span>
    </div>
  `;

  overlay.appendChild(picker);
  document.body.appendChild(overlay);
  activePickerOverlay = overlay;

  const searchInput = picker.querySelector(".tep-picker-search");
  const listEl = picker.querySelector(".tep-picker-list");
  let selectedIndex = 0;
  let filteredItems = [...snippetList];

  function renderList() {
    listEl.innerHTML = "";
    if (filteredItems.length === 0) {
      listEl.innerHTML = `<div style="padding: 20px; text-align: center; color: #5D6B7D; font-size: 13px;">No matching snippets</div>`;
      return;
    }
    filteredItems.forEach((item, idx) => {
      const itemEl = document.createElement("div");
      itemEl.className = `tep-picker-item ${idx === selectedIndex ? "active" : ""}`;
      const prefix = triggerPrefix || "/";
      const displayTrigger = item.trigger.startsWith(prefix)
        ? item.trigger
        : `${prefix}${item.trigger}`;
      const preview = String(item.body || "")
        .replace(/\s+/g, " ")
        .substring(0, 45);

      itemEl.innerHTML = `
        <div class="tep-picker-item-left">
          <span class="tep-picker-trigger">${escapeHtml(displayTrigger)}</span>
          <span class="tep-picker-name">${escapeHtml(item.name || "Untitled")}</span>
        </div>
        <span class="tep-picker-preview">${escapeHtml(preview)}</span>
      `;

      itemEl.addEventListener("click", () => {
        selectAndInsert(item);
      });
      listEl.appendChild(itemEl);
    });
  }

  function selectAndInsert(snippet) {
    closeSnippetPickerModal();
    if (activeTarget && isEditable(activeTarget)) {
      activeTarget.focus();
      insertDirectSnippet(activeTarget, snippet);
    }
  }

  async function insertDirectSnippet(target, snippet) {
    const { text, caret } = await processSnippetText(snippet.body || "");
    if (isTextControl(target)) {
      const start = target.selectionStart || 0;
      const end = target.selectionEnd || 0;
      target.setRangeText(text, start, end, "end");
      const newPos = caret >= 0 ? start + caret : start + text.length;
      target.selectionStart = target.selectionEnd = newPos;
      target.dispatchEvent(new InputEvent("input", { bubbles: true }));
    } else {
      document.execCommand("insertText", false, text);
    }
    triggerExpansionAnimation(target, snippet.trigger);
    try {
      chrome.runtime.sendMessage({
        type: "TRACK_USAGE",
        payload: { snippetId: snippet.id },
      });
    } catch {}
  }

  searchInput.addEventListener("input", () => {
    const q = searchInput.value.toLowerCase().trim();
    filteredItems = snippetList.filter(
      (s) =>
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.trigger && s.trigger.toLowerCase().includes(q)) ||
        (s.body && s.body.toLowerCase().includes(q)),
    );
    selectedIndex = 0;
    renderList();
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (filteredItems.length > 0) {
        selectedIndex = (selectedIndex + 1) % filteredItems.length;
        renderList();
        ensureVisible(listEl, selectedIndex);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (filteredItems.length > 0) {
        selectedIndex =
          (selectedIndex - 1 + filteredItems.length) % filteredItems.length;
        renderList();
        ensureVisible(listEl, selectedIndex);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        selectAndInsert(filteredItems[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeSnippetPickerModal();
    }
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closeSnippetPickerModal();
    }
  });

  renderList();
  searchInput.focus();
}

function ensureVisible(listEl, index) {
  const items = listEl.querySelectorAll(".tep-picker-item");
  if (items[index]) {
    items[index].scrollIntoView({ block: "nearest" });
  }
}

function closeSnippetPickerModal() {
  if (activePickerOverlay) {
    activePickerOverlay.remove();
    activePickerOverlay = null;
  }
}

function setupMessageListener() {
  chrome.runtime.onMessage.addListener((msg) => {
    switch (msg.type) {
      case "SNIPPETS_UPDATED":
        loadData();
        break;
      case "OPEN_SNIPPET_PICKER":
        openSnippetPickerModal(lastActiveElement || getDeepActiveElement());
        break;
    }
  });
}

init();
