import { apiClient, unwrap } from './api';

export const profileService = {
  get: () => apiClient.get('/profile').then(unwrap),

  update: (changes) => apiClient.patch('/profile', changes).then(unwrap),

  uploadAvatar: (file) => {
    const form = new FormData();
    form.append('file', file);
    // The client defaults to JSON, which would make axios serialize the FormData as JSON.
    // With multipart set, axios hands the FormData to the browser, which adds the boundary.
    return apiClient
      .post('/profile/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then(unwrap);
  },

  removeAvatar: () => apiClient.delete('/profile/avatar').then(unwrap),
};
