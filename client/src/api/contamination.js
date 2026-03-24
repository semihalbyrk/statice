import api from './axios';

export const listContaminationIncidents = (params) => api.get('/contamination', { params });
export const getContaminationIncident = (id) => api.get(`/contamination/${id}`);
export const recordContaminationIncident = (data) => api.post('/contamination', data);
export const updateContaminationIncident = (id, data) => api.put(`/contamination/${id}`, data);
export const getContractContaminationConfig = (contractId) => api.get(`/contamination/config/${contractId}`);
