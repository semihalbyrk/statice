import api from './axios';

export const listOutboundLines = (outboundId) =>
  api.get(`/outbounds/${outboundId}/lines`);

export const createOutboundLine = (outboundId, payload) =>
  api.post(`/outbounds/${outboundId}/lines`, payload);

export const updateOutboundLine = (outboundId, lineId, payload) =>
  api.put(`/outbounds/${outboundId}/lines/${lineId}`, payload);

export const deleteOutboundLine = (outboundId, lineId) =>
  api.delete(`/outbounds/${outboundId}/lines/${lineId}`);
