/**
 * Простая реализация TF-IDF + косинусной близости.
 * Используется для семантического поиска по тексту.
 */
const TFIDF = (function () {
  const STOP_WORDS = new Set([
    'и', 'в', 'во', 'не', 'что', 'он', 'на', 'я', 'с', 'со', 'как', 'а', 'то',
    'все', 'она', 'так', 'его', 'но', 'да', 'ты', 'к', 'у', 'же', 'вы', 'за',
    'бы', 'по', 'только', 'ее', 'мне', 'было', 'вот', 'от', 'меня', 'еще',
    'нет', 'о', 'из', 'ему', 'теперь', 'когда', 'даже', 'ну', 'вдруг', 'ли',
    'если', 'уже', 'или', 'ни', 'быть', 'был', 'него', 'до', 'вас', 'нибудь',
    'опять', 'уж', 'вам', 'ведь', 'там', 'потом', 'себя', 'ничего', 'ей',
    'может', 'они', 'тут', 'где', 'есть', 'надо', 'ней', 'для', 'мы', 'тебя',
    'их', 'чем', 'была', 'сам', 'чтоб', 'без', 'будто', 'чего', 'раз', 'тоже',
    'себе', 'под', 'будет', 'ж', 'тогда', 'кто', 'этот', 'того', 'потому',
    'этого', 'какой', 'совсем', 'ним', 'здесь', 'этом', 'один', 'почти',
    'мой', 'тем', 'чтобы', 'нее', 'сейчас', 'были', 'куда', 'зачем', 'всех',
    'никогда', 'можно', 'при', 'наконец', 'два', 'об', 'другой', 'хоть',
    'после', 'над', 'больше', 'тот', 'через', 'эти', 'нас', 'про', 'всего',
    'них', 'какая', 'много', 'разве', 'три', 'эту', 'моя', 'впрочем', 'хорошо',
    'свою', 'этой', 'перед', 'иногда', 'лучше', 'чуть', 'том', 'нельзя',
    'такой', 'им', 'более', 'всегда', 'конечно', 'всю', 'между'
  ]);

  let documents = []; // массив { id, text, tokens, vector }
  let idf = {};
  let vocabulary = [];

  function tokenize(text) {
    return (text || '')
      .toLowerCase()
      .replace(/[^a-zа-яё0-9\s]/gi, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1 && !STOP_WORDS.has(t));
  }

  /**
   * Строит индекс по массиву книг.
   * Каждая книга представлена текстом: title + author + description + genres + themes + mood_tags
   */
  function build(books) {
    documents = books.map(book => {
      const text = [
        book.title,
        book.author,
        book.description,
        (book.genre || []).join(' '),
        (book.themes || []).join(' '),
        (book.mood_tags || []).join(' ')
      ].join(' ');
      const tokens = tokenize(text);
      return { id: book.id, book, tokens, vector: null };
    });

    // Словарь
    const df = {};
    documents.forEach(doc => {
      const unique = new Set(doc.tokens);
      unique.forEach(t => {
        df[t] = (df[t] || 0) + 1;
      });
    });

    const N = documents.length;
    idf = {};
    Object.keys(df).forEach(t => {
      idf[t] = Math.log((N + 1) / (df[t] + 1)) + 1;
    });
    vocabulary = Object.keys(idf);

    // Векторы документов
    documents.forEach(doc => {
      doc.vector = buildVector(doc.tokens);
    });
  }

  function buildVector(tokens) {
    const tf = {};
    tokens.forEach(t => { tf[t] = (tf[t] || 0) + 1; });
    const total = tokens.length || 1;
    const vec = {};
    Object.keys(tf).forEach(t => {
      if (idf[t] !== undefined) {
        vec[t] = (tf[t] / total) * idf[t];
      }
    });
    return vec;
  }

  function cosine(vecA, vecB) {
    let dot = 0, normA = 0, normB = 0;
    for (const k in vecA) {
      normA += vecA[k] * vecA[k];
      if (vecB[k]) dot += vecA[k] * vecB[k];
    }
    for (const k in vecB) normB += vecB[k] * vecB[k];
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Расширяет токены синонимами из словаря.
   */
  function expandWithSynonyms(tokens, synonyms) {
    const expanded = new Set(tokens);
    tokens.forEach(t => {
      Object.keys(synonyms).forEach(key => {
        if (t === key || (synonyms[key] || []).includes(t)) {
          expanded.add(key);
          (synonyms[key] || []).forEach(s => expanded.add(s));
        }
      });
    });
    return Array.from(expanded);
  }

  /**
   * Поиск: возвращает отсортированный массив { book, score }.
   */
  function search(query, synonyms = {}, limit = 10) {
    if (!query || !query.trim()) return [];
    let tokens = tokenize(query);
    if (tokens.length === 0) return [];
    tokens = expandWithSynonyms(tokens, synonyms);
    const queryVec = buildVector(tokens);

    const scored = documents.map(doc => ({
      book: doc.book,
      score: cosine(queryVec, doc.vector)
    })).filter(r => r.score > 0);

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  return { build, search };
})();