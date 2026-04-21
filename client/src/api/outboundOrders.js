import api from './axios';

export const listOutboundOrders = (params) => api.get('/outbound-orders', { params });
export const getOutboundOrder = (id) => api.get(`/outbound-orders/${id}`);
export const createOutboundOrder = (data) => api.post('/outbound-orders', data);
export const updateOutboundOrder = (id, data) => api.put(`/outbound-orders/${id}`, data);
export const cancelOutboundOrder = (id) => api.delete(`/outbound-orders/${id}`);
export const updateOutboundOrderStatus = (id, status) => api.patch(`/outbound-orders/${id}/status`, { status });
