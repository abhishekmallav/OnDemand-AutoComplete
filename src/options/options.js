
import { S as Storage } from '../../assets/storage.js';
import { e as escapeHtml, g as generateUuid } from '../../assets/utils.js';

let snippets = [];
let currentSettings = { triggerPrefix: '/', expansionDelay: 0, notifications: true, darkMode: false };
let editingSnippetId = null;
let deletingSnippetId = null;

// DOM references
const navItems = document.querySelectorAll('.nav-item');
const sections = document.querySelectorAll('.section');

// Snippet Management Elements
const snippetsTableEl = document.getElementById('snippets-table-body');
const snippetsEmptyEl = document.getElementById('snippets-empty-state');
const optionsSearchEl = document.getElementById('options-search');
const btnCreateSnippet = document.getElementById('btn-create-snippet');
const snippetCountBadgeEl = document.getElementById('snippet-count-badge');

// Modal Elements
const snippetModalEl = document.getElementById('snippet-modal');
const modalTitleEl = document.getElementById('modal-title');
const modalCloseBtn = document.getElementById('modal-close-btn');
const btnModalCancel = document.getElementById('btn-modal-cancel');
const btnModalSave = document.getElementById('btn-modal-save');
const snippetNameInput = document.getElementById('modal-snippet-name');
const snippetTriggerInput = document.getElementById('modal-snippet-trigger');
const snippetBodyInput = document.getElementById('modal-snippet-body');
const modalTriggerPrefixBadge = document.getElementById('modal-trigger-prefix');
const modalErrorEl = document.getElementById('modal-error');
const variableChips = document.querySelectorAll('.variable-chip');

// Delete Confirmation Elements
const deleteModalEl = document.getElementById('delete-modal');
const deleteSnippetNameEl = document.getElementById('delete-snippet-name');
const btnDeleteConfirm = document.getElementById('btn-delete-confirm');
const btnDeleteCancel = document.getElementById('btn-delete-cancel');

// Settings Elements
const settingPrefixEl = document.getElementById('setting-prefix');
const settingTriggerKeyEl = document.getElementById('setting-trigger-key');
const settingDelayEl = document.getElementById('setting-delay');
const settingNotificationsEl = document.getElementById('setting-notifications');
const settingDarkModeEl = document.getElementById('setting-darkmode');
const btnSaveSettingsEl = document.getElementById('btn-save-settings');
const settingsStatusEl = document.getElementById('settings-status');

// Import / Export Elements
const btnExportEl = document.getElementById('btn-export');
const btnImportEl = document.getElementById('btn-import');
const importFileInputEl = document.getElementById('import-file-input');
const importStatusEl = document.getElementById('import-status');

async function init() {
  await loadSettings();
  await loadSnippets();
  setupNavigation();
  setupEventListeners();
  handleUrlParams();
}

// ----------------------------------------------------------------------------
// Navigation & Theme
// ----------------------------------------------------------------------------

function setupNavigation() {
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const sectionId = item.dataset.section;
      switchSection(sectionId);
    });
  });
}

function switchSection(sectionId) {
  navItems.forEach(item => {
    item.classList.toggle('active', item.dataset.section === sectionId);
  });
  sections.forEach(sec => {
    sec.classList.toggle('active', sec.id === `section-${sectionId}`);
  });
  window.location.hash = sectionId;
}

