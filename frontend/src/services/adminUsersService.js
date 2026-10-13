import { apiClient, unwrap } from './api';

export const adminUsersService = {
  list: ({ role, status, search, page = 1, pageSize = 10 } = {}) =>
    apiClient
      .get('/admin/users', {
        params: {
          role: role || undefined,
          status: status || undefined,
          search: search || undefined,
          page,
          page_size: pageSize,
        },
      })
      .then(unwrap),

  get: (userId) => apiClient.get(`/admin/users/${userId}`).then(unwrap),

  create: ({ name, email, password, role }) =>
    apiClient.post('/admin/users', { name, email, password, role }).then(unwrap),

  update: (userId, changes) => apiClient.patch(`/admin/users/${userId}`, changes).then(unwrap),

  sendPasswordReset: (userId) =>
    apiClient.post(`/admin/users/${userId}/password-reset`).then((res) => res.data.message),
};
