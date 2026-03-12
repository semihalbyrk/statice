import api from './axios';

// Inbound API (replaces weighing events)
export const getInbounds = (params) => api.get('/inbounds', { params });
export const getInboundsByOrder = (orderId) => api.get('/inbounds/by-order', { params: { order_id: orderId } });
export const getInbound = (id) => api.get(`/inbounds/${id}`);
export const createInbound = (data) => api.post('/inbounds', data);
export const updateInboundStatus = (id, status) => api.patch(`/inbounds/${id}/status`, { status });
export const setInboundWasteStream = (id, wasteStreamId) => api.patch(`/inbounds/${id}/waste-stream`, { waste_stream_id: wasteStreamId });
export const triggerGrossWeighing = (id) => api.post(`/inbounds/${id}/gross-weighing`);
export const triggerTareWeighing = (id) => api.post(`/inbounds/${id}/tare-weighing`);
export const manualWeighing = (id, data) => api.post(`/inbounds/${id}/manual-weighing`, data);
export const overrideWeight = (id, data) => api.post(`/inbounds/${id}/weight-override`, data);
export const assetLookup = (label) => api.get('/inbounds/asset-lookup', { params: { label } });
export const downloadTicketPdf = (id) => api.get(`/inbounds/${id}/ticket/pdf`, { responseType: 'blob' });
