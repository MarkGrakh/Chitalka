/**
 * Авторизация библиотекаря (клиентская, для прототипа).
 * Пароль хранится в виде SHA-256 хэша.
 *
 * Демо-доступ:
 *   логин: admin
 *   пароль: library2026
 */
const Auth = (function () {
  const SESSION_KEY = 'librarian_session';
  const USERS = {}; // логин: SHA-256(пароль)

  async function sha256(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Инициализация: вычисляет хэши паролей.
   * ВАЖНО: вызывать ДО login().
   */
  async function init() {
    USERS['admin'] = await sha256('library2026');
    console.log('Auth: инициализирован, доступен логин admin');
  }

  async function login(username, password) {
    if (!username || !password) return false;
    const hash = await sha256(password);
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