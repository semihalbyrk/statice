import api from './axios';

export const listIncomingParcels = (params) => api.get('/assets', { params });
export const getIncomingParcel = (id) => api.get(`/assets/${id}`);

export const listOutgoingParcels = (params) => api.get('/outbound-parcels', { params });
export const getOutgoingParcel = (id) => api.get(`/outbound-parcels/${id}`);
export const createOutgoingParcel = (data) => api.post('/outbound-parcels', data);
export const updateOutgoingParcel = (id, data) => api.put(`/outbound-parcels/${id}`, data);
export const deleteOutgoingParcel = (id) => api.delete(`/outbound-parcels/${id}`);

export const listOutboundParcels = (outboundId) => api.get(`/outbounds/${outboundId}/parcels`);
export const attachParcelsToOutbound = (outboundId, parcelIds) =>
  api.post(`/outbounds/${outboundId}/parcels`, { parcelIds });
export const detachParcelFromOutbound = (outboundId, parcelId) =>
  api.delete(`/outbounds/${outboundId}/parcels/${parcelId}`);
