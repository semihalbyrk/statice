import api from './axios';

export const getDashboardStats = () => api.get('/dashboard/stats');
