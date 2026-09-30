/**
 * Авторизация библиотекаря (клиентская, для прототипа).
 * Пароль хранится в виде SHA-256 хэша.
 *
 * Демо-доступ:
 *   логин: admin
 *   пароль: library2026
 *
 * ВАЖНО: перед login() обязательно вызвать init().
 */
const Auth = (function () {
  const SESSION_KEY = 'librarian_session';
  const USERS = {}; // логин -> SHA-256(пароль)

  async function sha256(text) {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error(
        'Web Crypto API недоступен. Откройте страницу через http://localhost ' +
        'или https://, а не через file://'
      );
    }
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Инициализация: заполняет USERS хэшами.
   * Вызывать один раз при загрузке страницы.
   */
  async function init() {
    try {
      USERS['admin'] = await sha256('library2026');
      console.log('Auth: готов. Доступен логин "admin".');
      return true;
    } catch (e) {
      console.error('Auth.init: ошибка', e);
      return false;
    }
  }

  async function login(username, password) {
    if (!username || !password) return false;

    // Если USERS пуст — инициализируем на лету (на всякий случай)
    if (Object.keys(USERS).length === 0) {
      const ok = await init();
      if (!ok) return false;
    }

    let hash;
    try {
      hash = await sha256(password);
    } catch (e) {
      console.error('Auth.login: не удалось вычислить хэш', e);
      return false;
    }

    if (USERS[username] && USERS[username] === hash) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        username,
        loginAt: Date.now()
      }));
      return true;
    }
    return false;
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function isLoggedIn() {
    return !!sessionStorage.getItem(SESSION_KEY);
  }

  function getCurrentUser() {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  return { init, login, logout, isLoggedIn, getCurrentUser };
})();