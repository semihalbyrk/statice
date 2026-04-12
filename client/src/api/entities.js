import api from './axios';

export const getEntities = (params) => api.get('/entities', { params });
export const getEntity = (id) => api.get(`/entities/${id}`);
export const createEntity = (data) => api.post('/entities', data);
export const updateEntity = (id, data) => api.put(`/entities/${id}`, data);
export const toggleEntityStatus = (id) => api.patch(`/entities/${id}/status`);

export const getDisposerSites = (entityId) => api.get(`/entities/${entityId}/disposer-sites`);
export const createDisposerSite = (entityId, data) => api.post(`/entities/${entityId}/disposer-sites`, data);
export const updateDisposerSite = (entityId, siteId, data) => api.put(`/entities/${entityId}/disposer-sites/${siteId}`, data);
export const toggleDisposerSiteStatus = (entityId, siteId) => api.patch(`/entities/${entityId}/disposer-sites/${siteId}/status`);
