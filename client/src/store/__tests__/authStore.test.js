import { describe, it, expect, beforeEach } from 'vitest';
import useAuthStore from '../authStore';

describe('authStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useAuthStore.setState({ accessToken: null, user: null });
  });

  it('has correct initial state', () => {
    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated()).toBe(false);
  });

  it('setAuth stores token and user', () => {
    const mockUser = { id: 1, email: 'admin@statice.nl', role: 'ADMIN', full_name: 'Admin User' };
    useAuthStore.getState().setAuth('test-token-123', mockUser);

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('test-token-123');
    expect(state.user).toEqual(mockUser);
  });

  it('isAuthenticated returns true when token is set', () => {
    useAuthStore.getState().setAuth('valid-token', { id: 1 });
    expect(useAuthStore.getState().isAuthenticated()).toBe(true);
  });

  it('isAuthenticated returns false when token is null', () => {
    expect(useAuthStore.getState().isAuthenticated()).toBe(false);
  });

  it('clearAuth resets token and user to null', () => {
    useAuthStore.getState().setAuth('token', { id: 1, email: 'test@statice.nl' });
    expect(useAuthStore.getState().isAuthenticated()).toBe(true);

    useAuthStore.getState().clearAuth();

    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated()).toBe(false);
  });

  it('setAuth overwrites previous auth data', () => {
    const user1 = { id: 1, email: 'user1@statice.nl', role: 'ADMIN' };
    const user2 = { id: 2, email: 'user2@statice.nl', role: 'GATE_OPERATOR' };

    useAuthStore.getState().setAuth('token-1', user1);
    expect(useAuthStore.getState().user.email).toBe('user1@statice.nl');

    useAuthStore.getState().setAuth('token-2', user2);
    expect(useAuthStore.getState().accessToken).toBe('token-2');
    expect(useAuthStore.getState().user.email).toBe('user2@statice.nl');
  });
});
