import api from './axios';

export const listProcessingRecords = (sessionId, params) => api.get(`/processing/sessions/${sessionId}/records`, { params });
export const createProcessingRecord = (sessionId, payload) => api.post(`/processing/sessions/${sessionId}/records`, payload);
export const getProcessingHistory = (recordId) => api.get(`/processing/records/${recordId}/history`);

export const createProcessingOutcome = (recordId, data) => api.post(`/processing/records/${recordId}/outcomes`, data);
export const updateProcessingOutcome = (outcomeId, data) => api.put(`/processing/outcomes/${outcomeId}`, data);
export const deleteProcessingOutcome = (outcomeId) => api.delete(`/processing/outcomes/${outcomeId}`);

export const finalizeAssetProcessing = (sessionId, assetId) => api.post(`/processing/sessions/${sessionId}/assets/${assetId}/finalize`);
export const confirmAssetProcessing = (sessionId, assetId) => api.post(`/processing/sessions/${sessionId}/assets/${assetId}/confirm`);
export const reopenAssetProcessing = (sessionId, assetId, data) => api.post(`/processing/sessions/${sessionId}/assets/${assetId}/reopen`, data);
