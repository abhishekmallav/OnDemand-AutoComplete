import { S as Storage } from '../../assets/storage.js';
import { e as escapeHtml } from '../../assets/utils.js';

let snippets = [];
let activeSettings = { triggerPrefix: '/', darkMode: false };
let confirmDeleteId = null;

// DOM Elements
const snippetListEl = document.getElementById('snippet-list');
const searchInputEl = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search');
const snippetCountEl = document.getElementById('snippet-count');
const statusPrefixEl = document.getElementById('status-prefix');
const toastEl = document.getElementById('toast-notice');
const btnNewSnippet = document.getElementById('btn-new-snippet');
const btnSettings = document.getElementById('btn-settings');

async function init() {
  await loadSettings();
  await loadSnippets();
  setupEventListeners();
}

async function loadSettings() {
  try {
    activeSettings = await Storage.getSettings();
    if (activeSettings.darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    const prefix = activeSettings.triggerPrefix || '/';
    if (statusPrefixEl) {
      statusPrefixEl.textContent = `Prefix: ${prefix}`;
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

async function loadSnippets() {
  try {
    snippets = await Storage.getSnippets();
    renderSnippets(snippets);
    updateCount(snippets.length);
  } catch (err) {
    console.error('Failed to load snippets:', err);
  }
}

function updateCount(count) {
  if (snippetCountEl) {
    snippetCountEl.textContent = `${count} snippet${count !== 1 ? 's' : ''}`;
  }
}

function renderSnippets(list) {
  snippetListEl.innerHTML = '';
  confirmDeleteId = null;

  if (list.length === 0) {
    const isSearching = searchInputEl.value.trim().length > 0;
    snippetListEl.innerHTML = `
      <div class="empty-state">
        <h3>${isSearching ? 'No matching snippets' : 'No snippets yet'}</h3>
        <p>${isSearching ? 'Try another keyword or shortcut search.' : 'Create your first text shortcut to get started.'}</p>
        ${!isSearching ? '<button class="empty-btn" id="btn-empty-new">+ Create Snippet</button>' : ''}
      </div>
    `;
    const emptyBtn = document.getElementById('btn-empty-new');
    if (emptyBtn) {
      emptyBtn.addEventListener('click', () => openOptionsPage('new=true'));
    }
    return;
  }

  const prefix = activeSettings.triggerPrefix || '/';

  list.forEach(item => {
    // If inline confirmation is pending for this snippet, render confirmation
    if (confirmDeleteId === item.id) {
      const confirmEl = document.createElement('div');
      confirmEl.className = 'inline-confirm-panel';
      confirmEl.innerHTML = `
        <div class="confirm-text">Delete "${escapeHtml(item.name || item.trigger)}"?</div>
        <div class="confirm-actions">
          <button class="confirm-cancel-btn" type="button">Cancel</button>
          <button class="confirm-delete-btn" type="button">Delete</button>
        </div>
      `;
      confirmEl.querySelector('.confirm-cancel-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        confirmDeleteId = null;
        renderSnippets(filterSnippets(searchInputEl.value));
      });
      confirmEl.querySelector('.confirm-delete-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        await deleteSnippet(item.id);
      });
      snippetListEl.appendChild(confirmEl);
      return;
    }

    const card = document.createElement('div');
    card.className = 'snippet-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Copy ${item.name || item.trigger}`);

    const displayTrigger = item.trigger.startsWith(prefix) ? item.trigger : `${prefix}${item.trigger}`;
    const preview = String(item.body || '').replace(/\s+/g, ' ').substring(0, 65);

    card.innerHTML = `
      <div class="snippet-header-row">
        <div class="snippet-meta-group">
          <span class="trigger-pill">${escapeHtml(displayTrigger)}</span>
          <span class="snippet-title">${escapeHtml(item.name || 'Untitled')}</span>
        </div>
        <div class="snippet-actions-bar">
          <button class="action-btn copy-btn" title="Copy to clipboard" aria-label="Copy to clipboard">Copy</button>
          <button class="action-btn edit-btn" title="Edit snippet" aria-label="Edit snippet">Edit</button>
          <button class="action-btn delete-btn" title="Delete snippet" aria-label="Delete snippet">Del</button>
        </div>
      </div>
      <div class="snippet-preview">${escapeHtml(preview || 'Empty snippet')}</div>
    `;

    // Click anywhere on card -> Copy to clipboard
    card.addEventListener('click', (e) => {
      if (e.target.closest('.snippet-actions-bar')) return;
      copySnippet(item);
    });

    card.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('.snippet-actions-bar')) {
        e.preventDefault();
        copySnippet(item);
      }
    });

    // Copy action
    card.querySelector('.copy-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      copySnippet(item);
    });

    // Edit action -> opens options page focused on editing this snippet
    card.querySelector('.edit-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openOptionsPage(`edit=${encodeURIComponent(item.id)}`);
    });

    // Delete action -> triggers inline confirmation panel
    card.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      confirmDeleteId = item.id;
      renderSnippets(filterSnippets(searchInputEl.value));
    });

    snippetListEl.appendChild(card);
  });
}

function filterSnippets(query) {
  const q = (query || '').toLowerCase().trim();
  if (!q) return snippets;
  return snippets.filter(item => 
    (item.name && item.name.toLowerCase().includes(q)) ||
    (item.trigger && item.trigger.toLowerCase().includes(q)) ||
    (item.body && item.body.toLowerCase().includes(q))
  );
}

async function copySnippet(snippet) {
  try {
    await navigator.clipboard.writeText(snippet.body || '');
    showToast('Copied to clipboard!');
  } catch (err) {
    showToast('Failed to copy');
  }
}

async function deleteSnippet(id) {
  try {
    await Storage.deleteSnippet(id);
    snippets = snippets.filter(item => item.id !== id);
    confirmDeleteId = null;
    renderSnippets(filterSnippets(searchInputEl.value));
    updateCount(snippets.length);
    showToast('Snippet deleted');
  } catch (err) {
    showToast('Failed to delete');
  }
}

let toastTimer = null;
function showToast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('visible');
  }, 1800);
}

function openOptionsPage(params = '') {
  const url = chrome.runtime.getURL(`src/options/options.html${params ? '?' + params : ''}`);
  if (chrome.tabs && chrome.tabs.create) {
    chrome.tabs.create({ url });
  } else {
    window.open(url, '_blank');
  }
}

function setupEventListeners() {
  searchInputEl.addEventListener('input', (e) => {
    const val = e.target.value;
    clearSearchBtn.style.display = val ? 'flex' : 'none';
    const filtered = filterSnippets(val);
    renderSnippets(filtered);
    updateCount(filtered.length);
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInputEl.value = '';
    clearSearchBtn.style.display = 'none';
    renderSnippets(snippets);
    updateCount(snippets.length);
    searchInputEl.focus();
  });

  if (btnNewSnippet) {
    btnNewSnippet.addEventListener('click', () => openOptionsPage('new=true'));
  }

  if (btnSettings) {
    btnSettings.addEventListener('click', () => openOptionsPage('section=settings'));
  }
}

document.addEventListener('DOMContentLoaded', init);
