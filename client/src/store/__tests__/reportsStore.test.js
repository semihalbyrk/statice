import { describe, it, expect, vi, beforeEach } from 'vitest';
import useReportsStore from '../reportsStore';

// Mock API module
const mockGetReports = vi.fn();
const mockGenerateReport = vi.fn();
const mockDeleteReport = vi.fn();
const mockGetSchedules = vi.fn();

vi.mock('../../api/reports', () => ({
  getReports: (...args) => mockGetReports(...args),
  generateReport: (...args) => mockGenerateReport(...args),
  deleteReport: (...args) => mockDeleteReport(...args),
  getSchedules: (...args) => mockGetSchedules(...args),
}));

describe('reportsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useReportsStore.setState({
      reports: [],
      totalCount: 0,
      loading: false,
      error: null,
      generating: false,
      generatedReport: null,
      selectedType: 'RPT-01',
      schedules: [],
      schedulesLoading: false,
    });
  });

  it('has correct initial state', () => {
    const state = useReportsStore.getState();
    expect(state.reports).toEqual([]);
    expect(state.totalCount).toBe(0);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.generating).toBe(false);
    expect(state.generatedReport).toBeNull();
    expect(state.selectedType).toBe('RPT-01');
    expect(state.schedules).toEqual([]);
    expect(state.schedulesLoading).toBe(false);
  });

  it('setSelectedType updates type and clears generated report', () => {
    useReportsStore.setState({ generatedReport: { id: 'r1' } });

    useReportsStore.getState().setSelectedType('RPT-02');

    const state = useReportsStore.getState();
    expect(state.selectedType).toBe('RPT-02');
    expect(state.generatedReport).toBeNull();
  });

  it('fetchReports fetches and stores reports', async () => {
    const reports = [
      { id: 'r1', report_type: 'RPT-01', status: 'COMPLETED' },
      { id: 'r2', report_type: 'RPT-02', status: 'COMPLETED' },
    ];
    mockGetReports.mockResolvedValue({ data: { data: reports, total: 15 } });

    await useReportsStore.getState().fetchReports({ page: 1, limit: 20 });

    expect(mockGetReports).toHaveBeenCalledWith({ page: 1, limit: 20 });
    expect(useReportsStore.getState().reports).toEqual(reports);
    expect(useReportsStore.getState().totalCount).toBe(15);
    expect(useReportsStore.getState().loading).toBe(false);
  });

  it('fetchReports sets loading true then false', async () => {
    mockGetReports.mockResolvedValue({ data: { data: [], total: 0 } });

    const promise = useReportsStore.getState().fetchReports({});
    expect(useReportsStore.getState().loading).toBe(true);

    await promise;
    expect(useReportsStore.getState().loading).toBe(false);
  });

  it('fetchReports handles errors gracefully', async () => {
    mockGetReports.mockRejectedValue({ response: { data: { error: 'Access denied' } } });

    await useReportsStore.getState().fetchReports({});

    expect(useReportsStore.getState().error).toBe('Access denied');
    expect(useReportsStore.getState().loading).toBe(false);
  });

  it('fetchReports uses fallback error message', async () => {
    mockGetReports.mockRejectedValue(new Error('Network error'));

    await useReportsStore.getState().fetchReports({});

    expect(useReportsStore.getState().error).toBe('Failed to load reports');
  });

  it('generateReport generates and stores report, then refreshes list', async () => {
    const generated = { id: 'r3', report_type: 'RPT-01', file_name: 'report.pdf' };
    mockGenerateReport.mockResolvedValue({ data: { data: generated } });
    mockGetReports.mockResolvedValue({ data: { data: [generated], total: 1 } });

    const result = await useReportsStore.getState().generateReport({
      report_type: 'RPT-01',
      date_from: '2026-01-01',
      date_to: '2026-03-01',
    });

    expect(mockGenerateReport).toHaveBeenCalledWith({
      report_type: 'RPT-01',
      date_from: '2026-01-01',
      date_to: '2026-03-01',
    });
    expect(result).toEqual(generated);
    expect(useReportsStore.getState().generatedReport).toEqual(generated);
    expect(useReportsStore.getState().generating).toBe(false);
    // Should also trigger a refresh of the reports list
    expect(mockGetReports).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });

  it('generateReport sets generating true then false', async () => {
    mockGenerateReport.mockResolvedValue({ data: { data: { id: 'r1' } } });
    mockGetReports.mockResolvedValue({ data: { data: [], total: 0 } });

    const promise = useReportsStore.getState().generateReport({ report_type: 'RPT-01' });
    expect(useReportsStore.getState().generating).toBe(true);

    await promise;
    expect(useReportsStore.getState().generating).toBe(false);
  });

  it('generateReport handles errors and re-throws', async () => {
    mockGenerateReport.mockRejectedValue({ response: { data: { error: 'Invalid date range' } } });

    await expect(
      useReportsStore.getState().generateReport({ report_type: 'RPT-01' })
    ).rejects.toBeTruthy();

    expect(useReportsStore.getState().error).toBe('Invalid date range');
    expect(useReportsStore.getState().generating).toBe(false);
  });

  it('clearGenerated resets generatedReport to null', () => {
    useReportsStore.setState({ generatedReport: { id: 'r1', file_name: 'report.pdf' } });

    useReportsStore.getState().clearGenerated();

    expect(useReportsStore.getState().generatedReport).toBeNull();
  });

  it('deleteReport removes report from list and decrements count', async () => {
    useReportsStore.setState({
      reports: [
        { id: 'r1', report_type: 'RPT-01' },
        { id: 'r2', report_type: 'RPT-02' },
      ],
      totalCount: 5,
    });
    mockDeleteReport.mockResolvedValue({});

    await useReportsStore.getState().deleteReport('r1');

    expect(mockDeleteReport).toHaveBeenCalledWith('r1');
    expect(useReportsStore.getState().reports).toEqual([{ id: 'r2', report_type: 'RPT-02' }]);
    expect(useReportsStore.getState().totalCount).toBe(4);
  });

  it('deleteReport re-throws on error', async () => {
    mockDeleteReport.mockRejectedValue(new Error('Server error'));

    await expect(useReportsStore.getState().deleteReport('r1')).rejects.toThrow('Server error');
  });

  it('fetchSchedules fetches and stores schedules', async () => {
    const schedules = [
      { id: 'sch-1', name: 'Weekly Downstream', cron: '0 8 * * 1' },
    ];
    mockGetSchedules.mockResolvedValue({ data: { data: schedules } });

    await useReportsStore.getState().fetchSchedules();

    expect(mockGetSchedules).toHaveBeenCalled();
    expect(useReportsStore.getState().schedules).toEqual(schedules);
    expect(useReportsStore.getState().schedulesLoading).toBe(false);
  });

  it('fetchSchedules sets schedulesLoading true then false', async () => {
    mockGetSchedules.mockResolvedValue({ data: { data: [] } });

    const promise = useReportsStore.getState().fetchSchedules();
    expect(useReportsStore.getState().schedulesLoading).toBe(true);

    await promise;
    expect(useReportsStore.getState().schedulesLoading).toBe(false);
  });

  it('fetchSchedules handles errors and resets loading', async () => {
    mockGetSchedules.mockRejectedValue(new Error('Network error'));

    await useReportsStore.getState().fetchSchedules();

    expect(useReportsStore.getState().schedulesLoading).toBe(false);
  });
});
