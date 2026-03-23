import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UsersPage from '../UsersPage';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

// Mock admin API
const mockGetUsers = vi.fn();
const mockCreateUser = vi.fn();
const mockUpdateUser = vi.fn();
const mockResetUserPassword = vi.fn();
const mockGetUserActivity = vi.fn();
const mockToggleUserStatus = vi.fn();
vi.mock('../../../api/admin', () => ({
  getUsers: (...args) => mockGetUsers(...args),
  createUser: (...args) => mockCreateUser(...args),
  updateUser: (...args) => mockUpdateUser(...args),
  resetUserPassword: (...args) => mockResetUserPassword(...args),
  getUserActivity: (...args) => mockGetUserActivity(...args),
  toggleUserStatus: (...args) => mockToggleUserStatus(...args),
}));

// Auth store mock
let mockUser = null;
vi.mock('../../../store/authStore', () => ({
  default: (selector) => {
    const state = { user: mockUser };
    return selector(state);
  },
}));

function renderUsersPage() {
  return render(<UsersPage />);
}

describe('UsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'u1', email: 'admin@statice.nl', role: 'ADMIN', full_name: 'Admin Beheerder' };
    mockGetUsers.mockResolvedValue({ data: { users: [], total: 0 } });
  });

  it('renders the page title', async () => {
    renderUsersPage();
    expect(screen.getByText('User Management')).toBeInTheDocument();
  });

  it('renders the "Add User" button', () => {
    renderUsersPage();
    expect(screen.getByText('Add User')).toBeInTheDocument();
  });

  it('renders the search input', () => {
    renderUsersPage();
    expect(screen.getByPlaceholderText('Search name or email...')).toBeInTheDocument();
  });

  it('renders filter dropdowns for role and status', () => {
    renderUsersPage();
    expect(screen.getByText('All Roles')).toBeInTheDocument();
    expect(screen.getByText('All statuses')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    mockGetUsers.mockReturnValue(new Promise(() => {}));
    renderUsersPage();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows "No users found" when list is empty', async () => {
    renderUsersPage();
    await waitFor(() => {
      expect(screen.getByText('No users found')).toBeInTheDocument();
    });
  });

  it('renders user table headers', () => {
    renderUsersPage();
    expect(screen.getByText('Full Name')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();
    expect(screen.getByText('Last Login')).toBeInTheDocument();
  });

  it('renders user rows after data loads', async () => {
    mockGetUsers.mockResolvedValue({
      data: {
        users: [
          {
            id: 'u10',
            full_name: 'Pieter van den Berg',
            email: 'pieter@statice.nl',
            role: 'GATE_OPERATOR',
            is_active: true,
            last_login_at: null,
          },
          {
            id: 'u20',
            full_name: 'Anneke de Groot',
            email: 'anneke@statice.nl',
            role: 'SORTING_EMPLOYEE',
            is_active: false,
            last_login_at: '2026-03-20T14:30:00Z',
          },
        ],
        total: 2,
      },
    });

    renderUsersPage();

    await waitFor(() => {
      expect(screen.getByText('Pieter van den Berg')).toBeInTheDocument();
    }, { timeout: 2000 });

    expect(screen.getByText('pieter@statice.nl')).toBeInTheDocument();
    // "Gate Operator" also appears in the role filter dropdown
    expect(screen.getAllByText('Gate Operator').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Anneke de Groot')).toBeInTheDocument();
    expect(screen.getByText('anneke@statice.nl')).toBeInTheDocument();
    // "Sorting Employee" also appears in the role filter dropdown
    expect(screen.getAllByText('Sorting Employee').length).toBeGreaterThanOrEqual(1);
  });

  it('shows total user count in subtitle', async () => {
    mockGetUsers.mockResolvedValue({
      data: { users: [{ id: 'u1', full_name: 'Test', email: 'test@statice.nl', role: 'ADMIN', is_active: true }], total: 7 },
    });

    renderUsersPage();

    await waitFor(() => {
      expect(screen.getByText('7 users total')).toBeInTheDocument();
    });
  });

  it('shows "Never" for users with no last login', async () => {
    mockGetUsers.mockResolvedValue({
      data: {
        users: [
          { id: 'u1', full_name: 'Jan Smit', email: 'jan@statice.nl', role: 'ADMIN', is_active: true, last_login_at: null },
        ],
        total: 1,
      },
    });

    renderUsersPage();

    await waitFor(() => {
      expect(screen.getByText('Never')).toBeInTheDocument();
    });
  });

  it('opens the create modal on "Add User" click', async () => {
    const user = userEvent.setup();
    renderUsersPage();

    await user.click(screen.getByText('Add User'));

    await waitFor(() => {
      expect(screen.getByText('New User')).toBeInTheDocument();
    });
  });

  it('handles API error gracefully', async () => {
    const toast = await import('react-hot-toast');
    mockGetUsers.mockRejectedValue(new Error('Network error'));

    renderUsersPage();

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Failed to load users');
    });
  });
});
