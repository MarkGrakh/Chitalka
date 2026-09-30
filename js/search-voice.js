/**
 * Модуль голосового ввода через Web Speech API.
 */
const SearchVoice = (function () {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let isRecording = false;

  function isSupported() {
    return !!SpeechRecognition;
  }

  function start(onResult, onStatus) {
    if (!isSupported()) {
      if (onStatus) onStatus('Голосовой ввод не поддерживается в этом браузере');
      return;
    }
    if (isRecording) {
      stop();
      return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    let finalText = '';

    recognition.onstart = () => {
      isRecording = true;
      if (onStatus) onStatus('🎙️ Слушаю...');
    };

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += transcript;
        } else {
          interim += transcript;
        }
      }
      if (onResult) onResult(finalText + interim, !!finalText);
    };

    recognition.onerror = (event) => {
      console.warn('Voice error:', event.error);
      if (onStatus) onStatus('Ошибка распознавания: ' + event.error);
      isRecording = false;
    };

    recognition.onend = () => {
      isRecording = false;
      if (onStatus) onStatus('');
    };

    try {
      recognition.start();
    } catch (e) {
      console.warn('Voice start error:', e);
      if (onStatus) onStatus('Не удалось запустить микрофон');
    }
  }

  function stop() {
    if (recognition && isRecording) {
      recognition.stop();
      isRecording = false;
    }
  }

  function isActive() {
    return isRecording;
  }

  return { isSupported, start, stop, isActive };
})();