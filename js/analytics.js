/**
 * Модуль аналитики для библиотекаря.
 * Читает логи из localStorage, агрегирует и визуализирует.
 */
const Analytics = (function () {
  let themesChart = null;
  let dailyChart = null;

  function getLogs() {
    return Storage.getLogs();
  }

  function computeStats(logs) {
    const total = logs.length;
    const failed = logs.filter(l => l.resultsCount === 0).length;

    // Темы: собираем из запросов через простую токенизацию
    const themeCount = {};
    logs.forEach(log => {
      const words = (log.query || '')
        .toLowerCase()
        .replace(/[^a-zа-яё0-9\s]/gi, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3);
      const unique = new Set(words);
      unique.forEach(w => {
        themeCount[w] = (themeCount[w] || 0) + 1;
      });
    });

    const topThemes = Object.entries(themeCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return { total, failed, uniqueThemes: Object.keys(themeCount).length, topThemes };
  }

  function groupByDay(logs) {
    const days = {};
    logs.forEach(log => {
      const d = new Date(log.timestamp);
      const key = d.toISOString().slice(0, 10);
      days[key] = (days[key] || 0) + 1;
    });
    const sorted = Object.entries(days).sort((a, b) => a[0].localeCompare(b[0]));
    // последние 30 дней
    return sorted.slice(-30);
  }

  function computeFailedQueries(logs) {
    const failed = {};
    logs.filter(l => l.resultsCount === 0).forEach(l => {
      const q = (l.query || '').trim().toLowerCase();
      if (!q) return;
      if (!failed[q]) failed[q] = { count: 0, last: 0 };
      failed[q].count++;
      failed[q].last = Math.max(failed[q].last, l.timestamp);
    });
    return Object.entries(failed)
      .map(([query, data]) => ({ query, ...data }))
      .sort((a, b) => b.count - a.count);
  }

  function renderStats(stats) {
    document.getElementById('statTotalQueries').textContent = stats.total;
    document.getElementById('statFailedQueries').textContent = stats.failed;
    document.getElementById('statUniqueThemes').textContent = stats.uniqueThemes;
  }

  function renderThemesChart(topThemes) {
    const ctx = document.getElementById('themesChart');
    if (!ctx) return;
    if (themesChart) themesChart.destroy();

    themesChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: topThemes.map(t => t[0]),
        datasets: [{
          label: 'Упоминаний',
          data: topThemes.map(t => t[1]),
          backgroundColor: '#2b5cff',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  function renderDailyChart(days) {
    const ctx = document.getElementById('dailyChart');
    if (!ctx) return;
    if (dailyChart) dailyChart.destroy();

    dailyChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: days.map(d => d[0]),
        datasets: [{
          label: 'Запросов',
          data: days.map(d => d[1]),
          borderColor: '#ff8a3d',
          backgroundColor: 'rgba(255, 138, 61, 0.15)',
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  function renderFailedTable(rows) {
    const tbody = document.getElementById('failedTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="muted">Нет данных</td></tr>';
      return;
    }
    rows.slice(0, 20).forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(r.query)}</td>
        <td>${r.count}</td>
        <td>${new Date(r.last).toLocaleString('ru-RU')}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderAllQueries(logs) {
    const tbody = document.getElementById('allQueriesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="muted">Нет данных</td></tr>';
      return;
    }
    logs.slice().reverse().slice(0, 100).forEach(log => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${new Date(log.timestamp).toLocaleString('ru-RU')}</td>
        <td>${escapeHtml(log.query || '')}</td>
        <td>${log.resultsCount || 0}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function exportCsv() {
    const logs = getLogs();
    const failed = computeFailedQueries(logs);

    const lines = ['"Запрос","Количество","Последний раз"'];
    failed.forEach(r => {
      lines.push(`"${r.query.replace(/"/g, '""')}","${r.count}","${new Date(r.last).toLocaleString('ru-RU')}"`);
    });

    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `failed_queries_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function renderAll() {
    const logs = getLogs();
    const stats = computeStats(logs);
    renderStats(stats);
    renderThemesChart(stats.topThemes);
    renderDailyChart(groupByDay(logs));
    renderFailedTable(computeFailedQueries(logs));
    renderAllQueries(logs);
  }

  return { renderAll, exportCsv };
})();