import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';

import { authService } from '@/services/authService';
import { renderRoutes } from '@/test/renderWithProviders';

import { LoginForm } from './LoginForm';

vi.mock('@/services/authService', () => ({ authService: { login: vi.fn(), me: vi.fn() } }));

function renderForm() {
  return renderRoutes([{ path: '/login', element: <LoginForm /> }], { path: '/login' });
}

afterEach(() => vi.clearAllMocks());

describe('LoginForm', () => {
  it('validates required fields before calling the API', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('submits credentials with the remember-me choice', async () => {
    const user = userEvent.setup();
    authService.login.mockResolvedValue({ id: '1', name: 'Asha Verma', role: 'student' });
    renderForm();

    await user.type(screen.getByLabelText('Email'), 'asha@leen.dev');
    await user.type(screen.getByLabelText('Password'), 'Str0ngPass1');
    await user.click(screen.getByLabelText('Keep me signed in for 30 days'));
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(authService.login).toHaveBeenCalledTimes(1);
    expect(authService.login.mock.calls[0][0]).toEqual({
      email: 'asha@leen.dev',
      password: 'Str0ngPass1',
      rememberMe: true,
    });
  });

  it('shows the server message when credentials are wrong', async () => {
    const user = userEvent.setup();
    const response = {
      status: 401,
      data: { success: false, message: 'Invalid email or password', data: null },
      headers: {},
    };
    authService.login.mockRejectedValue(
      new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', {}, null, response)
    );
    renderForm();

    await user.type(screen.getByLabelText('Email'), 'asha@leen.dev');
    await user.type(screen.getByLabelText('Password'), 'wrong-pass1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(screen.getByLabelText('Password')).toHaveValue('');
  });
});
