import { speakableText } from './mathText';

const MAX_PARALLEL_FETCHES = 2;
const MAX_CACHED = 200;
// After the server voice fails, use the browser voice for a while before retrying.
const SERVER_RETRY_MS = 60_000;

export const VOICES = {
  neerja: 'Neerja (English, female)',
  prabhat: 'Prabhat (English, male)',
  ishita: 'Ishita (Hindi, female)',
  shubh: 'Shubh (Hindi, male)',
};
export const DEFAULT_VOICE = 'neerja';
const HINDI_VOICES = new Set(['ishita', 'shubh']);

/** Best voice the browser itself has, for when the server voice is unavailable. */
function browserVoice(synth, hindi = false) {
  if (hindi) {
    return synth.getVoices().find((voice) => /^hi([-_]|$)/i.test(voice.lang)) ?? null;
  }
  const english = synth.getVoices().filter((voice) => /^en([-_]|$)/i.test(voice.lang));
  const natural = (voice) => /natural|neural|online|premium|enhanced/i.test(voice.name);
  const indian = (voice) => /IN$/i.test(voice.lang);
  const google = (voice) => /google/i.test(voice.name);
  return (
    english.find((voice) => natural(voice) && indian(voice)) ??
    english.find(natural) ??
    english.find((voice) => google(voice) && /(IN|GB)$/i.test(voice.lang)) ??
    english.find(google) ??
    english.find(indian) ??
    english[0] ??
    null
  );
}

/**
 * Reads captions aloud with the server's neural voice. Audio for upcoming
 * captions is prefetched while the board is still drawing, so each caption can
 * be spoken the moment it appears. If the server voice is unavailable, the
 * browser's own speech is used instead.
 */
export class Narrator {
  constructor(fetchAudio) {
    this.fetchAudio = fetchAudio; // (text, voice) => Promise<Blob>
    this.voice = DEFAULT_VOICE;
    this.rate = 1;
    this.paused = false;
    this.serverDownUntil = 0;
    this.cache = new Map(); // `${voice}|${text}` -> Promise<objectURL | null>
    this.queue = [];
    this.active = 0;
    this.playback = null;
  }

  setVoice(voice) {
    if (!VOICES[voice] || voice === this.voice) return;
    this.voice = voice;
    this.serverDownUntil = 0;
  }

  setRate(rate) {
    this.rate = rate;
    if (this.playback?.audio) this.playback.audio.playbackRate = rate;
  }

  /** Start fetching the audio for `text` (no-op if it is cached or on its way). */
  prefetch(text) {
    const key = `${this.voice}|${text}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const voice = this.voice;
    const audioUrl = new Promise((resolve) => {
      const fail = () => {
        this.cache.delete(key); // failures aren't cached, so a later replay can retry
        resolve(null);
      };
      this.queue.push(() => {
        if (Date.now() < this.serverDownUntil) return Promise.resolve(fail());
        return this.fetchAudio(speakableText(text), voice)
          .then((blob) => resolve(URL.createObjectURL(blob)))
          .catch(() => {
            this.serverDownUntil = Date.now() + SERVER_RETRY_MS;
            fail();
          });
      });
    });
    this.cache.set(key, audioUrl);
    this._pump();
    this._trim();
    return audioUrl;
  }

  /** Speak `text`; resolves when it has been read out (or was stopped/skipped). */
  speak(text) {
    this.stop();
    return new Promise((resolve) => {
      const playback = { audio: null, utterance: null, done: false };
      const finish = () => {
        if (playback.done) return;
        playback.done = true;
        if (this.playback === playback) this.playback = null;
        resolve();
      };
      playback.finish = finish;
      this.playback = playback;

      this.prefetch(text).then((url) => {
        if (playback.done) return;
        if (!url) {
          this._speakWithBrowser(text, playback, finish);
          return;
        }
        const audio = new Audio(url);
        audio.playbackRate = this.rate;
        audio.onended = finish;
        audio.onerror = finish;
        playback.audio = audio;
        if (!this.paused) this._play(audio, finish);
      });
    });
  }

  pause() {
    this.paused = true;
    this.playback?.audio?.pause();
    if (this.playback?.utterance) window.speechSynthesis?.pause();
  }

  resume() {
    this.paused = false;
    const playback = this.playback;
    if (playback?.audio && playback.audio.paused && !playback.audio.ended) {
      this._play(playback.audio, playback.finish);
    }
    if (playback?.utterance) window.speechSynthesis?.resume();
  }

  stop() {
    const playback = this.playback;
    this.playback = null;
    if (!playback) return;
    playback.audio?.pause();
    if (playback.utterance) window.speechSynthesis?.cancel();
    playback.finish();
  }

  destroy() {
    this.stop();
    this.queue = [];
    this.cache.forEach((url) => url.then((value) => value && URL.revokeObjectURL(value)));
    this.cache.clear();
  }

  _play(audio, finish) {
    audio.play().catch((error) => {
      // AbortError: pause() interrupted play(); resume() will try again.
      // Anything else (e.g. autoplay blocked before any click) skips this caption.
      if (error?.name !== 'AbortError') finish();
    });
  }

  _pump() {
    while (this.active < MAX_PARALLEL_FETCHES && this.queue.length) {
      const task = this.queue.shift();
      this.active += 1;
      task().finally(() => {
        this.active -= 1;
        this._pump();
      });
    }
  }

  _trim() {
    while (this.cache.size > MAX_CACHED) {
      const [key, url] = this.cache.entries().next().value;
      this.cache.delete(key);
      url.then((value) => value && URL.revokeObjectURL(value));
    }
  }

  _speakWithBrowser(text, playback, finish) {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
      finish();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(speakableText(text));
    const hindi = HINDI_VOICES.has(this.voice);
    const voice = browserVoice(synth, hindi);
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? (hindi ? 'hi-IN' : 'en-IN');
    utterance.rate = Math.min(1.8, this.rate);
    utterance.onend = finish;
    utterance.onerror = finish;
    playback.utterance = utterance;
    synth.cancel();
    synth.speak(utterance);
    if (this.paused) synth.pause();
  }
}
