import api from './axios';

export const generateReport = (data) => api.post('/reports/generate', data);
export const getReports = (params) => api.get('/reports', { params });
export const downloadReport = (id, format) =>
  api.get(`/reports/${id}/download`, { params: { format }, responseType: 'blob' });
export const deleteReport = (id) => api.delete(`/reports/${id}`);

export const getSchedules = () => api.get('/reports/schedules');
export const getSchedule = (id) => api.get(`/reports/schedules/${id}`);
export const createSchedule = (data) => api.post('/reports/schedules', data);
export const updateSchedule = (id, data) => api.put(`/reports/schedules/${id}`, data);
export const deleteSchedule = (id) => api.delete(`/reports/schedules/${id}`);
