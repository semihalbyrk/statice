import api from './axios';

export const getWasteStreams = (params) => api.get('/admin/waste-streams', { params });
export const createWasteStream = (data) => api.post('/admin/waste-streams', data);
export const updateWasteStream = (id, data) => api.put(`/admin/waste-streams/${id}`, data);

export const getProductCategories = (params) => api.get('/admin/product-categories', { params });
export const createProductCategory = (data) => api.post('/admin/product-categories', data);
export const updateProductCategory = (id, data) => api.put(`/admin/product-categories/${id}`, data);
export const deleteProductCategory = (id) => api.delete(`/admin/product-categories/${id}`);
