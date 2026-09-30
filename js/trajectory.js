/**
 * Модуль читательской траектории.
 * Анализирует историю, определяет доминирующие темы
 * и предлагает «развилки» на основе forks.json.
 */
const Trajectory = (function () {
  let forks = {};

  async function init() {
    try {
      const res = await fetch('./data/forks.json');
      forks = await res.json();
    } catch (e) {
      console.warn('Trajectory: forks.json не загружен', e);
    }
  }

  /**
   * Анализирует историю и возвращает профиль:
   * { topThemes: [{theme, count}], totalViews, dominantTheme }
   */
  function analyze() {
    const history = Storage.getHistory();
    const themeCount = {};
    let views = 0;

    history.forEach(entry => {
      if (entry.type === 'view' && entry.book) {
        views++;
        const themes = [
          ...(entry.book.themes || []),
          ...(entry.book.genre || [])
        ];
        themes.forEach(t => {
          themeCount[t] = (themeCount[t] || 0) + 1;
        });
      }
    });

    const topThemes = Object.entries(themeCount)
      .map(([theme, count]) => ({ theme, count }))
      .sort((a, b) => b.count - a.count);

    return {
      topThemes,
      totalViews: views,
      dominantTheme: topThemes[0] ? topThemes[0].theme : null
    };
  }

  /**
   * Возвращает рекомендацию-развилку, если она уместна.
   * @param {Array} allBooks — все книги фонда
   * @returns {Object|null} { title, reason, books: [] }
   */
  function getRecommendation(allBooks) {
    if (Storage.isTrajectoryHidden()) return null;

    const profile = analyze();
    if (profile.totalViews < 3) return null;
    if (!profile.dominantTheme) return null;

    const fork = forks[profile.dominantTheme];
    if (!fork) return null;

    // Находим книги из фонда, соответствующие целевым темам развилки
    const targetThemes = new Set(fork.next || []);
    const recommended = allBooks
      .filter(book => {
        const bookThemes = [...(book.themes || []), ...(book.genre || [])];
        return bookThemes.some(t => targetThemes.has(t));
      })
      .slice(0, 5);

    if (recommended.length === 0) return null;

    return {
      title: `Вы много читаете «${profile.dominantTheme}»`,
      reason: fork.reason || `Попробуйте книги из смежной тематики: ${fork.next.join(', ')}.`,
      books: recommended
    };
  }

  function saveProfile() {
    const profile = analyze();
    Storage.setProfile(profile);
    return profile;
  }

  return { init, analyze, getRecommendation, saveProfile };
})();