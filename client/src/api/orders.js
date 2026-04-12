import api from './axios';

export const getOrders = (params) => api.get('/orders', { params });
export const getOrder = (id) => api.get(`/orders/${id}`);
export const createOrder = (data) => api.post('/orders', data);
export const updateOrder = (id, data) => api.put(`/orders/${id}`, data);
export const cancelOrder = (id) => api.delete(`/orders/${id}`);
export const matchPlate = (plate) => api.get('/orders/match-plate', { params: { plate } });
export const createAdhocArrival = (data) => api.post('/orders/adhoc-arrival', data);

export function getPlanningBoard(params) {
  return api.get('/orders/planning-board', { params });
}

export function setOrderIncident(orderId, data) {
  return api.post(`/orders/${orderId}/incident`, data);
}

export const getOrderDocuments = (orderId) => api.get(`/orders/${orderId}/documents`);
export const uploadOrderDocument = (orderId, formData) => api.post(`/orders/${orderId}/documents`, formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
});
export const downloadOrderDocument = (orderId, docId) => api.get(`/orders/${orderId}/documents/${docId}/download`, {
  responseType: 'blob',
});
export const deleteOrderDocument = (orderId, docId) => api.delete(`/orders/${orderId}/documents/${docId}`);
