import { apiClient } from './api';

export const ttsService = {
  /** MP3 of `text` read by a neural voice ('neerja' | 'prabhat'). */
  speak: (text, voice) =>
    apiClient
      .get('/tts', { params: { text, voice }, responseType: 'blob', timeout: 25000 })
      .then((res) => res.data),
};
