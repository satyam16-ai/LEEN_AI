export const ROLES = Object.freeze({
  STUDENT: 'student',
  PARENT: 'parent',
  TEACHER: 'teacher',
  ADMIN: 'admin',
});

export const ROLE_HOME = Object.freeze({
  student: '/student',
  parent: '/parent',
  teacher: '/teacher',
  admin: '/admin',
});

export const ROLE_LABELS = Object.freeze({
  student: 'Student',
  parent: 'Parent',
  teacher: 'Teacher',
  admin: 'Admin',
});

/** Routes every signed-in role may visit. */
export const SHARED_PATHS = ['/settings'];

export const AUTH_QUERY_KEY = ['auth', 'me'];
