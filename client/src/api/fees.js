import api from './axios';

export const listFees = (params) => api.get('/fees', { params });
export const getFee = (id) => api.get(`/fees/${id}`);
export const createFee = (data) => api.post('/fees', data);
export const updateFee = (id, data) => api.put(`/fees/${id}`, data);
export const deleteFee = (id) => api.delete(`/fees/${id}`);
