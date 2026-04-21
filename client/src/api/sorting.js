import api from './axios';

export const getSession = (sessionId) => api.get(`/sorting/${sessionId}`);
export const listSessions = (orderId) => api.get('/sorting', { params: { order_id: orderId } });
export const listAllSessions = (params) => api.get('/sorting', { params });
export const submitSession = (sessionId) => api.patch(`/sorting/${sessionId}/submit`);
export const markSessionSorted = (sessionId, payload = {}) =>
  api.patch(`/sorting/${sessionId}/mark-sorted`, payload);
export const reopenSession = (sessionId, data) => api.patch(`/sorting/${sessionId}/reopen`, data);
export const listLines = (sessionId, params) => api.get(`/sorting/${sessionId}/lines`, { params });
export const createLine = (sessionId, data) => api.post(`/sorting/${sessionId}/lines`, data);
export const updateLine = (sessionId, lineId, data) => api.put(`/sorting/${sessionId}/lines/${lineId}`, data);
export const deleteLine = (sessionId, lineId) => api.delete(`/sorting/${sessionId}/lines/${lineId}`);
export const getCategoryDefaults = (categoryId) => api.get(`/sorting/categories/${categoryId}/defaults`);
