import api from './axios';

// Inbound API
export const getInbounds = (params) => api.get('/inbounds', { params });
export const getInboundsByOrder = (orderId) => api.get('/inbounds/by-order', { params: { order_id: orderId } });
export const getInbound = (id) => api.get(`/inbounds/${id}`);
export const createInbound = (data) => api.post('/inbounds', data);
export const updateInboundStatus = (id, status) => api.patch(`/inbounds/${id}/status`, { status });
export const setInboundWasteStream = (id, wasteStreamId) => api.patch(`/inbounds/${id}/waste-stream`, { waste_stream_id: wasteStreamId });

// Sequential weighing flow
export const triggerNextWeighing = (id, data) => api.post(`/inbounds/${id}/weighing`, data);
export const registerParcel = (id, data) => api.post(`/inbounds/${id}/parcels`, data);
export const overrideWeight = (id, data) => api.post(`/inbounds/${id}/weight-override`, data);

export const assetLookup = (label) => api.get('/inbounds/asset-lookup', { params: { label } });
export const downloadTicketPdf = (id) => api.get(`/inbounds/${id}/ticket/pdf`, { responseType: 'blob' });

export function setInboundIncident(inboundId, data) {
  return api.patch(`/inbounds/${inboundId}/incident`, data);
}

export function confirmWeighing(inboundId, sequence) {
  return api.post(`/inbounds/${inboundId}/weighing/${sequence}/confirm`);
}

export function getWeighingAmendments(inboundId, sequence) {
  return api.get(`/inbounds/${inboundId}/weighing/${sequence}/amendments`);
}
