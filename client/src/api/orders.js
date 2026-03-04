import api from './axios';

export const getOrders = (params) => api.get('/orders', { params });
export const getOrder = (id) => api.get(`/orders/${id}`);
export const createOrder = (data) => api.post('/orders', data);
export const updateOrder = (id, data) => api.put(`/orders/${id}`, data);
export const cancelOrder = (id) => api.delete(`/orders/${id}`);
export const matchPlate = (plate) => api.get('/orders/match-plate', { params: { plate } });
export const arriveOrder = (id) => api.post(`/orders/${id}/arrive`);
export const createAdhocArrival = (data) => api.post('/orders/adhoc-arrival', data);
