import api from './axios';

export const listMaterials = (params) => api.get('/catalogue/materials', { params });
export const createMaterial = (data) => api.post('/catalogue/materials', data);
export const updateMaterial = (id, data) => api.put(`/catalogue/materials/${id}`, data);
export const replaceMaterialFractions = (id, data) => api.put(`/catalogue/materials/${id}/fractions`, data);

export const listFractions = (params) => api.get('/catalogue/fractions', { params });
export const createFraction = (data) => api.post('/catalogue/fractions', data);
export const updateFraction = (id, data) => api.put(`/catalogue/fractions/${id}`, data);

export const listProductTypes = listMaterials;
export const createProductType = createMaterial;
export const updateProductType = updateMaterial;

export const listCatalogueEntries = (sessionId, params) => api.get(`/catalogue/sessions/${sessionId}/entries`, { params });
export const createCatalogueEntry = (sessionId, assetId, data) => api.post(`/catalogue/sessions/${sessionId}/assets/${assetId}/entries`, data);
export const updateCatalogueEntry = (entryId, data) => api.put(`/catalogue/entries/${entryId}`, data);
export const deleteCatalogueEntry = (entryId) => api.delete(`/catalogue/entries/${entryId}`);

export const listReusableItems = (sessionId, params) => api.get(`/catalogue/sessions/${sessionId}/reusables`, { params });
export const updateReusableItem = (id, data) => api.put(`/catalogue/reusables/${id}`, data);
