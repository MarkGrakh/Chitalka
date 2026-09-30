/**
 * Модуль поиска по тексту.
 * Загружает biblio.json, synonyms.json, строит индекс и обрабатывает запросы.
 */
const SearchText = (function () {
  let books = [];
  let synonyms = {};
  let ready = false;

  async function init() {
    try {
      const [biblioRes, synRes] = await Promise.all([
        fetch('./data/biblio.json'),
        fetch('./data/synonyms.json')
      ]);
      books = await biblioRes.json();
      synonyms = await synRes.json();
      TFIDF.build(books);
      ready = true;
      console.log('SearchText: индекс построен по', books.length, 'книгам');
    } catch (e) {
      console.error('SearchText: ошибка инициализации', e);
    }
  }

  function isReady() {
    return ready;
  }

  function getBooks() {
    return books;
  }

  function getSynonyms() {
    return synonyms;
  }

  /**
   * Поиск книг по запросу.
   * Возвращает массив { book, score }.
   */
  function search(query, limit = 10) {
    if (!ready) return [];
    return TFIDF.search(query, synonyms, limit);
  }

  /**
   * Поиск по распознанному тексту обложки.
   * Сначала ищет точное совпадение по названию/автору,
   * затем — похожие по тематике.
   */
  function searchByCoverText(text, limit = 6) {
    if (!ready) return { exact: null, similar: [] };
    const normalized = (text || '').toLowerCase().trim();

    // 1. Пытаемся найти книгу в фонде по названию/автору
    let exact = null;
    let bestScore = 0;
    books.forEach(book => {
      const titleSim = Levenshtein.similarity(normalized, book.title);
      const authorSim = Levenshtein.similarity(normalized, book.author);
      const score = Math.max(titleSim, authorSim);
      if (score > bestScore) {
        bestScore = score;
        exact = book;
      }
    });

    // Порог: если схожесть низкая — считаем, что книги нет в фонде
    if (bestScore < 0.5) {
      exact = null;
    }

    // 2. Ищем похожие книги по тематике
    let similar = [];
    if (exact) {
      const themes = new Set([...(exact.themes || []), ...(exact.genre || [])]);
      similar = books
        .filter(b => b.id !== exact.id)
        .map(b => {
          const bThemes = new Set([...(b.themes || []), ...(b.genre || [])]);
          let overlap = 0;
          themes.forEach(t => { if (bThemes.has(t)) overlap++; });
          return { book: b, overlap };
        })
        .filter(r => r.overlap > 0)
        .sort((a, b) => b.overlap - a.overlap)
        .slice(0, limit)
        .map(r => ({ book: r.book, score: r.overlap }));
    } else {
      // Если точного совпадения нет — ищем по тексту
      similar = TFIDF.search(normalized, synonyms, limit);
    }

    return { exact, similar };
  }

  return { init, isReady, getBooks, getSynonyms, search, searchByCoverText };
})();