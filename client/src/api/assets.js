import api from './axios';

export const getAssets = (params) => api.get('/assets', { params });
export const getAsset = (id) => api.get(`/assets/${id}`);
export const getNextLabel = (parcelType) => api.get('/assets/next-label', { params: { parcel_type: parcelType } });
export const createAsset = (data) => api.post('/assets', data);
export const updateAsset = (id, data) => api.put(`/assets/${id}`, data);
export const deleteAsset = (id) => api.delete(`/assets/${id}`);
export const lookupAssetByLabel = (label) => api.get('/assets/lookup', { params: { label } });
