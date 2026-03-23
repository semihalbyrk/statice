import api from './axios';

export const listContracts = (params) => api.get('/contracts', { params });
export const getContractDashboard = () => api.get('/contracts/dashboard');
export const getContract = (id) => api.get(`/contracts/${id}`);
export const createContract = (data) => api.post('/contracts', data);
export const updateContract = (id, data) => api.put(`/contracts/${id}`, data);
export const approveContract = (id) => api.post(`/contracts/${id}/approve`);
export const deactivateContract = (id) => api.post(`/contracts/${id}/terminate`);
export const addRateLine = (contractId, data) => api.post(`/contracts/${contractId}/rate-lines`, data);
export const updateRateLine = (lineId, data) => api.put(`/contracts/rate-lines/${lineId}`, data);
export const deleteRateLine = (lineId) => api.delete(`/contracts/rate-lines/${lineId}`);
export const syncContractPenalties = (contractId, feeIds) => api.put(`/contracts/${contractId}/penalties`, { fee_ids: feeIds });
export const matchContract = (params) => api.get('/contracts/match', { params });
export const matchContractForOrder = (params) => api.get('/contracts/match-for-order', { params });
export const addContractWasteStream = (contractId, data) => api.post(`/contracts/${contractId}/waste-streams`, data);
export const deleteContractWasteStream = (contractId, cwsId) => api.delete(`/contracts/${contractId}/waste-streams/${cwsId}`);
export const getSupplierContracts = (supplierId, params) => api.get(`/suppliers/${supplierId}/contracts`, { params });
