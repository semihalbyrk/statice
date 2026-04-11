import api from './axios';

export const getContainers = (params) => api.get('/containers', { params });
export const getContainer = (id) => api.get(`/containers/${id}`);
export const createContainer = (data) => api.post('/containers', data);
export const updateContainer = (id, data) => api.put(`/containers/${id}`, data);
export const deleteContainer = (id) => api.delete(`/containers/${id}`);
