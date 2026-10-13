import { createBrowserRouter, Navigate } from 'react-router-dom';

import { GuestOnly, RequireAuth, RequireRole, RoleRedirect } from '@/features/auth';
import { AppLayout, AuthLayout, PublicLayout, RootLayout } from '@/layouts';
import {
  AdminDashboardPage,
  AdminUserDetailPage,
  AdminUsersPage,
  AppearanceSettingsPage,
  ForbiddenPage,
  ForgotPasswordPage,
  LandingPage,
  LoginPage,
  NotFoundPage,
  ParentChildrenPage,
  ParentDashboardPage,
  ProfileSettingsPage,
  RegisterPage,
  ResetPasswordPage,
  RouteErrorPage,
  SecuritySettingsPage,
  SettingsLayout,
  StudentClassesPage,
  StudentDashboardPage,
  StudentDoubtsPage,
  StudentOnboardingPage,
  StudentParentAccessPage,
  TeacherClassDetailPage,
  TeacherClassesPage,
  TeacherDashboardPage,
} from '@/pages';

const page = (path, element, title) => ({ path, element, handle: { title } });

/** Route tree; exported separately so tests can mount it in a memory router. */
export const routes = [
  {
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { element: <PublicLayout />, children: [{ index: true, element: <LandingPage /> }] },

      {
        element: <GuestOnly />,
        children: [
          {
            element: <AuthLayout />,
            children: [
              { path: 'login', element: <LoginPage /> },
              { path: 'register', element: <RegisterPage /> },
              { path: 'forgot-password', element: <ForgotPasswordPage /> },
            ],
          },
        ],
      },
      // Reachable while signed in too, so an emailed link always works.
      {
        element: <AuthLayout />,
        children: [{ path: 'reset-password', element: <ResetPasswordPage /> }],
      },

      {
        element: <RequireAuth />,
        children: [
          { path: 'app', element: <RoleRedirect /> },
          {
            element: <AppLayout />,
            children: [
              {
                element: <RequireRole roles={['student']} />,
                children: [
                  page('student', <StudentDashboardPage />, 'Dashboard'),
                  page('student/onboarding', <StudentOnboardingPage />, 'Learning profile'),
                  page('student/classes', <StudentClassesPage />, 'My classes'),
                  page('student/parent-access', <StudentParentAccessPage />, 'Parent access'),
                  // One route (optional id) so the page stays mounted while a live doubt gets its URL.
                  page('student/doubts/:doubtId?', <StudentDoubtsPage />, 'Ask a doubt'),
                ],
              },
              {
                element: <RequireRole roles={['parent']} />,
                children: [
                  page('parent', <ParentDashboardPage />, 'Dashboard'),
                  page('parent/children', <ParentChildrenPage />, 'My children'),
                ],
              },
              {
                element: <RequireRole roles={['teacher']} />,
                children: [
                  page('teacher', <TeacherDashboardPage />, 'Dashboard'),
                  page('teacher/classes', <TeacherClassesPage />, 'Classes'),
                  page('teacher/classes/:classId', <TeacherClassDetailPage />, 'Class'),
                ],
              },
              {
                element: <RequireRole roles={['admin']} />,
                children: [
                  page('admin', <AdminDashboardPage />, 'Dashboard'),
                  page('admin/users', <AdminUsersPage />, 'Users'),
                  page('admin/users/:userId', <AdminUserDetailPage />, 'User'),
                ],
              },
              {
                path: 'settings',
                element: <SettingsLayout />,
                children: [
                  { index: true, element: <Navigate to="profile" replace /> },
                  page('profile', <ProfileSettingsPage />, 'Settings'),
                  page('security', <SecuritySettingsPage />, 'Settings'),
                  page('appearance', <AppearanceSettingsPage />, 'Settings'),
                ],
              },
            ],
          },
        ],
      },

      { path: '403', element: <ForbiddenPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