function applyTheme(isDark) {
  if (isDark) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

// ----------------------------------------------------------------------------
// Snippet Table & Actions
// ----------------------------------------------------------------------------

async function loadSnippets() {
  try {
    snippets = await Storage.getSnippets();
    renderSnippetsTable(snippets);
  } catch (err) {
    console.error('Failed to load snippets:', err);
  }
}

function renderSnippetsTable(list) {
  const query = (optionsSearchEl.value || '').toLowerCase().trim();
  const filtered = query
    ? list.filter(item =>
        (item.name && item.name.toLowerCase().includes(query)) ||
        (item.trigger && item.trigger.toLowerCase().includes(query)) ||
        (item.body && item.body.toLowerCase().includes(query))
      )
    : list;

  if (snippetCountBadgeEl) {
    snippetCountBadgeEl.textContent = `${list.length} total`;
  }

  if (filtered.length === 0) {
    snippetsTableEl.innerHTML = '';
    snippetsEmptyEl.style.display = 'block';
    return;
  }

  snippetsEmptyEl.style.display = 'none';
  const prefix = currentSettings.triggerPrefix || '/';

  snippetsTableEl.innerHTML = filtered.map(item => {
    const displayTrigger = item.trigger.startsWith(prefix) ? item.trigger : `${prefix}${item.trigger}`;
    const preview = String(item.body || '').replace(/\s+/g, ' ').substring(0, 70);

    return `
      <tr data-id="${escapeHtml(item.id)}">
        <td><span class="trigger-badge">${escapeHtml(displayTrigger)}</span></td>
        <td><strong>${escapeHtml(item.name || 'Untitled')}</strong></td>
        <td><span class="snippet-table-preview">${escapeHtml(preview || '—')}</span></td>
        <td>
          <div class="row-actions">
            <button class="btn-table-action edit" data-id="${escapeHtml(item.id)}" title="Edit snippet">Edit</button>
            <button class="btn-table-action delete" data-id="${escapeHtml(item.id)}" title="Delete snippet">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Attach table button listeners
  snippetsTableEl.querySelectorAll('.btn-table-action.edit').forEach(btn => {
    btn.addEventListener('click', () => {
      openSnippetModal(btn.dataset.id);
    });
  });

  snippetsTableEl.querySelectorAll('.btn-table-action.delete').forEach(btn => {
    btn.addEventListener('click', () => {
      openDeleteConfirmation(btn.dataset.id);
    });
  });
}

// ----------------------------------------------------------------------------
// Snippet Modal Dialog (No window.prompt!)
// ----------------------------------------------------------------------------

function openSnippetModal(snippetId = null) {
  editingSnippetId = snippetId;
  modalErrorEl.style.display = 'none';
  modalErrorEl.textContent = '';

  const prefix = currentSettings.triggerPrefix || '/';
  if (modalTriggerPrefixBadge) {
    modalTriggerPrefixBadge.textContent = prefix;
  }

  if (snippetId) {
    const existing = snippets.find(s => s.id === snippetId);
    if (existing) {
      modalTitleEl.textContent = 'Edit Snippet';
      snippetNameInput.value = existing.name || '';
      // Strip trigger prefix if present for clean editing
      let trig = existing.trigger || '';
      if (prefix && trig.startsWith(prefix)) {
        trig = trig.slice(prefix.length);
      }
      snippetTriggerInput.value = trig;
      snippetBodyInput.value = existing.body || '';
    }
  } else {
    modalTitleEl.textContent = 'New Snippet';
    snippetNameInput.value = '';
    snippetTriggerInput.value = '';
    snippetBodyInput.value = '';
  }

  snippetModalEl.classList.add('open');
  snippetNameInput.focus();
}

function closeSnippetModal() {
  snippetModalEl.classList.remove('open');
  editingSnippetId = null;
}

async function saveModalSnippet() {
  const name = snippetNameInput.value.trim();
  let trigger = snippetTriggerInput.value.trim();
  const body = snippetBodyInput.value;

  if (!name) {
    showModalError('Please enter a snippet name.');
    snippetNameInput.focus();
    return;
  }

  if (!trigger) {
    showModalError('Please enter a trigger shortcut.');
    snippetTriggerInput.focus();
    return;
  }

  if (/\s/.test(trigger)) {
    showModalError('Trigger shortcut cannot contain spaces.');
    snippetTriggerInput.focus();
    return;
  }

  if (!body) {
    showModalError('Please enter the snippet expansion body.');
    snippetBodyInput.focus();
    return;
  }

  // Prepend prefix if needed
  const prefix = currentSettings.triggerPrefix || '/';
  if (prefix && !trigger.startsWith(prefix)) {
    trigger = `${prefix}${trigger}`;
  }

  const existing = editingSnippetId ? snippets.find(s => s.id === editingSnippetId) : null;
  const snippetData = {
    id: editingSnippetId || generateUuid(),
    name,
    trigger,
    body,
    useCount: existing ? (existing.useCount || 0) : 0,
    createdAt: existing ? existing.createdAt : Date.now(),
    updatedAt: Date.now()
  };

  try {
    await Storage.saveSnippet(snippetData);
    closeSnippetModal();
    await loadSnippets();
  } catch (err) {
    showModalError('Failed to save snippet: ' + err.message);
  }
}

function showModalError(msg) {
  modalErrorEl.textContent = msg;
  modalErrorEl.style.display = 'block';
}

function insertVariableChip(variableText) {
  const textarea = snippetBodyInput;
  const start = textarea.selectionStart || 0;
  const end = textarea.selectionEnd || 0;
  const text = textarea.value;

  textarea.value = text.substring(0, start) + variableText + text.substring(end);
  textarea.selectionStart = textarea.selectionEnd = start + variableText.length;
  textarea.focus();
}

// ----------------------------------------------------------------------------
// Delete Confirmation Dialog (DESIGN.md treatment)
// ----------------------------------------------------------------------------

function openDeleteConfirmation(snippetId) {
  const item = snippets.find(s => s.id === snippetId);
  if (!item) return;

  deletingSnippetId = snippetId;
  deleteSnippetNameEl.textContent = `"${item.name || item.trigger}"`;
  deleteModalEl.classList.add('open');
}

function closeDeleteConfirmation() {
  deleteModalEl.classList.remove('open');
  deletingSnippetId = null;
}

async function confirmDeleteSnippet() {
  if (!deletingSnippetId) return;
  try {
    await Storage.deleteSnippet(deletingSnippetId);
    closeDeleteConfirmation();
    await loadSnippets();
  } catch (err) {
    console.error('Failed to delete snippet:', err);
  }
}

// ----------------------------------------------------------------------------
// Settings Panel
// ----------------------------------------------------------------------------

async function loadSettings() {
  try {
    currentSettings = await Storage.getSettings();
    applyTheme(currentSettings.darkMode);

    if (settingPrefixEl) settingPrefixEl.value = currentSettings.triggerPrefix || '/';
    if (settingTriggerKeyEl) settingTriggerKeyEl.value = currentSettings.triggerKey || 'instant';
    if (settingDelayEl) settingDelayEl.value = currentSettings.expansionDelay || 0;
    if (settingNotificationsEl) settingNotificationsEl.checked = currentSettings.notifications !== false;
    if (settingDarkModeEl) settingDarkModeEl.checked = !!currentSettings.darkMode;
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

async function saveSettings() {
  const prefix = (settingPrefixEl.value || '/').trim();
  const triggerKey = settingTriggerKeyEl ? settingTriggerKeyEl.value : 'instant';
  const delay = Math.max(0, parseInt(settingDelayEl.value, 10) || 0);
  const notifications = settingNotificationsEl.checked;
  const darkMode = settingDarkModeEl.checked;

  currentSettings = {
    ...currentSettings,
    triggerPrefix: prefix,
    triggerKey,
    expansionDelay: delay,
    notifications,
    darkMode
  };

  try {
    await Storage.saveSettings(currentSettings);
    applyTheme(darkMode);
    renderSnippetsTable(snippets);

    settingsStatusEl.textContent = 'Settings saved successfully';
    settingsStatusEl.classList.add('visible');
    setTimeout(() => {
      settingsStatusEl.classList.remove('visible');
    }, 2500);
  } catch (err) {
    settingsStatusEl.textContent = 'Failed to save settings';
    settingsStatusEl.classList.add('visible');
  }
}

// ----------------------------------------------------------------------------
// Import / Export
// ----------------------------------------------------------------------------

async function exportSnippets() {
  try {
    const list = await Storage.getSnippets();
    const dataStr = JSON.stringify(list, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `OnDemand-AutoComplete${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    showImportStatus('Export failed: ' + err.message, true);
  }
}

async function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);

    if (!Array.isArray(parsed)) {
      showImportStatus('Import failed: File must contain a JSON array of snippets.', true);
      return;
    }

    let addedCount = 0;
    for (const item of parsed) {
      if (item && item.trigger && item.name && item.body) {
        await Storage.saveSnippet({
          id: item.id || generateUuid(),
          name: item.name,
          trigger: item.trigger,
          body: item.body,
          useCount: Number(item.useCount) || 0,
          createdAt: item.createdAt || Date.now(),
          updatedAt: Date.now()
        });
        addedCount++;
      }
    }

    await loadSnippets();
    showImportStatus(`Successfully imported ${addedCount} snippet${addedCount !== 1 ? 's' : ''}.`, false);
  } catch (err) {
    showImportStatus('Import failed: Invalid JSON file.', true);
  } finally {
    e.target.value = '';
  }
}

