import api from './axios';

export const listOutbounds = (params) => api.get('/outbounds', { params });
export const getOutbound = (id) => api.get(`/outbounds/${id}`);
export const createOutbound = (orderId, data) => api.post(`/outbounds/order/${orderId}`, data);
export const recordWeighing = (id, data) => api.post(`/outbounds/${id}/weighings`, data);
export const generateBgl = (id) => api.post(`/outbounds/${id}/generate-bgl`);
export const confirmDeparture = (id) => api.patch(`/outbounds/${id}/depart`);
export const confirmDelivery = (id) => api.patch(`/outbounds/${id}/deliver`);
export const downloadDocument = (id, docId) => api.get(`/outbounds/${id}/documents/${docId}/download`, { responseType: 'blob' });
