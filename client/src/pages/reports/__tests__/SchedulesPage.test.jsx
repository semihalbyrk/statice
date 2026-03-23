import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SchedulesPage from '../SchedulesPage';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

// Mock reports API
vi.mock('../../../api/reports', () => ({
  createSchedule: vi.fn(),
  updateSchedule: vi.fn(),
  deleteSchedule: vi.fn(),
}));

// Mock StatusBadge
vi.mock('../../../components/ui/StatusBadge', () => ({
  default: ({ status }) => <span data-testid="status-badge">{status}</span>,
}));

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// Reports store mock
const mockFetchSchedules = vi.fn();
let mockReportsState = {};

vi.mock('../../../store/reportsStore', () => ({
  default: (selector) => {
    if (selector) return selector(mockReportsState);
    return mockReportsState;
  },
}));

function renderSchedulesPage() {
  return render(
    <MemoryRouter initialEntries={['/reports/schedules']}>
      <SchedulesPage />
    </MemoryRouter>
  );
}

describe('SchedulesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReportsState = {
      schedules: [],
      schedulesLoading: true,
      fetchSchedules: mockFetchSchedules,
    };
  });

  it('renders the page title', () => {
    renderSchedulesPage();
    expect(screen.getByText('Scheduled Reports')).toBeInTheDocument();
  });

  it('renders the subtitle', () => {
    renderSchedulesPage();
    expect(screen.getByText('Automated recurring report generation')).toBeInTheDocument();
  });

  it('calls fetchSchedules on mount', () => {
    renderSchedulesPage();
    expect(mockFetchSchedules).toHaveBeenCalled();
  });

  it('shows loading state', () => {
    renderSchedulesPage();
    expect(screen.getByText('Loading schedules...')).toBeInTheDocument();
  });

  it('shows empty state when no schedules exist', () => {
    mockReportsState = {
      ...mockReportsState,
      schedulesLoading: false,
      schedules: [],
    };

    renderSchedulesPage();
    expect(screen.getByText('No scheduled reports yet')).toBeInTheDocument();
    expect(screen.getByText('Create First Schedule')).toBeInTheDocument();
  });

  it('renders schedule rows after loading', () => {
    mockReportsState = {
      ...mockReportsState,
      schedulesLoading: false,
      schedules: [
        {
          id: 'sch-1',
          report_type: 'RPT-01',
          frequency: 'WEEKLY',
          day_of_week: 1,
          day_of_month: null,
          recipient_emails: ['admin@statice.nl', 'reporting@statice.nl'],
          format: 'PDF',
          is_active: true,
          next_run_at: '2026-03-24T08:00:00Z',
        },
        {
          id: 'sch-2',
          report_type: 'RPT-03',
          frequency: 'MONTHLY',
          day_of_week: null,
          day_of_month: 1,
          recipient_emails: ['finance@statice.nl'],
          format: 'XLSX',
          is_active: false,
          next_run_at: null,
        },
      ],
    };

    renderSchedulesPage();
    expect(screen.getByText('RPT-01')).toBeInTheDocument();
    expect(screen.getByText('Supplier Circularity Statement')).toBeInTheDocument();
    expect(screen.getByText('RPT-03')).toBeInTheDocument();
    expect(screen.getByText('Chain of Custody')).toBeInTheDocument();
    expect(screen.getByText('Monday')).toBeInTheDocument();
    expect(screen.getByText('Day 1')).toBeInTheDocument();
  });

  it('renders New Schedule button', () => {
    renderSchedulesPage();
    expect(screen.getByText('New Schedule')).toBeInTheDocument();
  });

  it('shows ACTIVE and INACTIVE status badges', () => {
    mockReportsState = {
      ...mockReportsState,
      schedulesLoading: false,
      schedules: [
        {
          id: 'sch-1',
          report_type: 'RPT-02',
          frequency: 'DAILY',
          recipient_emails: [],
          format: 'BOTH',
          is_active: true,
          next_run_at: null,
        },
        {
          id: 'sch-2',
          report_type: 'RPT-04',
          frequency: 'WEEKLY',
          day_of_week: 5,
          recipient_emails: [],
          format: 'PDF',
          is_active: false,
          next_run_at: null,
        },
      ],
    };

    renderSchedulesPage();
    const badges = screen.getAllByTestId('status-badge');
    expect(badges[0]).toHaveTextContent('ACTIVE');
    expect(badges[1]).toHaveTextContent('INACTIVE');
  });
});