function showImportStatus(msg, isError) {
  importStatusEl.textContent = msg;
  importStatusEl.style.color = isError ? 'var(--error)' : 'var(--success)';
  importStatusEl.classList.add('visible');
  setTimeout(() => {
    importStatusEl.classList.remove('visible');
  }, 4000);
}

// ----------------------------------------------------------------------------
// URL Params & Event Listeners
// ----------------------------------------------------------------------------

function handleUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const hash = window.location.hash.replace('#', '');

  if (urlParams.get('section')) {
    switchSection(urlParams.get('section'));
  } else if (hash) {
    switchSection(hash);
  }

  if (urlParams.get('new') === 'true') {
    switchSection('snippets');
    openSnippetModal();
  } else if (urlParams.get('edit')) {
    switchSection('snippets');
    openSnippetModal(urlParams.get('edit'));
  }
}

function setupEventListeners() {
  // Search
  optionsSearchEl.addEventListener('input', () => {
    renderSnippetsTable(snippets);
  });

  // Create Snippet Button
  btnCreateSnippet.addEventListener('click', () => {
    openSnippetModal();
  });

  // Modal actions
  modalCloseBtn.addEventListener('click', closeSnippetModal);
  btnModalCancel.addEventListener('click', closeSnippetModal);
  btnModalSave.addEventListener('click', saveModalSnippet);

  snippetModalEl.addEventListener('click', (e) => {
    if (e.target === snippetModalEl) closeSnippetModal();
  });

  // Variable Chips
  variableChips.forEach(chip => {
    chip.addEventListener('click', () => {
      insertVariableChip(chip.dataset.var);
    });
  });

  // Delete modal actions
  btnDeleteCancel.addEventListener('click', closeDeleteConfirmation);
  btnDeleteConfirm.addEventListener('click', confirmDeleteSnippet);
  deleteModalEl.addEventListener('click', (e) => {
    if (e.target === deleteModalEl) closeDeleteConfirmation();
  });

  // Settings
  btnSaveSettingsEl.addEventListener('click', saveSettings);
  settingDarkModeEl.addEventListener('change', () => {
    applyTheme(settingDarkModeEl.checked);
  });

  // Import / Export
  btnExportEl.addEventListener('click', exportSnippets);
  btnImportEl.addEventListener('click', () => importFileInputEl.click());
  importFileInputEl.addEventListener('change', handleImportFile);

  // Keyboard shortcut to close modals
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (snippetModalEl.classList.contains('open')) closeSnippetModal();
      if (deleteModalEl.classList.contains('open')) closeDeleteConfirmation();
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
