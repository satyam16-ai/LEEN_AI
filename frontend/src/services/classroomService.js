import { apiClient, unwrap } from './api';

export const classroomService = {
  // Teacher side
  listTeaching: () => apiClient.get('/teacher/classes').then(unwrap),
  get: (classId) => apiClient.get(`/teacher/classes/${classId}`).then(unwrap),
  create: (values) => apiClient.post('/teacher/classes', values).then(unwrap),
  update: (classId, changes) =>
    apiClient.patch(`/teacher/classes/${classId}`, changes).then(unwrap),
  remove: (classId) =>
    apiClient.delete(`/teacher/classes/${classId}`).then((res) => res.data.message),
  regenerateCode: (classId) => apiClient.post(`/teacher/classes/${classId}/join-code`).then(unwrap),
  removeStudent: (classId, studentId) =>
    apiClient
      .delete(`/teacher/classes/${classId}/students/${studentId}`)
      .then((res) => res.data.message),

  // Student side
  listMine: () => apiClient.get('/student/classes').then(unwrap),
  join: (code) => apiClient.post('/student/classes/join', { code }).then(unwrap),
  leave: (classId) =>
    apiClient.delete(`/student/classes/${classId}`).then((res) => res.data.message),
};
