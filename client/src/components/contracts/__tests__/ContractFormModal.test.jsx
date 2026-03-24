import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ContractFormModal from '../ContractFormModal';

// Mock toast
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

// Mock contracts API
const mockCreateContract = vi.fn();
const mockUpdateContract = vi.fn();

vi.mock('../../../api/contracts', () => ({
  createContract: (...args) => mockCreateContract(...args),
  updateContract: (...args) => mockUpdateContract(...args),
}));

// Mock masterDataStore
const mockSuppliers = [
  { id: 's1', name: 'Wecycle BV' },
  { id: 's2', name: 'ICT Milieu NL' },
];

vi.mock('../../../store/masterDataStore', () => ({
  default: (selector) => {
    const state = { suppliers: mockSuppliers };
    return selector(state);
  },
}));

describe('ContractFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "New Contract" title when creating', () => {
    render(<ContractFormModal onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.getByText('New Contract')).toBeInTheDocument();
  });

  it('renders "Edit Contract" title when editing', () => {
    const contract = { id: 'c1', supplier_id: 's1', name: 'Test Contract', effective_date: '2026-01-01', payment_term_days: 30 };
    render(<ContractFormModal contract={contract} onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.getByText('Edit Contract')).toBeInTheDocument();
  });

  it('renders supplier dropdown with options from store', () => {
    render(<ContractFormModal onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.getByText('Wecycle BV')).toBeInTheDocument();
    expect(screen.getByText('ICT Milieu NL')).toBeInTheDocument();
  });

  it('renders required form fields', () => {
    render(<ContractFormModal onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.getByText(/Supplier/)).toBeInTheDocument();
    expect(screen.getByText(/Contract Name/)).toBeInTheDocument();
    expect(screen.getByText(/Effective Date/)).toBeInTheDocument();
  });

  it('renders payment terms section', () => {
    render(<ContractFormModal onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.getByText('Payment Terms')).toBeInTheDocument();
    expect(screen.getByText(/Payment Term \(days\)/)).toBeInTheDocument();
    expect(screen.getByText(/Invoicing Frequency/)).toBeInTheDocument();
    expect(screen.getByText(/Currency/)).toBeInTheDocument();
  });

  it('renders contamination section', () => {
    render(<ContractFormModal onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.getByText('Contamination')).toBeInTheDocument();
    expect(screen.getByText(/Tolerance/)).toBeInTheDocument();
  });

  it('renders Create button when creating new contract', () => {
    render(<ContractFormModal onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.getByText('Create')).toBeInTheDocument();
  });

  it('renders Update button when editing existing contract', () => {
    const contract = { id: 'c1', supplier_id: 's1', name: 'Test', effective_date: '2026-01-01' };
    render(<ContractFormModal contract={contract} onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.getByText('Update')).toBeInTheDocument();
  });

  it('renders Cancel button', () => {
    render(<ContractFormModal onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls onClose when Cancel button is clicked', () => {
    const handleClose = vi.fn();
    render(<ContractFormModal onClose={handleClose} onSuccess={vi.fn()} />);

    fireEvent.click(screen.getByText('Cancel'));

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when X button is clicked', () => {
    const handleClose = vi.fn();
    render(<ContractFormModal onClose={handleClose} onSuccess={vi.fn()} />);

    // The close button shows the X character
    fireEvent.click(screen.getByText('\u00D7'));

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('renders invoicing frequency options', () => {
    render(<ContractFormModal onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.getByText('Per Order')).toBeInTheDocument();
    expect(screen.getByText('Weekly')).toBeInTheDocument();
    expect(screen.getByText('Monthly')).toBeInTheDocument();
    expect(screen.getByText('Quarterly')).toBeInTheDocument();
  });

  it('renders currency options', () => {
    render(<ContractFormModal onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.getByText(/EUR/)).toBeInTheDocument();
    expect(screen.getByText(/USD/)).toBeInTheDocument();
    expect(screen.getByText(/GBP/)).toBeInTheDocument();
  });

  it('pre-fills form values when editing', () => {
    const contract = {
      id: 'c1',
      supplier_id: 's1',
      name: '2026 WEEE Processing Agreement',
      effective_date: '2026-01-01T00:00:00.000Z',
      expiry_date: '2026-12-31T00:00:00.000Z',
      payment_term_days: 45,
      invoicing_frequency: 'QUARTERLY',
      currency: 'EUR',
      contamination_tolerance_pct: 5,
    };
    render(<ContractFormModal contract={contract} onClose={vi.fn()} onSuccess={vi.fn()} />);

    const nameInput = screen.getByPlaceholderText('e.g. 2026 WEEE Processing Agreement');
    expect(nameInput.value).toBe('2026 WEEE Processing Agreement');
  });
});
