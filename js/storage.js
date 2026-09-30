/**
 * Обёртка над localStorage.
 * Отвечает за хранение истории, профиля и логов.
 */
const Storage = (function () {
  const KEYS = {
    HISTORY: 'reader_history',      // история поисков и просмотров
    LOGS: 'search_logs',            // логи для аналитики
    PROFILE: 'reader_profile',      // агрегированный профиль
    HIDDEN_TRAJECTORY: 'hidden_trajectory'
  };

  function getJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Storage: ошибка чтения', key, e);
      return fallback;
    }
  }

  function setJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('Storage: ошибка записи', key, e);
    }
  }

  function pushHistory(entry) {
    const history = getJSON(KEYS.HISTORY, []);
    history.push({ ...entry, timestamp: Date.now() });
    // ограничим историю 500 записями
    if (history.length > 500) history.splice(0, history.length - 500);
    setJSON(KEYS.HISTORY, history);
  }

  function pushLog(entry) {
    const logs = getJSON(KEYS.LOGS, []);
    logs.push({ ...entry, timestamp: Date.now() });
    if (logs.length > 2000) logs.splice(0, logs.length - 2000);
    setJSON(KEYS.LOGS, logs);
  }

  function getHistory() {
    return getJSON(KEYS.HISTORY, []);
  }

  function getLogs() {
    return getJSON(KEYS.LOGS, []);
  }

  function clearAll() {
    localStorage.removeItem(KEYS.HISTORY);
    localStorage.removeItem(KEYS.LOGS);
    localStorage.removeItem(KEYS.PROFILE);
    localStorage.removeItem(KEYS.HIDDEN_TRAJECTORY);
  }

  function setProfile(profile) {
    setJSON(KEYS.PROFILE, profile);
  }

  function getProfile() {
    return getJSON(KEYS.PROFILE, null);
  }

  function hideTrajectory() {
    localStorage.setItem(KEYS.HIDDEN_TRAJECTORY, Date.now().toString());
  }

  function isTrajectoryHidden() {
    const val = localStorage.getItem(KEYS.HIDDEN_TRAJECTORY);
    if (!val) return false;
    // скрываем на 24 часа
    return Date.now() - parseInt(val, 10) < 24 * 60 * 60 * 1000;
  }

  return {
    pushHistory,
    pushLog,
    getHistory,
    getLogs,
    clearAll,
    setProfile,
    getProfile,
    hideTrajectory,
    isTrajectoryHidden
  };
})();