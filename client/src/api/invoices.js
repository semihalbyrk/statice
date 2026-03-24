import api from './axios';

export const listInvoices = (params) => api.get('/invoices', { params });
export const getInvoice = (id) => api.get(`/invoices/${id}`);
export const generateSupplierInvoice = (data) => api.post('/invoices', data);
export const updateInvoiceStatus = (id, status) => api.put(`/invoices/${id}/status`, { status });
export const addInvoiceLine = (invoiceId, data) => api.post(`/invoices/${invoiceId}/lines`, data);
export const updateInvoiceLine = (lineId, data) => api.put(`/invoices/lines/${lineId}`, data);
export const deleteInvoiceLine = (lineId) => api.delete(`/invoices/lines/${lineId}`);
export const getCompletedOrdersForInvoicing = (supplierId) => api.get(`/invoices/completed-orders/${supplierId}`);
export const getInvoicePdf = (id) => api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
