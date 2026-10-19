import { getApiError } from '@/utils/apiError';

import { apiClient, unwrap } from './api';

export const sttService = {
  /** Text of a short Hindi recording (transcribed on the server by Sarvam AI). */
  transcribe: async (blob) => {
    const form = new FormData();
    form.append('file', blob, 'speech.webm');
    try {
      const data = await apiClient
        // Multipart, so axios hands the FormData to the browser, which adds the boundary.
        .post('/stt', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 30000 })
        .then(unwrap);
      return data.text;
    } catch (error) {
      throw new Error(getApiError(error).message, { cause: error });
    }
  },
};
