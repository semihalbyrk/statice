import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestUse = vi.fn();
const responseUse = vi.fn();
const createdInstance = {
  interceptors: {
    request: { use: requestUse },
    response: { use: responseUse },
  },
};

const create = vi.fn(() => createdInstance);

vi.mock('axios', () => ({
  default: {
    create,
  },
}));

const clearAuth = vi.fn();
const setAuth = vi.fn();
const getState = vi.fn(() => ({
  accessToken: 'existing-token',
  user: { id: 'u-1' },
  clearAuth,
  setAuth,
}));

vi.mock('../../store/authStore', () => ({
  default: {
    getState,
  },
}));

describe('api axios interceptor', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    create.mockReturnValue(createdInstance);
    responseUse.mockImplementation(() => {});
    requestUse.mockImplementation(() => {});
    global.window = { location: { href: '/dashboard' } };
  });

  it('does not try refresh for /auth/login 401 responses', async () => {
    await import('../axios');

    const responseRejected = responseUse.mock.calls[0][1];
    const error = {
      response: { status: 401, data: { error: 'Invalid credentials' } },
      config: { url: '/auth/login', headers: {} },
    };

    await expect(responseRejected(error)).rejects.toBe(error);
    expect(clearAuth).not.toHaveBeenCalled();
    expect(window.location.href).toBe('/dashboard');
  });
});
