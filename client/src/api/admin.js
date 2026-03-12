import api from './axios';

// Users
export const getUsers = (params) => api.get('/admin/users', { params });
export const getUser = (id) => api.get(`/admin/users/${id}`);
export const createUser = (data) => api.post('/admin/users', data);
export const updateUser = (id, data) => api.put(`/admin/users/${id}`, data);
export const resetUserPassword = (id, data) => api.post(`/admin/users/${id}/reset-password`, data);
export const getUserActivity = (id, params) => api.get(`/admin/users/${id}/activity`, { params });

// Audit Log
export const getAuditLogs = (params) => api.get('/admin/audit-logs', { params });
export const getAuditLog = (id) => api.get(`/admin/audit-logs/${id}`);

// Settings
export const getSettings = () => api.get('/admin/settings');
export const updateSettings = (data) => api.put('/admin/settings', data);

// Afvalstroomnummers
export const getAfvalstroomnummers = () => api.get('/admin/afvalstroomnummers');
