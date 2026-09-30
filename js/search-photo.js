/**
 * Модуль поиска по фотографии обложки.
 * Использует Tesseract.js для OCR.
 */
const SearchPhoto = (function () {
  let worker = null;

  async function initWorker() {
    if (worker) return worker;
    if (typeof Tesseract === 'undefined') {
      throw new Error('Tesseract.js не загружен');
    }
    worker = await Tesseract.createWorker('rus+eng');
    return worker;
  }

  /**
   * Распознаёт текст с изображения.
   * @param {File} file
   * @param {Function} onProgress
   * @returns {Promise<string>}
   */
  async function recognize(file, onProgress) {
    const w = await initWorker();
    const result = await w.recognize(file);
    if (onProgress) onProgress(100);
    return (result.data.text || '').trim();
  }

  return { recognize };
})();