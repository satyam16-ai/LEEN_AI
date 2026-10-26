import { apiClient, unwrap } from './api';

// Phone photos take longer than the client's default timeout to send.
const UPLOAD_TIMEOUT = 60000;
const path = (subject) => `/student/syllabus/${encodeURIComponent(subject)}`;

/** One topic tree per profile subject, read from a contents-page photo by the AI. */
export const syllabusService = {
  list: () => apiClient.get('/student/syllabus').then(unwrap),

  get: (subject) => apiClient.get(path(subject)).then(unwrap),

  upload: (subject, files) => {
    const form = new FormData();
    files.forEach((file) => form.append('files', file));
    return apiClient
      .post(`${path(subject)}/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: UPLOAD_TIMEOUT,
      })
      .then(unwrap);
  },

  save: (subject, body) => apiClient.put(path(subject), body).then(unwrap),
};
