import api from './axios';

export const listIncomingParcels = (params) => api.get('/assets', { params });
export const getIncomingParcel = (id) => api.get(`/assets/${id}`);
