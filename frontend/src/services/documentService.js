import { apiClient, unwrap } from './api';

// Phone photos and short PDFs take longer than the client's default timeout to send.
const UPLOAD_TIMEOUT = 60000;

/** The student's own book pages (photos or short PDFs), read by the Librarian. */
export const documentService = {
  list: ({ subject, topicId } = {}) =>
    apiClient
      .get('/student/documents', { params: { subject, topic_id: topicId } })
      .then(unwrap),

  upload: ({ file, subject, topicId, title }) => {
    const form = new FormData();
    form.append('file', file);
    form.append('subject', subject);
    if (topicId) form.append('topic_id', topicId);
    if (title) form.append('title', title);
    return apiClient
      .post('/student/documents', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: UPLOAD_TIMEOUT,
      })
      .then(unwrap);
  },

  remove: (id) => apiClient.delete(`/student/documents/${id}`).then(unwrap),

  filePath: (id) => `/student/documents/${id}/file`,
};
