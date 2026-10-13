import { apiClient, unwrap } from './api';

export const familyService = {
  // Student side
  getLinkCode: () => apiClient.get('/student/link-code').then(unwrap),
  regenerateLinkCode: () => apiClient.post('/student/link-code').then(unwrap),
  listParents: () => apiClient.get('/student/parents').then(unwrap),
  removeParent: (parentId) =>
    apiClient.delete(`/student/parents/${parentId}`).then((res) => res.data.message),

  // Parent side
  listChildren: () => apiClient.get('/parent/children').then(unwrap),
  linkChild: (code) => apiClient.post('/parent/children', { code }).then(unwrap),
  unlinkChild: (studentId) =>
    apiClient.delete(`/parent/children/${studentId}`).then((res) => res.data.message),
};
