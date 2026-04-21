import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import EntityEditPage from '../EntityEditPage';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const mockGetEntity = vi.fn();
const mockUpdateEntity = vi.fn();
vi.mock('../../../../api/entities', () => ({
  getEntity: (...args) => mockGetEntity(...args),
  updateEntity: (...args) => mockUpdateEntity(...args),
}));

vi.mock('../../../../components/ui/Breadcrumb', () => ({
  default: () => <div data-testid="breadcrumb" />,
}));

vi.mock('../../../../components/entities/EntityForm', () => ({
  default: ({ onSubmit, loading }) => (
    <form onSubmit={onSubmit}>
      <button type="submit" disabled={loading}>update-entity</button>
    </form>
  ),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/entities/entity-1/edit']}>
      <Routes>
        <Route path="/admin/entities/:id/edit" element={<EntityEditPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('EntityEditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEntity.mockResolvedValue({
      data: {
        data: {
          id: 'entity-1',
          company_name: 'Entity One',
          is_supplier: true,
          supplier_roles: [],
        },
      },
    });
    mockUpdateEntity.mockResolvedValue({});
  });

  it('loads entity and submits update', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(mockGetEntity).toHaveBeenCalledWith('entity-1');
    });

    expect(screen.getByRole('heading', { name: 'Edit Entity' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'update-entity' }));

    await waitFor(() => {
      expect(mockUpdateEntity).toHaveBeenCalledWith('entity-1', expect.objectContaining({ company_name: 'Entity One' }));
    });

    expect(mockNavigate).toHaveBeenCalledWith('/admin/entities/entity-1');
  });
});
