import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../LoginPage';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

// Mock axios api
const mockPost = vi.fn();
vi.mock('../../../api/axios', () => ({
  default: { post: (...args) => mockPost(...args) },
}));

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// Mock auth store
const mockSetAuth = vi.fn();
vi.mock('../../../store/authStore', () => ({
  default: (selector) => {
    const state = { setAuth: mockSetAuth };
    return selector(state);
  },
}));

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <LoginPage />
    </MemoryRouter>
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the login form with title and subtitle', () => {
    renderLoginPage();
    expect(screen.getByText('STATICE MRF')).toBeInTheDocument();
    expect(screen.getByText('Material Recovery Facility Dashboard')).toBeInTheDocument();
  });

  it('renders email and password input fields', () => {
    renderLoginPage();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('renders the Sign In button', () => {
    renderLoginPage();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
  });

  it('renders the footer text', () => {
    renderLoginPage();
    expect(screen.getByText(/Statice B\.V\./)).toBeInTheDocument();
  });

  it('allows typing in email and password fields', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    const emailInput = screen.getByLabelText('Email address');
    const passwordInput = screen.getByLabelText('Password');

    await user.type(emailInput, 'admin@statice.nl');
    await user.type(passwordInput, 'Admin1234!');

    expect(emailInput).toHaveValue('admin@statice.nl');
    expect(passwordInput).toHaveValue('Admin1234!');
  });

  it('calls api.post and navigates on successful login', async () => {
    const user = userEvent.setup();
    mockPost.mockResolvedValueOnce({
      data: {
        accessToken: 'test-token',
        user: { id: 1, email: 'admin@statice.nl', role: 'ADMIN' },
      },
    });

    renderLoginPage();

    await user.type(screen.getByLabelText('Email address'), 'admin@statice.nl');
    await user.type(screen.getByLabelText('Password'), 'Admin1234!');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/auth/login', {
        email: 'admin@statice.nl',
        password: 'Admin1234!',
      });
    });

    expect(mockSetAuth).toHaveBeenCalledWith('test-token', {
      id: 1,
      email: 'admin@statice.nl',
      role: 'ADMIN',
    });
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('shows error message on failed login', async () => {
    const user = userEvent.setup();
    mockPost.mockRejectedValueOnce({
      response: { data: { error: 'Invalid credentials' } },
    });

    renderLoginPage();

    await user.type(screen.getByLabelText('Email address'), 'bad@statice.nl');
    await user.type(screen.getByLabelText('Password'), 'wrongpass');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  it('shows generic error when response has no error message', async () => {
    const user = userEvent.setup();
    mockPost.mockRejectedValueOnce({ response: { data: {} } });

    renderLoginPage();

    await user.type(screen.getByLabelText('Email address'), 'test@statice.nl');
    await user.type(screen.getByLabelText('Password'), 'test');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(screen.getByText('Login failed. Please try again.')).toBeInTheDocument();
    });
  });

  it('shows "Signing in..." while loading', async () => {
    const user = userEvent.setup();
    // Make the API call hang indefinitely
    mockPost.mockReturnValueOnce(new Promise(() => {}));

    renderLoginPage();

    await user.type(screen.getByLabelText('Email address'), 'admin@statice.nl');
    await user.type(screen.getByLabelText('Password'), 'Admin1234!');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(screen.getByText('Signing in...')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
