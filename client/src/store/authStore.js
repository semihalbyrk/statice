import { create } from 'zustand';

const useAuthStore = create((set, get) => ({
  accessToken: null,
  user: null,

  setAuth: (token, user) => set({ accessToken: token, user }),

  clearAuth: () => set({ accessToken: null, user: null }),

  isAuthenticated: () => !!get().accessToken,
}));

export default useAuthStore;
