import api from './axios';

export const getSuppliers = (params) => api.get('/suppliers', { params });
export const getSupplier = (id) => api.get(`/suppliers/${id}`);
export const createSupplier = (data) => api.post('/suppliers', data);
export const updateSupplier = (id, data) => api.put(`/suppliers/${id}`, data);
export const deleteSupplier = (id) => api.delete(`/suppliers/${id}`);

export function getSupplierAfvalstroomnummers(supplierId) {
  return api.get(`/suppliers/${supplierId}/afvalstroomnummers`);
}

export function createSupplierAfvalstroomnummer(supplierId, data) {
  return api.post(`/suppliers/${supplierId}/afvalstroomnummers`, data);
}

export function deleteSupplierAfvalstroomnummer(supplierId, afsId) {
  return api.delete(`/suppliers/${supplierId}/afvalstroomnummers/${afsId}`);
}
