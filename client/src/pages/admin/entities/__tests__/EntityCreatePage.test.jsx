import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import EntityCreatePage from '../EntityCreatePage';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const mockCreateEntity = vi.fn();
vi.mock('../../../../api/entities', () => ({
  createEntity: (...args) => mockCreateEntity(...args),
}));

vi.mock('../../../../components/ui/Breadcrumb', () => ({
  default: () => <div data-testid="breadcrumb" />,
}));

vi.mock('../../../../components/entities/EntityForm', () => ({
  default: ({ onSubmit, loading }) => (
    <form onSubmit={onSubmit}>
      <button type="submit" disabled={loading}>submit-entity</button>
    </form>
  ),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('EntityCreatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateEntity.mockResolvedValue({ data: { data: { id: 'entity-1' } } });
  });

  it('renders page and submits entity creation', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <EntityCreatePage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Create Entity' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'submit-entity' }));

    await waitFor(() => {
      expect(mockCreateEntity).toHaveBeenCalled();
    });

    expect(mockNavigate).toHaveBeenCalledWith('/admin/entities/entity-1');
  });
});
