import api from './axios';

export const getWeighingEvents = (params) => api.get('/weighing-events', { params });
export const getWeighingEvent = (id) => api.get(`/weighing-events/${id}`);
export const createWeighingEvent = (data) => api.post('/weighing-events', data);
export const triggerGrossWeighing = (id) => api.post(`/weighing-events/${id}/gross-weighing`);
export const triggerTareWeighing = (id) => api.post(`/weighing-events/${id}/tare-weighing`);
export const advanceToTare = (id) => api.patch(`/weighing-events/${id}/status`);
export const confirmWeighingEvent = (id) => api.post(`/weighing-events/${id}/confirm`);
export const overrideWeight = (id, data) => api.post(`/weighing-events/${id}/weight-override`, data);
export const downloadTicketPdf = (id) => api.get(`/weighing-events/${id}/ticket/pdf`, { responseType: 'blob' });
