import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import EntitiesPage from '../EntitiesPage';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const mockToggleEntityStatus = vi.fn();
vi.mock('../../../../api/entities', () => ({
  toggleEntityStatus: (...args) => mockToggleEntityStatus(...args),
}));

let mockStore;
vi.mock('../../../../store/entitiesStore', () => ({
  default: () => mockStore,
}));

vi.mock('../../../../components/ui/ClickableStatusBadge', () => ({
  default: ({ status, allowedTransitions = [], onTransition }) => (
    <div>
      <span>{status}</span>
      {allowedTransitions.map((transition) => (
        <button key={transition} onClick={() => onTransition(transition)}>
          entity-{transition}
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

function renderPage(initialEntry = '/admin/entities?tab=suppliers') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <EntitiesPage />
    </MemoryRouter>
  );
}

describe('EntitiesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore = {
      entities: [
        {
          id: 'e1',
          company_name: 'Supplier One',
          status: 'ACTIVE',
          is_supplier: true,
          is_transporter: false,
          is_disposer: false,
          is_receiver: false,
          supplier_type: 'COMMERCIAL',
          city: 'Rotterdam',
          country: 'NL',
          vihb_number: 'VIHB-1',
        },
      ],
      totalCount: 1,
      filters: { role: 'supplier', status: '', search: '', page: 1, limit: 20 },
      loading: false,
      setFilters: vi.fn(),
      fetchEntities: vi.fn(),
    };
    mockToggleEntityStatus.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders entities and supplier specific columns', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Entities' })).toBeInTheDocument();
    expect(screen.getByText('Supplier One')).toBeInTheDocument();
    expect(screen.getByText('Commercial')).toBeInTheDocument();
    expect(screen.getByText('Supplier')).toBeInTheDocument();
  });

  it('switches tabs and updates role filter', async () => {
    const user = userEvent.setup();
    renderPage('/admin/entities?tab=all');

    await user.click(screen.getByRole('button', { name: 'Transporters' }));

    await waitFor(() => {
      expect(mockStore.setFilters).toHaveBeenCalledWith({ role: 'transporter', page: 1 });
    });
  });

  it('debounces search and toggles status', async () => {
    const user = userEvent.setup();
    renderPage();

    fireEvent.change(screen.getByPlaceholderText('searchPlaceholder'), { target: { value: 'Supp' } });

    await waitFor(() => {
      expect(mockStore.setFilters).toHaveBeenCalledWith({ search: 'Supp', page: 1 });
    });

    await user.click(screen.getByRole('button', { name: 'entity-INACTIVE' }));

    await waitFor(() => {
      expect(mockToggleEntityStatus).toHaveBeenCalledWith('e1');
      expect(mockStore.fetchEntities).toHaveBeenCalled();
    });
  });
});
