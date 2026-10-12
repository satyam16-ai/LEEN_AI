import { createBrowserRouter } from 'react-router-dom';

import { GuestOnly, RequireAuth, RequireRole, RoleRedirect } from '@/features/auth';
import { AppLayout, AuthLayout, PublicLayout, RootLayout } from '@/layouts';
import {
  AccountSettingsPage,
  AdminDashboardPage,
  AdminUsersPage,
  ForbiddenPage,
  ForgotPasswordPage,
  LandingPage,
  LoginPage,
  NotFoundPage,
  ParentDashboardPage,
  RegisterPage,
  ResetPasswordPage,
  RouteErrorPage,
  StudentDashboardPage,
  TeacherDashboardPage,
} from '@/pages';

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
                  {
                    path: 'student',
                    element: <StudentDashboardPage />,
                    handle: { title: 'Dashboard' },
                  },
                ],
              },
              {
                element: <RequireRole roles={['parent']} />,
                children: [
                  {
                    path: 'parent',
                    element: <ParentDashboardPage />,
                    handle: { title: 'Dashboard' },
                  },
                ],
              },
              {
                element: <RequireRole roles={['teacher']} />,
                children: [
                  {
                    path: 'teacher',
                    element: <TeacherDashboardPage />,
                    handle: { title: 'Dashboard' },
                  },
                ],
              },
              {
                element: <RequireRole roles={['admin']} />,
                children: [
                  {
                    path: 'admin',
                    element: <AdminDashboardPage />,
                    handle: { title: 'Dashboard' },
                  },
                  { path: 'admin/users', element: <AdminUsersPage />, handle: { title: 'Users' } },
                ],
              },
              {
                path: 'settings/account',
                element: <AccountSettingsPage />,
                handle: { title: 'Account settings' },
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
