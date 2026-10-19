import { apiClient } from './api';

export const ttsService = {
  /** MP3 of `text`: 'neerja' | 'prabhat' (English) or 'ishita' | 'shubh' (Hindi, Sarvam). */
  speak: (text, voice) =>
    apiClient
      .get('/tts', { params: { text, voice }, responseType: 'blob', timeout: 25000 })
      .then((res) => res.data),
};
