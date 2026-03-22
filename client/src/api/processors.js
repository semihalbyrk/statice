import api from './axios';

export const listProcessors = (params) => api.get('/processors', { params });
export const createProcessor = (data) => api.post('/processors', data);
export const updateProcessor = (id, data) => api.put(`/processors/${id}`, data);
export const createProcessorCertificate = (processorId, data) => api.post(`/processors/${processorId}/certificates`, data);
export const updateProcessorCertificate = (certificateId, data) => api.put(`/processors/certificates/${certificateId}`, data);
export const validateProcessorCertificate = (params) => api.get('/processors/validate', { params });
