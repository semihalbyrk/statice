import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import EntityDetailPage from '../EntityDetailPage';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const mockGetEntity = vi.fn();
const mockToggleEntityStatus = vi.fn();
vi.mock('../../../../api/entities', () => ({
  getEntity: (...args) => mockGetEntity(...args),
  toggleEntityStatus: (...args) => mockToggleEntityStatus(...args),
}));

let mockAuthState;
vi.mock('../../../../store/authStore', () => ({
  default: (selector) => selector(mockAuthState),
}));

vi.mock('../../../../components/ui/ClickableStatusBadge', () => ({
  default: ({ status, allowedTransitions = [], onTransition }) => (
    <div>
      <span>{status}</span>
      {allowedTransitions.map((transition) => (
        <button key={transition} onClick={() => onTransition(transition)}>
          detail-{transition}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('../../../../components/ui/RowActionMenu', () => ({
  default: ({ actions }) => (
    <div>
      {actions.map((action) => (
        <button key={action.label} onClick={action.onClick}>
          {action.label}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('../../../../components/entities/DisposerSiteList', () => ({
  default: ({ sites }) => <div>{sites.length} sites</div>,
}));

vi.mock('../../../../utils/formatDate', () => ({
  formatDate: (value) => value || '—',
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/entities/entity-1']}>
      <Routes>
        <Route path="/admin/entities/:id" element={<EntityDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('EntityDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState = { user: { role: 'ADMIN' } };
    mockGetEntity.mockResolvedValue({
      data: {
        data: {
          id: 'entity-1',
          company_name: 'Entity One',
          status: 'ACTIVE',
          city: 'Eindhoven',
          country: 'NL',
          kvk_number: '12345',
          btw_number: 'NL123',
          iban: 'NL00BANK123',
          vihb_number: 'VIHB-1',
          environmental_permit_number: 'ENV-1',
          contact_name: 'Jane Doe',
          contact_email: 'jane@example.com',
          contact_phone: '+31',
          is_supplier: true,
          is_transporter: true,
          is_disposer: false,
          is_receiver: false,
          supplier_type: 'PRO',
          supplier_roles: ['ONTDOENER'],
          pro_registration_number: 'PRO-55',
          disposer_sites: [],
          contracts_as_supplier: [
            {
              id: 'ct-1',
              contract_number: 'CON-01',
              name: 'Supplier Contract',
              status: 'ACTIVE',
              effective_date: '2026-01-01',
            },
          ],
          contracts_as_transporter: [],
        },
      },
    });
    mockToggleEntityStatus.mockResolvedValue({});
  });

  it('renders entity details, roles, and contracts', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Entity One')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Supplier').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Transporter').length).toBeGreaterThan(0);
    expect(screen.getByText('PRO')).toBeInTheDocument();
    expect(screen.getByText('CON-01')).toBeInTheDocument();
  });

  it('toggles entity status and refreshes', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText('Entity One')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'detail-INACTIVE' }));

    await waitFor(() => {
      expect(mockToggleEntityStatus).toHaveBeenCalledWith('entity-1');
      expect(mockGetEntity).toHaveBeenCalledTimes(2);
    });
  });
});
