import api from './axios';

export const getCarriers = (params) => api.get('/carriers', { params });
export const getCarrier = (id) => api.get(`/carriers/${id}`);
export const createCarrier = (data) => api.post('/carriers', data);
export const updateCarrier = (id, data) => api.put(`/carriers/${id}`, data);
export const deleteCarrier = (id) => api.delete(`/carriers/${id}`);
export const toggleCarrierStatus = (id, is_active) => api.patch(`/carriers/${id}/status`, { is_active });
