import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ContainerRegistryPage from '../ContainerRegistryPage';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const mockGetContainers = vi.fn();
const mockCreateContainer = vi.fn();
const mockUpdateContainer = vi.fn();
const mockDeleteContainer = vi.fn();
vi.mock('../../../api/containers', () => ({
  getContainers: (...args) => mockGetContainers(...args),
  createContainer: (...args) => mockCreateContainer(...args),
  updateContainer: (...args) => mockUpdateContainer(...args),
  deleteContainer: (...args) => mockDeleteContainer(...args),
}));

vi.mock('../../../components/ui/ClickableStatusBadge', () => ({
  default: ({ status, allowedTransitions = [], onTransition }) => (
    <div>
      <span>{status}</span>
      {allowedTransitions.map((transition) => (
        <button key={transition} onClick={() => onTransition(transition)}>
          container-{transition}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('../../../components/ui/RowActionMenu', () => ({
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

function renderPage() {
  return render(<ContainerRegistryPage />);
}

describe('ContainerRegistryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetContainers.mockResolvedValue({
      data: {
        data: [
          {
            id: 'c1',
            container_label: 'SKIP-01',
            container_type: 'OPEN_TOP',
            tare_weight_kg: 250,
            volume_m3: 20,
            notes: 'Main yard',
            is_active: true,
          },
        ],
      },
    });
    mockCreateContainer.mockResolvedValue({});
    mockUpdateContainer.mockResolvedValue({});
    mockDeleteContainer.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders fetched containers', async () => {
    renderPage();

    await waitFor(() => {
      expect(mockGetContainers).toHaveBeenCalledWith({ limit: 100, search: undefined });
    });

    expect(screen.getByText('SKIP-01')).toBeInTheDocument();
    expect(screen.getByText('Open Top')).toBeInTheDocument();
  });

  it('creates a new container from modal form', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText('SKIP-01')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /Add Container/i }));
    await user.type(document.querySelector('input[name="container_label"]'), 'NEW-02');
    await user.selectOptions(document.querySelector('select[name="container_type"]'), 'PALLET');
    await user.type(document.querySelector('input[name="tare_weight_kg"]'), '75');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(mockCreateContainer).toHaveBeenCalledWith({
        container_label: 'NEW-02',
        container_type: 'PALLET',
        tare_weight_kg: 75,
        volume_m3: null,
        notes: null,
      });
    });
  });

  it('deletes an existing container', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText('SKIP-01')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(mockDeleteContainer).toHaveBeenCalledWith('c1');
    });
  });
});
