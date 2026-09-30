/**
 * Главный модуль приложения.
 * Связывает поиск, отображение, траекторию, ИИ и логирование.
 * Поддерживает загрузку из галереи и съёмку с камеры телефона.
 */
(function () {
  'use strict';

  let allBooks = [];
  let pendingPhotoFile = null;
  let pendingPhotoUrl = null;

  /* ---------- Глобальные обработчики ошибок ---------- */

  window.addEventListener('error', (e) => {
    console.error('Global error:', e.error || e.message);
    if (typeof UI !== 'undefined') {
      UI.showToast('Ошибка: ' + (e.message || 'неизвестная'), 'error', 5000);
    }
  });

  window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled rejection:', e.reason);
    if (typeof UI !== 'undefined') {
      UI.showToast(
        'Ошибка: ' + (e.reason?.message || 'неизвестная'),
        'error',
        5000
      );
    }
  });

  /* ---------- Инициализация ---------- */

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    UI.showLoading('Загружаем каталог библиотеки...');

    try {
      UI.updateLoadingMessage('Загружаем фонд книг...');
      await SearchText.init();

      if (!SearchText.isReady()) {
        throw new Error('Каталог не загружен. Проверьте, что файл data/biblio.json доступен.');
      }

      UI.updateLoadingMessage('Настраиваем рекомендации...');
      await Trajectory.init();

      UI.updateLoadingMessage('Проверяем настройки ИИ...');
      AIAssist.loadConfig();

      allBooks = SearchText.getBooks();

      if (!allBooks || allBooks.length === 0) {
        throw new Error('Каталог пуст или повреждён.');
      }

      bindEvents();
      detectCameraSupport();
      renderProfile();
      maybeShowTrajectory();

      UI.updateLoadingMessage('Готово!');
      setTimeout(() => {
        UI.hideLoading();
        if (AIAssist.isEnabled()) {
          UI.showToast('ИИ-помощник включён', 'success', 3000);
        }
      }, 400);
    } catch (e) {
      console.error('Ошибка инициализации:', e);
      UI.hideLoading();
      UI.showFatalError(e.message || 'Неизвестная ошибка');
    }
  }

  /* ---------- Определение мобильного устройства ---------- */

  function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
      .test(navigator.userAgent) ||
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
  }

  function detectCameraSupport() {
    const label = document.getElementById('cameraButtonLabel');
    if (!label) return;
    if (isMobileDevice()) {
      label.hidden = false;
    } else {
      label.hidden = true;
    }
  }

  /* ---------- События ---------- */

  function bindEvents() {
    const input = document.getElementById('searchInput');
    const btn = document.getElementById('searchButton');
    const mic = document.getElementById('micButton');
    const photoInput = document.getElementById('photoInput');
    const cameraInput = document.getElementById('cameraInput');
    const photoConfirm = document.getElementById('photoConfirm');
    const photoCancel = document.getElementById('photoCancel');
    const clearBtn = document.getElementById('clearButton');
    const trajectoryHide = document.getElementById('trajectoryHide');
    const settingsBtn = document.getElementById('settingsButton');

    btn.addEventListener('click', () => doSearch(input.value));
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') doSearch(input.value);
    });

    // Голосовой ввод
    if (SearchVoice.isSupported()) {
      mic.addEventListener('click', () => {
        SearchVoice.start(
          (text) => {
            input.value = text;
          },
          (status) => {
            document.getElementById('voiceStatus').textContent = status;
            mic.classList.toggle('recording', SearchVoice.isActive());
          }
        );
      });
    } else {
      mic.style.display = 'none';
      const voiceStatus = document.getElementById('voiceStatus');
      voiceStatus.textContent = 'Голосовой ввод не поддерживается в этом браузере.';
      voiceStatus.style.color = '#6b7280';
    }

    // Фото: из галереи
    photoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) preparePhoto(file);
      e.target.value = '';
    });

    // Фото: с камеры
    cameraInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) preparePhoto(file);
      e.target.value = '';
    });

    // Подтверждение распознавания
    photoConfirm.addEventListener('click', () => {
      if (pendingPhotoFile) recognizePhoto(pendingPhotoFile);
    });

    // Отмена
    photoCancel.addEventListener('click', hidePhotoPreview);

    // Очистка истории
    clearBtn.addEventListener('click', () => {
      if (confirm('Очистить всю историю поисков? Это действие необратимо.')) {
        Storage.clearAll();
        renderProfile();
        hideResults();
        hideTrajectory();
        UI.showToast('История очищена', 'success');
      }
    });

    // Скрыть траекторию
    trajectoryHide.addEventListener('click', () => {
      Storage.hideTrajectory();
      hideTrajectory();
    });

    // Настройки ИИ
    if (settingsBtn) {
      settingsBtn.addEventListener('click', openSettings);
    }
  }

  /* ---------- Работа с фото ---------- */

  function preparePhoto(file) {
    const status = document.getElementById('photoStatus');

    // Проверка типа
    if (!file.type.startsWith('image/')) {
      UI.showToast('Можно загружать только изображения', 'error');
      return;
    }

    // Проверка размера
    if (file.size > 5 * 1024 * 1024) {
      status.textContent = '⚠️ Файл больше 5 МБ.';
      UI.showToast('Фото слишком большое (макс. 5 МБ)', 'error');
      return;
    }

    // Освобождаем предыдущий URL
    if (pendingPhotoUrl) {
      URL.revokeObjectURL(pendingPhotoUrl);
      pendingPhotoUrl = null;
    }

    pendingPhotoFile = file;
    pendingPhotoUrl = URL.createObjectURL(file);

    const preview = document.getElementById('photoPreview');
    const img = document.getElementById('photoPreviewImg');
    img.src = pendingPhotoUrl;
    preview.hidden = false;
    status.textContent = '📎 Фото готово к распознаванию';

    preview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hidePhotoPreview() {
    const preview = document.getElementById('photoPreview');
    if (preview) preview.hidden = true;

    if (pendingPhotoUrl) {
      URL.revokeObjectURL(pendingPhotoUrl);
      pendingPhotoUrl = null;
    }
    pendingPhotoFile = null;

    const status = document.getElementById('photoStatus');
    if (status) status.textContent = '';
  }

  async function recognizePhoto(file) {
    const status = document.getElementById('photoStatus');
    const confirmBtn = document.getElementById('photoConfirm');
    const originalText = confirmBtn.textContent;

    status.textContent = '🔍 Распознаю обложку...';
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Распознаю...';

    try {
      const text = await SearchPhoto.recognize(file);

      if (!text || text.length < 3) {
        throw new Error('Не удалось распознать текст на обложке');
      }

      status.textContent = `📖 Распознано: «${text.slice(0, 80)}${text.length > 80 ? '...' : ''}»`;

      const { exact, similar } = SearchText.searchByCoverText(text, 6);

      let title;
      if (exact) {
        title = `Найдена книга: «${exact.title}». Похожие издания:`;
      } else {
        title = 'Точного совпадения нет. Возможно, вам понравится:';
      }

      Storage.pushLog({
        query: `[фото] ${text.slice(0, 100)}`,
        resultsCount: similar.length
      });
      renderResults(title, similar);
      hidePhotoPreview();
    } catch (err) {
      console.error(err);
      status.textContent = '⚠️ Не удалось распознать обложку.';
      UI.showToast('Ошибка распознавания: ' + (err.message || 'неизвестная'), 'error');
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = originalText;
    }
  }

  /* ---------- Поиск ---------- */

  async function doSearch(query) {
    if (!query || !query.trim()) {
      UI.showToast('Введите запрос', 'info', 2000);
      return;
    }

    const btn = document.getElementById('searchButton');
    const originalText = btn.textContent;

    try {
      btn.disabled = true;
      btn.textContent = 'Ищем...';

      let results = SearchText.search(query, 15);

      if (AIAssist.isEnabled() && results.length > 3) {
        btn.textContent = 'Уточняем...';
        results = await AIAssist.rerank(query, results);
      }

      Storage.pushLog({ query: query.trim(), resultsCount: results.length });
      Storage.pushHistory({ type: 'search', query: query.trim() });

      renderResults(`Результаты поиска: «${query.trim()}»`, results);

      if (results.length === 0) {
        UI.showToast('По вашему запросу ничего не найдено', 'info', 3000);
      }
    } catch (e) {
      console.error(e);
      UI.showToast('Ошибка поиска: ' + (e.message || 'неизвестная'), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  /* ---------- Отрисовка результатов ---------- */

  function renderResults(title, results) {
    const section = document.getElementById('resultsSection');
    const grid = document.getElementById('resultsGrid');
    const titleEl = document.getElementById('resultsTitle');
    const countEl = document.getElementById('resultsCount');
    const noResults = document.getElementById('noResults');

    section.hidden = false;
    titleEl.textContent = title;
    countEl.textContent = `Найдено: ${results.length}`;
    grid.innerHTML = '';

    if (results.length === 0) {
      noResults.hidden = false;
      return;
    }
    noResults.hidden = true;

    results.forEach(({ book }) => {
      grid.appendChild(createBookCard(book));
    });

    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function createBookCard(book) {
    const card = document.createElement('div');
    card.className = 'book-card';

    const tags = [
      ...(book.genre || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`),
      ...(book.mood_tags || []).slice(0, 2).map(t => `<span class="tag mood">${escapeHtml(t)}</span>`)
    ].join('');

    card.innerHTML = `
      <h3 class="book-title">${escapeHtml(book.title)}</h3>
      <p class="book-author">${escapeHtml(book.author)}</p>
      <p class="book-desc">${escapeHtml(book.description || '')}</p>
      <div class="book-tags">${tags}</div>
      <div class="book-meta">
        <span>${escapeHtml(book.age_group || '')}</span>
        <span>${book.available ? '✅ В наличии' : '📕 Выдана'}</span>
      </div>
    `;

    card.addEventListener('click', () => {
      Storage.pushHistory({ type: 'view', book });
      renderProfile();
      maybeShowTrajectory();
    });

    return card;
  }

  /* ---------- Профиль ---------- */

  function renderProfile() {
    const profile = Trajectory.analyze();
    const content = document.getElementById('profileContent');

    if (profile.totalViews === 0) {
      content.innerHTML = '<p class="muted">Пока нет данных. Найдите несколько книг — и мы построим вашу траекторию.</p>';
      return;
    }

    const themesHtml = profile.topThemes.slice(0, 6)
      .map(t => `<span class="tag">${escapeHtml(t.theme)} · ${t.count}</span>`)
      .join('');

    content.innerHTML = `
      <p>Вы просмотрели <strong>${profile.totalViews}</strong> книг(и).</p>
      <p class="muted">Ваши любимые темы:</p>
      <div class="profile-themes">${themesHtml}</div>
    `;
  }

  /* ---------- Траектория ---------- */

  async function maybeShowTrajectory() {
    const rec = Trajectory.getRecommendation(allBooks);
    if (!rec) {
      hideTrajectory();
      return;
    }

    const block = document.getElementById('trajectoryBlock');
    document.getElementById('trajectoryTitle').textContent = rec.title;
    document.getElementById('trajectoryReason').textContent = rec.reason;

    const grid = document.getElementById('trajectoryBooks');
    grid.innerHTML = '';
    rec.books.forEach(book => grid.appendChild(createBookCard(book)));

    block.hidden = false;

    if (AIAssist.isEnabled()) {
      const profile = Trajectory.analyze();
      const fork = { next: rec.books.flatMap(b => b.themes || []).slice(0, 3) };
      try {
        const aiReason = await AIAssist.explainTrajectory(profile, fork);
        if (aiReason) {
          document.getElementById('trajectoryReason').textContent = aiReason;
        }
      } catch (e) {
        console.warn('Не удалось получить объяснение от ИИ', e);
      }
    }
  }

  function hideTrajectory() {
    const block = document.getElementById('trajectoryBlock');
    if (block) block.hidden = true;
  }

  function hideResults() {
    const s = document.getElementById('resultsSection');
    if (s) s.hidden = true;
  }

  /* ---------- Настройки ИИ ---------- */

  function openSettings() {
    let modal = document.getElementById('settingsModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'settingsModal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal">
          <h2>Настройки ИИ-помощника</h2>
          <p class="muted">
            Введите API-ключ и folder_id Yandex Cloud.
            Ключ сохранится <strong>только в вашем браузере</strong> (localStorage).
          </p>
          <label class="modal-label">
            API-ключ
            <input type="password" id="aiKey" placeholder="AQVN..." autocomplete="off" />
          </label>
          <label class="modal-label">
            Folder ID
            <input type="text" id="aiFolder" placeholder="b1g..." autocomplete="off" />
          </label>
          <label class="modal-checkbox">
            <input type="checkbox" id="aiEnabled" />
            Включить ИИ-помощник
          </label>
          <div id="aiTestResult" class="modal-hint"></div>
          <div class="modal-actions">
            <button id="aiTest" class="btn btn-ghost">Проверить</button>
            <button id="aiSave" class="btn btn-primary">Сохранить</button>
            <button id="aiClose" class="btn btn-ghost">Закрыть</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      modal.querySelector('#aiClose').addEventListener('click', closeSettings);
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeSettings();
      });

      modal.querySelector('#aiSave').addEventListener('click', () => {
        AIAssist.setConfig({
          apiKey: modal.querySelector('#aiKey').value,
          folderId: modal.querySelector('#aiFolder').value,
          enabled: modal.querySelector('#aiEnabled').checked
        });
        UI.showToast(
          AIAssist.isEnabled() ? 'ИИ-помощник включён' : 'Настройки сохранены',
          'success'
        );
        closeSettings();
      });

      modal.querySelector('#aiTest').addEventListener('click', async () => {
        const resultEl = modal.querySelector('#aiTestResult');
        AIAssist.setConfig({
          apiKey: modal.querySelector('#aiKey').value,
          folderId: modal.querySelector('#aiFolder').value,
          enabled: true
        });
        resultEl.textContent = '⏳ Проверяю соединение...';
        resultEl.className = 'modal-hint';
        try {
          const answer = await AIAssist.testConnection();
          resultEl.textContent = `✅ Соединение работает. Ответ: «${answer}»`;
          resultEl.className = 'modal-hint success';
        } catch (e) {
          resultEl.textContent = '❌ ' + (e.message || 'Ошибка');
          resultEl.className = 'modal-hint error';
        }
      });
    }

    const cfg = AIAssist.getConfig();
    modal.querySelector('#aiKey').value = cfg.apiKey || '';
    modal.querySelector('#aiFolder').value = cfg.folderId || '';
    modal.querySelector('#aiEnabled').checked = cfg.enabled || false;
    modal.querySelector('#aiTestResult').textContent = '';
    modal.querySelector('#aiTestResult').className = 'modal-hint';

    modal.classList.add('visible');
  }

  function closeSettings() {
    const modal = document.getElementById('settingsModal');
    if (modal) modal.classList.remove('visible');
  }

  /* ---------- Утилиты ---------- */

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
})();