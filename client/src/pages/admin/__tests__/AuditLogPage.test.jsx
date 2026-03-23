import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuditLogPage from '../AuditLogPage';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

// Mock admin API
const mockGetAuditLogs = vi.fn();
const mockGetUsers = vi.fn();
vi.mock('../../../api/admin', () => ({
  getAuditLogs: (...args) => mockGetAuditLogs(...args),
  getUsers: (...args) => mockGetUsers(...args),
}));

function renderAuditLogPage() {
  return render(<AuditLogPage />);
}

describe('AuditLogPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuditLogs.mockResolvedValue({ data: { entries: [], total: 0 } });
    mockGetUsers.mockResolvedValue({ data: { users: [] } });
  });

  it('renders the page title', () => {
    renderAuditLogPage();
    expect(screen.getByText('Audit Log')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    mockGetAuditLogs.mockReturnValue(new Promise(() => {}));
    renderAuditLogPage();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows "No log entries match your filters" when list is empty', async () => {
    renderAuditLogPage();
    await waitFor(() => {
      expect(screen.getByText('No log entries match your filters')).toBeInTheDocument();
    });
  });

  it('renders table headers', async () => {
    renderAuditLogPage();
    await waitFor(() => {
      expect(screen.getByText('Timestamp')).toBeInTheDocument();
    });
    // Several header labels also appear in filter labels/options, so use getAllByText
    expect(screen.getAllByText('User').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Action').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Object')).toBeInTheDocument();
    expect(screen.getByText('Changes')).toBeInTheDocument();
  });

  it('renders filter controls', () => {
    renderAuditLogPage();
    expect(screen.getByText('All Users')).toBeInTheDocument();
    expect(screen.getByText('All Types')).toBeInTheDocument();
    expect(screen.getByText('All Actions')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Object ID...')).toBeInTheDocument();
  });

  it('renders total entries count', async () => {
    mockGetAuditLogs.mockResolvedValue({ data: { entries: [], total: 142 } });
    renderAuditLogPage();
    await waitFor(() => {
      expect(screen.getByText('142 entries')).toBeInTheDocument();
    });
  });

  it('renders audit log entries after data loads', async () => {
    mockGetAuditLogs.mockResolvedValue({
      data: {
        entries: [
          {
            id: 'al1',
            timestamp: '2026-03-22T09:15:00Z',
            action: 'CREATE',
            entity_type: 'InboundOrder',
            entity_id: 'abc12345-def6-7890',
            user: { full_name: 'Pieter van den Berg', email: 'pieter@statice.nl' },
            diff_json: { before: {}, after: { status: 'PLANNED' } },
          },
          {
            id: 'al2',
            timestamp: '2026-03-22T10:30:00Z',
            action: 'UPDATE',
            entity_type: 'Asset',
            entity_id: 'xyz98765-ghi4-3210',
            user: { full_name: 'Anneke de Groot', email: 'anneke@statice.nl' },
            diff_json: { before: { weight_kg: 120 }, after: { weight_kg: 135 } },
          },
        ],
        total: 2,
      },
    });

    renderAuditLogPage();

    await waitFor(() => {
      expect(screen.getByText('Pieter van den Berg')).toBeInTheDocument();
    });

    expect(screen.getByText('pieter@statice.nl')).toBeInTheDocument();
    // "CREATE" also appears in the action filter dropdown
    expect(screen.getAllByText('CREATE').length).toBeGreaterThanOrEqual(2);
    // "InboundOrder" also appears in the entity type filter dropdown
    expect(screen.getAllByText('InboundOrder').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('abc12345')).toBeInTheDocument();

    expect(screen.getByText('Anneke de Groot')).toBeInTheDocument();
    expect(screen.getByText('anneke@statice.nl')).toBeInTheDocument();
    // "UPDATE" also appears in the action filter dropdown
    expect(screen.getAllByText('UPDATE').length).toBeGreaterThanOrEqual(1);
    // "Asset" also appears in the entity type filter dropdown
    expect(screen.getAllByText('Asset').length).toBeGreaterThanOrEqual(1);
  });

  it('populates user filter dropdown with fetched users', async () => {
    mockGetUsers.mockResolvedValue({
      data: {
        users: [
          { id: 'u1', full_name: 'Pieter van den Berg' },
          { id: 'u2', full_name: 'Anneke de Groot' },
        ],
      },
    });

    renderAuditLogPage();

    await waitFor(() => {
      expect(mockGetUsers).toHaveBeenCalledWith({ limit: 999 });
    });
  });

  it('expands a row to show diff on click', async () => {
    const user = userEvent.setup();
    mockGetAuditLogs.mockResolvedValue({
      data: {
        entries: [
          {
            id: 'al1',
            timestamp: '2026-03-22T09:15:00Z',
            action: 'UPDATE',
            entity_type: 'Supplier',
            entity_id: 'sup12345-abcd-efgh',
            user: { full_name: 'Admin Beheerder', email: 'admin@statice.nl' },
            diff_json: { before: { name: 'Oude Naam BV' }, after: { name: 'Nieuwe Naam BV' } },
          },
        ],
        total: 1,
      },
    });

    renderAuditLogPage();

    await waitFor(() => {
      expect(screen.getByText('Admin Beheerder')).toBeInTheDocument();
    });

    // Click row to expand
    await user.click(screen.getByText('Admin Beheerder'));

    await waitFor(() => {
      expect(screen.getByText('Before')).toBeInTheDocument();
      expect(screen.getByText('After')).toBeInTheDocument();
    });
  });

  it('handles API error gracefully', async () => {
    const toast = await import('react-hot-toast');
    mockGetAuditLogs.mockRejectedValue(new Error('Network error'));

    renderAuditLogPage();

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Failed to load audit logs');
    });
  });
});
