import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RateLineFormModal from '../RateLineFormModal';

// Mock toast
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

// Mock contracts API
const mockAddRateLine = vi.fn();
const mockUpdateRateLine = vi.fn();

vi.mock('../../../api/contracts', () => ({
  addRateLine: (...args) => mockAddRateLine(...args),
  updateRateLine: (...args) => mockUpdateRateLine(...args),
}));

// Mock masterDataStore
const mockMaterials = [
  { id: 'm1', code: 'CU', name: 'Copper' },
  { id: 'm2', code: 'FE', name: 'Ferrous Metals' },
  { id: 'm3', code: 'AL', name: 'Aluminium' },
];

vi.mock('../../../store/masterDataStore', () => ({
  default: (selector) => {
    const state = { materials: mockMaterials };
    return selector(state);
  },
}));

describe('RateLineFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Add Rate Line" title when creating', () => {
    render(
      <RateLineFormModal
        contractId="c1"
        currency="EUR"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );
    expect(screen.getByText('Add Rate Line')).toBeInTheDocument();
  });

  it('renders "Edit Rate Line" title when editing', () => {
    const rateLine = { id: 'rl-1', material_id: 'm1', pricing_model: 'WEIGHT', unit_rate: 2.50, btw_rate: 21 };
    render(
      <RateLineFormModal
        contractId="c1"
        rateLine={rateLine}
        currency="EUR"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );
    expect(screen.getByText('Edit Rate Line')).toBeInTheDocument();
  });

  it('renders material dropdown with options from store', () => {
    render(
      <RateLineFormModal
        contractId="c1"
        currency="EUR"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    expect(screen.getByText('Select material...')).toBeInTheDocument();
    // Material options show name only
    expect(screen.getByText(/Copper/)).toBeInTheDocument();
    expect(screen.getByText(/Ferrous Metals/)).toBeInTheDocument();
    expect(screen.getByText(/Aluminium/)).toBeInTheDocument();
  });

  it('renders pricing model dropdown', () => {
    render(
      <RateLineFormModal
        contractId="c1"
        currency="EUR"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    expect(screen.getByText('Per Weight (kg)')).toBeInTheDocument();
    expect(screen.getByText('Per Quantity')).toBeInTheDocument();
    expect(screen.getByText('Per Weight and Quantity')).toBeInTheDocument();
  });

  it('renders unit rate and BTW rate fields for WEIGHT model', () => {
    render(
      <RateLineFormModal
        contractId="c1"
        currency="EUR"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    expect(screen.getByText(/Unit Rate/)).toBeInTheDocument();
    expect(screen.getByText(/BTW Rate/)).toBeInTheDocument();
  });

  it('renders Add button when creating', () => {
    render(
      <RateLineFormModal
        contractId="c1"
        currency="EUR"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );
    expect(screen.getByText('Add')).toBeInTheDocument();
  });

  it('renders Update button when editing', () => {
    const rateLine = { id: 'rl-1', material_id: 'm1', pricing_model: 'WEIGHT', unit_rate: 2.50 };
    render(
      <RateLineFormModal
        contractId="c1"
        rateLine={rateLine}
        currency="EUR"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );
    expect(screen.getByText('Update')).toBeInTheDocument();
  });

  it('renders Cancel button', () => {
    render(
      <RateLineFormModal
        contractId="c1"
        currency="EUR"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls onClose when Cancel button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <RateLineFormModal
        contractId="c1"
        currency="EUR"
        onClose={handleClose}
        onSuccess={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when X button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <RateLineFormModal
        contractId="c1"
        currency="EUR"
        onClose={handleClose}
        onSuccess={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('\u00D7'));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('shows EUR currency symbol by default', () => {
    render(
      <RateLineFormModal
        contractId="c1"
        currency="EUR"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    // The label includes the currency symbol
    expect(screen.getByText(/Unit Rate \(\u20AC\)/)).toBeInTheDocument();
  });

  it('shows USD currency symbol when currency is USD', () => {
    render(
      <RateLineFormModal
        contractId="c1"
        currency="USD"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    expect(screen.getByText(/Unit Rate \(\$\)/)).toBeInTheDocument();
  });

  it('shows GBP currency symbol when currency is GBP', () => {
    render(
      <RateLineFormModal
        contractId="c1"
        currency="GBP"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    expect(screen.getByText(/Unit Rate \(\u00A3\)/)).toBeInTheDocument();
  });

  it('renders "Add Both" button when WEIGHT_AND_QUANTITY is selected in create mode', () => {
    render(
      <RateLineFormModal
        contractId="c1"
        currency="EUR"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    // Change pricing model to WEIGHT_AND_QUANTITY
    const select = screen.getByDisplayValue('Per Weight (kg)');
    fireEvent.change(select, { target: { value: 'WEIGHT_AND_QUANTITY' } });

    expect(screen.getByText('Add Both')).toBeInTheDocument();
  });

  it('shows weight rate and quantity rate fields for combo pricing model', () => {
    render(
      <RateLineFormModal
        contractId="c1"
        currency="EUR"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    const select = screen.getByDisplayValue('Per Weight (kg)');
    fireEvent.change(select, { target: { value: 'WEIGHT_AND_QUANTITY' } });

    expect(screen.getByText(/Weight Rate/)).toBeInTheDocument();
    expect(screen.getByText(/Quantity Rate/)).toBeInTheDocument();
  });

  it('defaults BTW rate to 21%', () => {
    render(
      <RateLineFormModal
        contractId="c1"
        currency="EUR"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    const btwInputs = screen.getAllByDisplayValue('21');
    expect(btwInputs.length).toBeGreaterThanOrEqual(1);
  });
});
