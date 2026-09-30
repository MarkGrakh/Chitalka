/**
 * Модуль UI: экран загрузки, тосты, обработка ошибок.
 */
const UI = (function () {
  let toastContainer = null;

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  /* ---------- Toast-уведомления ---------- */

  function ensureToastContainer() {
    if (toastContainer && document.body.contains(toastContainer)) return toastContainer;
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
    return toastContainer;
  }

  function showToast(message, type = 'info', duration = 4000) {
    const container = ensureToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'error' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';
    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-text">${escapeHtml(message)}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-out');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /* ---------- Экран загрузки ---------- */

  function showLoading(message = 'Загрузка...') {
    let overlay = document.getElementById('loadingOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'loadingOverlay';
      overlay.className = 'loading-overlay';
      overlay.innerHTML = `
        <div class="loading-content">
          <div class="loading-logo">📚</div>
          <div class="loading-title">Читательский навигатор</div>
          <div class="loading-spinner"></div>
          <div class="loading-message" id="loadingMessage">${escapeHtml(message)}</div>
        </div>
      `;
      document.body.appendChild(overlay);
    }
    overlay.classList.add('visible');
    const msg = document.getElementById('loadingMessage');
    if (msg) msg.textContent = message;
  }

  function updateLoadingMessage(message) {
    const el = document.getElementById('loadingMessage');
    if (el) el.textContent = message;
  }

  function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;
    overlay.classList.remove('visible');
    setTimeout(() => {
      if (overlay.parentNode) overlay.remove();
    }, 400);
  }

  /* ---------- Фатальная ошибка ---------- */

  function showFatalError(message) {
    const main = document.querySelector('main.container') || document.body;
    main.innerHTML = `
      <div class="error-state">
        <div class="error-emoji">😔</div>
        <h1>Не удалось загрузить каталог</h1>
        <p>${escapeHtml(message || 'Произошла неизвестная ошибка.')}</p>
        <p class="muted">
          Проверьте соединение с интернетом и обновите страницу.<br>
          Если ошибка повторяется — сообщите администратору библиотеки.
        </p>
        <button onclick="location.reload()" class="btn btn-primary">Перезагрузить страницу</button>
      </div>
    `;
  }

  return { showToast, showLoading, updateLoadingMessage, hideLoading, showFatalError };
})();