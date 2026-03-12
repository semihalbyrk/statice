import { create } from 'zustand';
import * as reportsApi from '../api/reports';

const useReportsStore = create((set, get) => ({
  // Report list
  reports: [],
  totalCount: 0,
  loading: false,
  error: null,

  // Generation
  generating: false,
  generatedReport: null,

  // Active report type
  selectedType: 'RPT-01',

  // Schedules
  schedules: [],
  schedulesLoading: false,

  setSelectedType: (type) => set({ selectedType: type, generatedReport: null }),

  fetchReports: async (params) => {
    set({ loading: true, error: null });
    try {
      const { data } = await reportsApi.getReports(params);
      set({ reports: data.data, totalCount: data.total, loading: false });
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to load reports', loading: false });
    }
  },

  generateReport: async (reportData) => {
    set({ generating: true, generatedReport: null, error: null });
    try {
      const { data } = await reportsApi.generateReport(reportData);
      set({ generating: false, generatedReport: data.data });
      // Refresh report list
      get().fetchReports({ page: 1, limit: 20 });
      return data.data;
    } catch (err) {
      set({ generating: false, error: err.response?.data?.error || 'Failed to generate report' });
      throw err;
    }
  },

  clearGenerated: () => set({ generatedReport: null }),

  deleteReport: async (id) => {
    try {
      await reportsApi.deleteReport(id);
      set((state) => ({
        reports: state.reports.filter((r) => r.id !== id),
        totalCount: state.totalCount - 1,
      }));
    } catch (err) {
      throw err;
    }
  },

  fetchSchedules: async () => {
    set({ schedulesLoading: true });
    try {
      const { data } = await reportsApi.getSchedules();
      set({ schedules: data.data, schedulesLoading: false });
    } catch {
      set({ schedulesLoading: false });
    }
  },
}));

export default useReportsStore;
