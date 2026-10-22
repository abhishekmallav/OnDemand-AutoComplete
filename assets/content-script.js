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
let currentTheme = "light";
let lastActiveElement = null;

async function init() {
  await loadData();
  setupInputListeners();
  setupStorageListener();
  setupMessageListener();
  // console.log("[OnDemand AutoComplete] Content script active.");
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
    currentTheme = settings && settings.darkMode ? "dark" : "light";

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

    // If overlay picker is currently mounted, update its theme and prefix immediately
    if (activePickerOverlay) {
      activePickerOverlay.setAttribute("data-theme", currentTheme);
      const prefixEl = activePickerOverlay.querySelector("#tep-status-prefix");
      if (prefixEl) {
        prefixEl.textContent = triggerPrefix || "/";
      }
    }
  } catch (err) {
    console.error("[OnDemand AutoComplete] Failed to load data:", err);
  }
}

function setupStorageListener() {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
      if (changes.tep_snippets || changes.tep_settings) {
        loadData();
      }
      if (changes.tep_settings && changes.tep_settings.newValue) {
        const newSettings = changes.tep_settings.newValue;
        currentTheme = newSettings.darkMode ? "dark" : "light";
        if (activePickerOverlay) {
          activePickerOverlay.setAttribute("data-theme", currentTheme);
          const prefixEl = activePickerOverlay.querySelector("#tep-status-prefix");
          if (prefixEl && newSettings.triggerPrefix) {
            prefixEl.textContent = newSettings.triggerPrefix;
          }
        }
      }
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
  overlay.setAttribute("data-theme", currentTheme);

  const picker = document.createElement("div");
  picker.className = "tep-picker popup-container";

  picker.innerHTML = `
    <!-- Search Bar -->
    <div class="search-bar-wrap">
      <div class="search-container">
        <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          type="text"
          id="tep-search-input"
          class="search-input"
          placeholder="Search snippets or triggers..."
          autocomplete="off"
          spellcheck="false"
        />
        <button id="tep-clear-search" class="clear-search-btn" title="Clear search" aria-label="Clear search" style="display: none;">&times;</button>
      </div>
    </div>

    <!-- Snippet List Container -->
    <div id="tep-snippet-list" class="snippet-list-container" role="feed" aria-busy="false"></div>

    <!-- Footer -->
    <footer class="popup-footer">
      <span class="footer-count" id="tep-snippet-count">0 snippets</span>
      <div class="footer-right">
        <div class="footer-prefix-wrap">
          <span class="footer-prefix-label">Prefix</span>
          <span class="prefix-pill" id="tep-status-prefix">${escapeHtml(triggerPrefix || "/")}</span>
        </div>
        <div class="footer-hints">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> insert</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </footer>
  `;

  overlay.appendChild(picker);
  document.body.appendChild(overlay);
  activePickerOverlay = overlay;

  const searchInput = picker.querySelector("#tep-search-input");
  const clearSearchBtn = picker.querySelector("#tep-clear-search");
  const listEl = picker.querySelector("#tep-snippet-list");
  const countEl = picker.querySelector("#tep-snippet-count");
  let selectedIndex = 0;
  let filteredItems = [...snippetList];

  function updateCount(count) {
    if (countEl) {
      countEl.textContent = `${count} snippet${count !== 1 ? "s" : ""}`;
    }
  }

  function renderList() {
    listEl.innerHTML = "";
    if (filteredItems.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <h3>No matching snippets</h3>
          <p>Try another keyword or shortcut search.</p>
        </div>
      `;
      updateCount(0);
      return;
    }

    const prefix = triggerPrefix || "/";
    filteredItems.forEach((item, idx) => {
      const card = document.createElement("div");
      card.className = `snippet-card ${idx === selectedIndex ? "active" : ""}`;
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-label", `Insert ${item.name || item.trigger}`);

      const displayTrigger = item.trigger.startsWith(prefix)
        ? item.trigger
        : `${prefix}${item.trigger}`;
      const preview = String(item.body || "")
        .replace(/\s+/g, " ")
        .substring(0, 65);

      card.innerHTML = `
        <div class="snippet-header-row">
          <div class="snippet-meta-group">
            <span class="trigger-pill">${escapeHtml(displayTrigger)}</span>
            <span class="snippet-title">${escapeHtml(item.name || "Untitled")}</span>
          </div>
          <div class="snippet-actions-bar">
            <span class="action-btn" title="Press Enter or Click to insert">Insert <kbd>↵</kbd></span>
          </div>
        </div>
        <div class="snippet-preview">${escapeHtml(preview || "Empty snippet")}</div>
      `;

      card.addEventListener("click", () => {
        selectAndInsert(item);
      });

      card.addEventListener("mouseenter", () => {
        selectedIndex = idx;
        const currentActive = listEl.querySelector(".snippet-card.active");
        if (currentActive && currentActive !== card) {
          currentActive.classList.remove("active");
        }
        card.classList.add("active");
      });

      listEl.appendChild(card);
    });

    updateCount(filteredItems.length);
  }

  function selectAndInsert(snippet) {
    closeSnippetPickerModal();
    if (activeTarget && isEditable(activeTarget)) {
      activeTarget.focus();
      insertDirectSnippet(activeTarget, snippet);
    } else {
      // If no text control is active, copy to clipboard for convenience
      processSnippetText(snippet.body || "").then(({ text }) => {
        navigator.clipboard.writeText(text).then(() => {
          showMicroToast(`✓ Copied ${snippet.trigger} to clipboard`);
        }).catch(() => {});
      });
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
    } else if (target && target.isContentEditable) {
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

  function applyFilter(query) {
    const q = (query || "").toLowerCase().trim();
    if (clearSearchBtn) {
      clearSearchBtn.style.display = q ? "flex" : "none";
    }
    filteredItems = snippetList.filter(
      (s) =>
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.trigger && s.trigger.toLowerCase().includes(q)) ||
        (s.body && s.body.toLowerCase().includes(q)),
    );
    selectedIndex = 0;
    renderList();
  }

  searchInput.addEventListener("input", () => {
    applyFilter(searchInput.value);
  });

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener("click", () => {
      searchInput.value = "";
      applyFilter("");
      searchInput.focus();
    });
  }

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
  setTimeout(() => searchInput.focus(), 30);
}

function ensureVisible(listEl, index) {
  const items = listEl.querySelectorAll(".snippet-card");
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
