import { apiClient, unwrap } from './api';

export const authService = {
  /** Current user, or null when signed out. */
  async me() {
    try {
      return unwrap(await apiClient.get('/auth/me'));
    } catch (error) {
      if (error.response?.status === 401) return null;
      throw error;
    }
  },

  login: ({ email, password, rememberMe }) =>
    apiClient.post('/auth/login', { email, password, remember_me: rememberMe }).then(unwrap),

  register: ({ name, email, password, role }) =>
    apiClient.post('/auth/register', { name, email, password, role }).then(unwrap),

  logout: () => apiClient.post('/auth/logout'),

  forgotPassword: ({ email }) =>
    apiClient.post('/auth/forgot-password', { email }).then((res) => res.data.message),

  resetPassword: ({ token, password }) =>
    apiClient.post('/auth/reset-password', { token, password }).then((res) => res.data.message),

  changePassword: ({ currentPassword, newPassword }) =>
    apiClient
      .post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      })
      .then((res) => res.data.message),
};
