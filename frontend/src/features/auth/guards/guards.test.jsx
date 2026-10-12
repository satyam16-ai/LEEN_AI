import { screen } from '@testing-library/react';

import { authService } from '@/services/authService';
import { renderRoutes } from '@/test/renderWithProviders';

import { GuestOnly } from './GuestOnly';
import { RequireAuth } from './RequireAuth';
import { RequireRole } from './RequireRole';

vi.mock('@/services/authService', () => ({ authService: { me: vi.fn() } }));

const routes = [
  { element: <GuestOnly />, children: [{ path: '/login', element: <p>Login page</p> }] },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <RequireRole roles={['student']} />,
        children: [{ path: '/student', element: <p>Student home</p> }],
      },
      {
        element: <RequireRole roles={['admin']} />,
        children: [{ path: '/admin', element: <p>Admin home</p> }],
      },
    ],
  },
  { path: '/403', element: <p>Forbidden</p> },
];

const student = { id: '1', name: 'Asha Verma', email: 'asha@leen.dev', role: 'student' };

describe('route guards', () => {
  it('sends signed-out visitors to login with a return path', async () => {
    authService.me.mockResolvedValue(null);
    const { router } = renderRoutes(routes, { path: '/student' });

    expect(await screen.findByText('Login page')).toBeInTheDocument();
    expect(router.state.location.search).toBe(`?next=${encodeURIComponent('/student')}`);
  });

  it('lets a user into their own role area', async () => {
    authService.me.mockResolvedValue(student);
    renderRoutes(routes, { path: '/student' });

    expect(await screen.findByText('Student home')).toBeInTheDocument();
  });

  it('blocks a user from another role area', async () => {
    authService.me.mockResolvedValue(student);
    const { router } = renderRoutes(routes, { path: '/admin' });

    expect(await screen.findByText('Forbidden')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/403');
  });

  it('redirects signed-in users away from login, ignoring disallowed next paths', async () => {
    authService.me.mockResolvedValue(student);
    const { router } = renderRoutes(routes, { path: '/login?next=%2Fadmin' });

    expect(await screen.findByText('Student home')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/student');
  });
});
