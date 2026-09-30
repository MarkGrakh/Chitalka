/**
 * Нечёткое сравнение строк — расстояние Левенштейна.
 * Используется для поиска по распознанному тексту обложки.
 */
const Levenshtein = (function () {
  function distance(a, b) {
    a = (a || '').toLowerCase().trim();
    b = (b || '').toLowerCase().trim();
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        const cost = b.charAt(i - 1) === a.charAt(j - 1) ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    return matrix[b.length][a.length];
  }

  /**
   * Коэффициент схожести от 0 до 1.
   */
  function similarity(a, b) {
    const maxLen = Math.max((a || '').length, (b || '').length);
    if (maxLen === 0) return 1;
    return 1 - distance(a, b) / maxLen;
  }

  return { distance, similarity };
})();