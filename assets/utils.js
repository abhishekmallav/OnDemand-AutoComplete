/**
 * Generate a unique UUID identifier
 */
function generateUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const r = (Math.random() * 16) | 0;
    return (char === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Debounce a function call by specified milliseconds
 */
function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Escape HTML to prevent XSS in dynamic previews
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Export original names and aliases for backwards compatibility
export {
  debounce as d,
  escapeHtml as e,
  generateUuid as g,
  debounce,
  escapeHtml,
  generateUuid
};
