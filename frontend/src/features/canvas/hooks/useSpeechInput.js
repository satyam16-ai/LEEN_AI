import { useCallback, useEffect, useRef, useState } from 'react';

import { sttService } from '@/services/sttService';

const BLOCKED = 'Microphone access is blocked.';
const NOT_HEARD = "Didn't catch that. Try again.";
const MAX_RECORDING_MS = 15_000;

function recognitionClass() {
  if (typeof window === 'undefined') return undefined;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

function canRecord() {
  return (
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    Boolean(globalThis.navigator?.mediaDevices?.getUserMedia)
  );
}

/**
 * Tap-to-talk voice input. English is recognised by the browser itself; Hindi is
 * recorded (up to 15 s) and transcribed on the server by Sarvam AI, which returns
 * Hinglish in English letters like the board's captions. `onFinal(text)` is called
 * once per utterance.
 */
export function useSpeechInput({ lang = 'en-IN', onFinal } = {}) {
  const hindi = lang.startsWith('hi');
  const supported = hindi ? canRecord() : Boolean(recognitionClass());
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState(null);
  const onFinalRef = useRef(onFinal);
  // The running recognition or recording: { stop(), abort() }.
  const activeRef = useRef(null);

  useEffect(() => {
    onFinalRef.current = onFinal;
  });

  const listenInBrowser = useCallback(() => {
    const Recognition = recognitionClass();
    const recognition = new Recognition();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    let sent = false;
    recognition.onresult = (event) => {
      let heard = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) final += result[0].transcript;
        else heard += result[0].transcript;
      }
      if (final.trim() && !sent) {
        sent = true;
        setInterim('');
        onFinalRef.current?.(final.trim());
      } else if (!sent) {
        setInterim(heard.trim());
      }
    };
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') setError(BLOCKED);
      else if (event.error === 'no-speech') setError(NOT_HEARD);
    };
    recognition.onend = () => {
      activeRef.current = null;
      setListening(false);
      setInterim('');
    };
    activeRef.current = { stop: () => recognition.stop(), abort: () => recognition.abort() };
    recognition.start();
    setListening(true);
  }, [lang]);

  const record = useCallback(async () => {
    // Hold the slot while the browser asks for the microphone: a second tap starts nothing,
    // and stopping or closing now means the recording never begins.
    const starting = { cancelled: false };
    const cancel = () => {
      starting.cancelled = true;
      activeRef.current = null;
    };
    activeRef.current = { stop: cancel, abort: cancel };
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      if (!starting.cancelled) {
        activeRef.current = null;
        setError(BLOCKED);
      }
      return;
    }
    if (starting.cancelled) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    const recorder = new MediaRecorder(stream);
    const chunks = [];
    let cancelled = false;
    let timer = null;
    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunks.push(event.data);
    };
    recorder.onstop = async () => {
      clearTimeout(timer);
      stream.getTracks().forEach((track) => track.stop());
      activeRef.current = null;
      setListening(false);
      if (cancelled) return;
      if (!chunks.length) {
        setInterim('');
        setError(NOT_HEARD);
        return;
      }
      setInterim('…');
      try {
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        const text = (await sttService.transcribe(blob))?.trim();
        setInterim('');
        if (text) onFinalRef.current?.(text);
        else setError(NOT_HEARD);
      } catch (failure) {
        setInterim('');
        setError(failure.message || NOT_HEARD);
      }
    };
    const stop = () => {
      if (recorder.state !== 'inactive') recorder.stop();
    };
    activeRef.current = {
      stop,
      abort: () => {
        cancelled = true;
        stop();
      },
    };
    recorder.start();
    setListening(true);
    setInterim('Listening…');
    timer = setTimeout(stop, MAX_RECORDING_MS);
  }, []);

  /** Start listening. Returns a promise only for Hindi, which waits for the microphone. */
  const start = useCallback(() => {
    if (!supported || activeRef.current) return undefined;
    setError(null);
    if (hindi) return record();
    listenInBrowser();
    return undefined;
  }, [supported, hindi, record, listenInBrowser]);

  const stop = useCallback(() => activeRef.current?.stop(), []);

  useEffect(() => () => activeRef.current?.abort(), []);

  return { supported, listening, interim, error, start, stop };
}
