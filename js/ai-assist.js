/**
 * Опциональный модуль ИИ-улучшения семантики на базе YandexGPT.
 *
 * ВНИМАНИЕ!
 * При размещении на GitHub Pages API-ключ виден в исходном коде.
 * Это допустимо только для прототипа и демонстрации.
 * Для продакшена вызовы API нужно вынести на серверный прокси
 * (например, Cloudflare Workers на JavaScript).
 *
 * Как включить:
 *   1) Получите API-ключ и folder_id в Yandex Cloud:
 *      https://cloud.yandex.ru/docs/foundation-models/quickstart
 *   2) Откройте сайт, нажмите ⚙️ в шапке, введите ключ и folder_id.
 *      Настройки сохранятся в localStorage.
 */
const AIAssist = (function () {
  const CONFIG = {
    enabled: false,
    apiKey: '',
    folderId: '',
    model: 'yandexgpt-lite', // или 'yandexgpt'
    endpoint: 'https://corsproxy.io/?https://llm.api.cloud.yandex.net/foundationModels/v1/completion',
    timeoutMs: 15000
  };

  /* ---------- Конфигурация ---------- */

  function loadConfig() {
    try {
      const saved = JSON.parse(localStorage.getItem('ai_config') || '{}');
      if (saved.apiKey) CONFIG.apiKey = saved.apiKey;
      if (saved.folderId) CONFIG.folderId = saved.folderId;
      if (typeof saved.enabled === 'boolean') CONFIG.enabled = saved.enabled;
    } catch (e) {
      console.warn('AIAssist: не удалось прочитать конфиг', e);
    }
  }

  function setConfig({ apiKey, folderId, enabled }) {
    if (typeof apiKey === 'string') CONFIG.apiKey = apiKey.trim();
    if (typeof folderId === 'string') CONFIG.folderId = folderId.trim();
    if (typeof enabled === 'boolean') CONFIG.enabled = enabled;
    localStorage.setItem('ai_config', JSON.stringify({
      apiKey: CONFIG.apiKey,
      folderId: CONFIG.folderId,
      enabled: CONFIG.enabled
    }));
  }

  function isEnabled() {
    return !!(CONFIG.enabled && CONFIG.apiKey && CONFIG.folderId);
  }

  function getConfig() {
    return { ...CONFIG };
  }

  /* ---------- Вызов YandexGPT ---------- */

  async function callYandexGPT(systemPrompt, userPrompt, temperature = 0.3) {
    if (!isEnabled()) throw new Error('AI не настроен');

    const body = {
      modelUri: `gpt://${CONFIG.folderId}/${CONFIG.model}/latest`,
      completionOptions: {
        stream: false,
        temperature,
        maxTokens: 2000
      },
      messages: [
        { role: 'system', text: systemPrompt },
        { role: 'user', text: userPrompt }
      ]
    };

    // Таймаут через AbortController
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONFIG.timeoutMs);

    try {
      const response = await fetch(CONFIG.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Api-Key ${CONFIG.apiKey}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`YandexGPT ${response.status}: ${errText.slice(0, 200)}`);
      }

      const data = await response.json();
      const text = data?.result?.alternatives?.[0]?.message?.text;
      if (!text) throw new Error('Пустой ответ от YandexGPT');
      return text;
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('YandexGPT: превышено время ожидания');
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  /* ---------- Функция 1. Переранжирование результатов ---------- */

  /**
   * Получает кандидатов от TF-IDF и возвращает отранжированный список
   * с учётом смысла запроса.
   */
  async function rerank(query, candidates) {
    if (!isEnabled() || candidates.length === 0) return candidates;

    const catalog = candidates
      .map((c, i) =>
        `${i + 1}. "${c.book.title}" — ${c.book.author}: ${(c.book.description || '').slice(0, 220)}`
      )
      .join('\n');

    const systemPrompt =
      'Ты — опытный библиотекарь детской библиотеки. ' +
      'Твоя задача — выбрать из списка книг те, которые лучше всего подходят ' +
      'под запрос читателя. Отвечай строго в формате JSON-массива с номерами книг.';

    const userPrompt =
      `Запрос читателя: "${query}"\n\n` +
      `Список книг из фонда:\n${catalog}\n\n` +
      `Выбери до 8 книг, наиболее подходящих под запрос. ` +
      `Верни ответ строго в формате JSON-массива чисел, например: [1, 3, 5, 7]. Без пояснений.`;

    try {
      const answer = await callYandexGPT(systemPrompt, userPrompt, 0.2);
      const match = answer.match(/\[[\d,\s]+\]/);
      if (!match) return candidates;
      const indices = JSON.parse(match[0]);
      const reranked = indices
        .map(i => candidates[i - 1])
        .filter(Boolean);
      return reranked.length > 0 ? reranked : candidates;
    } catch (e) {
      console.warn('AIAssist.rerank: ошибка, использую TF-IDF', e);
      UI.showToast('ИИ недоступен, показываю базовый поиск', 'error', 3000);
      return candidates;
    }
  }

  /* ---------- Функция 2. Расширение запроса синонимами ---------- */

  async function expandQuery(query) {
    if (!isEnabled()) return null;

    const systemPrompt =
      'Ты — помощник библиотекаря. Расширь поисковый запрос читателя ' +
      'синонимами и связанными темами. Отвечай кратко.';

    const userPrompt =
      `Запрос: "${query}". Верни 5–7 ключевых слов через запятую, без пояснений.`;

    try {
      const answer = await callYandexGPT(systemPrompt, userPrompt, 0.4);
      return answer.split(',').map(s => s.trim()).filter(Boolean);
    } catch (e) {
      console.warn('AIAssist.expandQuery: ошибка', e);
      return null;
    }
  }

  /* ---------- Функция 3. Объяснение «развилки» ---------- */

  async function explainTrajectory(profile, fork) {
    if (!isEnabled()) return null;

    const systemPrompt =
      'Ты — наставник юного читателя. Объясни, почему читателю с такими ' +
      'интересами будет полезно попробовать смежную тему. Пиши тепло, по-дружески.';

    const userPrompt =
      `Читатель часто читает книги по темам: ` +
      `${profile.topThemes.slice(0, 5).map(t => t.theme).join(', ')}.\n` +
      `Мы хотим предложить ему смежную тему: ${fork.next.join(', ')}.\n` +
      `Напиши 1–2 предложения с мотивацией на русском языке. Без обращения "уважаемый".`;

    try {
      return await callYandexGPT(systemPrompt, userPrompt, 0.5);
    } catch (e) {
      console.warn('AIAssist.explainTrajectory: ошибка', e);
      return null;
    }
  }

  /* ---------- Проверка соединения ---------- */

  async function testConnection() {
    if (!isEnabled()) throw new Error('Заполните API-ключ и folder_id');
    const answer = await callYandexGPT(
      'Отвечай одним словом.',
      'Скажи «ок»',
      0.1
    );
    return answer.trim().slice(0, 50);
  }

  return {
    loadConfig,
    setConfig,
    getConfig,
    isEnabled,
    rerank,
    expandQuery,
    explainTrajectory,
    testConnection
  };
})();
