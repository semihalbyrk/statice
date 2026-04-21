import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Refresh access token this many ms before it actually expires,
// to avoid 401 round-trips on the next request.
const REFRESH_LEEWAY_MS = 60 * 1000;

let refreshTimer = null;

function decodeJwtExpMs(token) {
  try {
    const payload = JSON.parse(
      atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
    );
    if (typeof payload.exp !== 'number') return null;
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

function clearRefreshTimer() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

function scheduleRefresh(token) {
  clearRefreshTimer();
  const expMs = decodeJwtExpMs(token);
  if (!expMs) return;
  const delay = Math.max(expMs - Date.now() - REFRESH_LEEWAY_MS, 0);
  refreshTimer = setTimeout(async () => {
    // Lazy import to avoid circular dep (axios → authStore).
    const { default: api } = await import('../api/axios');
    try {
      const { data } = await api.post('/auth/refresh');
      if (data?.accessToken) {
        useAuthStore.getState().setAuth(data.accessToken, data.user ?? useAuthStore.getState().user);
      }
    } catch {
      // Refresh failed — interceptor handles user-facing cleanup on next request.
      useAuthStore.getState().clearAuth();
    }
  }, delay);
}

const useAuthStore = create(
  persist(
    (set, get) => ({
      accessToken: null, // kept in memory only, never persisted
      user: null,
      isBootstrapping: true,

      setAuth: (token, user) => {
        set({ accessToken: token, user });
        if (token) scheduleRefresh(token);
      },

      clearAuth: () => {
        clearRefreshTimer();
        try {
          localStorage.removeItem('statice-last-activity');
        } catch {
          // ignore
        }
        set({ accessToken: null, user: null });
      },

      setBootstrapping: (value) => set({ isBootstrapping: value }),

      isAuthenticated: () => !!get().accessToken,
    }),
    {
      name: 'statice-auth',
      storage: createJSONStorage(() => {
        // Guard against environments where localStorage is unavailable
        // or broken (e.g. some Node test runners). Fall back to a no-op.
        try {
          if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
            return localStorage;
          }
        } catch {
          // ignore
        }
        const mem = new Map();
        return {
          getItem: (k) => (mem.has(k) ? mem.get(k) : null),
          setItem: (k, v) => mem.set(k, v),
          removeItem: (k) => mem.delete(k),
        };
      }),
      // Persist only the user object so UI can render instantly on reload.
      // Access token stays in memory (XSS hardening); refresh cookie is HttpOnly.
      partialize: (state) => ({ user: state.user }),
    }
  )
);

export default useAuthStore;
