import { apiClient, unwrap } from './api';

export const adminUsersService = {
  list: ({ role, search, page = 1, pageSize = 10 } = {}) =>
    apiClient
      .get('/admin/users', {
        params: {
          role: role || undefined,
          search: search || undefined,
          page,
          page_size: pageSize,
        },
      })
      .then(unwrap),

  create: ({ name, email, password, role }) =>
    apiClient.post('/admin/users', { name, email, password, role }).then(unwrap),
};
