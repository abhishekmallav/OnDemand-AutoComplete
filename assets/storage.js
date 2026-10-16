const EXTENSION_NAME = "OnDemand AutoComplete ";
const CONTEXT_MENU_ID = "ondemand-autocomplete-insert";

const STORAGE_KEYS = {
  SNIPPETS: "tep_snippets",
  FOLDERS: "tep_folders",
  SETTINGS: "tep_settings",
  STATS: "tep_stats"
};

const DEFAULT_SETTINGS = {
  triggerPrefix: "/",
  expansionDelay: 0,
  triggerKey: "instant",
  notifications: true,
  darkMode: false,
  soundEnabled: false,
  autoBackup: false
};

const DEFAULT_SNIPPETS = [
  {
    id: "init-1",
    name: "Email Signature",
    trigger: "/sig",
    body: "Best regards,\n{{cursor}}",
    useCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: "init-2",
    name: "Current Date",
    trigger: "/date",
    body: "{{date}}",
    useCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
];

class Storage {
  /**
   * Initialize default settings and snippets if not already set
   */
  static async initDefaults() {
    const cur = await chrome.storage.local.get(null);
    if (!cur[STORAGE_KEYS.SNIPPETS]) {
      await chrome.storage.local.set({
        [STORAGE_KEYS.SNIPPETS]: DEFAULT_SNIPPETS,
        [STORAGE_KEYS.FOLDERS]: [],
        [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS,
        [STORAGE_KEYS.STATS]: {
          totalExpansions: 0,
          snippetUsage: {}
        }
      });
    }
  }

  /**
   * Get all snippets from storage
   */
  static async getSnippets() {
    const data = await chrome.storage.local.get(STORAGE_KEYS.SNIPPETS);
    return data[STORAGE_KEYS.SNIPPETS] || [];
  }

  /**
   * Save or update a snippet
   */
  static async saveSnippet(snippet) {
    const snippets = await this.getSnippets();
    const index = snippets.findIndex((s) => s.id === snippet.id);

    if (index >= 0) {
      snippets[index] = { ...snippets[index], ...snippet, updatedAt: Date.now() };
    } else {
      snippet.createdAt = snippet.createdAt || Date.now();
      snippet.updatedAt = Date.now();
      snippets.push(snippet);
    }

    await chrome.storage.local.set({ [STORAGE_KEYS.SNIPPETS]: snippets });
    return snippet;
  }

  /**
   * Delete a snippet by ID
   */
  static async deleteSnippet(id) {
    const snippets = await this.getSnippets();
    const filtered = snippets.filter((s) => s.id !== id);
    await chrome.storage.local.set({ [STORAGE_KEYS.SNIPPETS]: filtered });
    return true;
  }

  /**
   * Get all folders
   */
  static async getFolders() {
    const data = await chrome.storage.local.get(STORAGE_KEYS.FOLDERS);
    return data[STORAGE_KEYS.FOLDERS] || [];
  }

  /**
   * Save or update a folder
   */
  static async saveFolder(folder) {
    const folders = await this.getFolders();
    const index = folders.findIndex((f) => f.id === folder.id);

    if (index >= 0) {
      folders[index] = { ...folders[index], ...folder };
    } else {
      folders.push(folder);
    }

    await chrome.storage.local.set({ [STORAGE_KEYS.FOLDERS]: folders });
    return folder;
  }

  /**
   * Get current settings with defaults fallback
   */
  static async getSettings() {
    const data = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    return { ...DEFAULT_SETTINGS, ...(data[STORAGE_KEYS.SETTINGS] || {}) };
  }

  /**
   * Save settings
   */
  static async saveSettings(settings) {
    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
  }

  /**
   * Get usage stats
   */
  static async getUsageStats() {
    const data = await chrome.storage.local.get(STORAGE_KEYS.STATS);
    return data[STORAGE_KEYS.STATS] || { totalExpansions: 0, snippetUsage: {} };
  }

  /**
   * Increment usage count for a snippet
   */
  static async trackUsage(snippetId) {
    const stats = await this.getUsageStats();
    stats.totalExpansions += 1;
    stats.snippetUsage[snippetId] = (stats.snippetUsage[snippetId] || 0) + 1;
    await chrome.storage.local.set({ [STORAGE_KEYS.STATS]: stats });
  }
}

// Exports with aliases for backwards compatibility
export {
  CONTEXT_MENU_ID as C,
  EXTENSION_NAME as E,
  Storage as S,
  STORAGE_KEYS as a,
  Storage,
  STORAGE_KEYS,
  DEFAULT_SETTINGS,
  EXTENSION_NAME
};
