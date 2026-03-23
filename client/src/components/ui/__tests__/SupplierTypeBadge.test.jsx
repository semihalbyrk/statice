import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SupplierTypeBadge from '../SupplierTypeBadge';

describe('SupplierTypeBadge', () => {
  it('renders PRO label for PRO type', () => {
    render(<SupplierTypeBadge type="PRO" />);
    expect(screen.getByText('PRO')).toBeInTheDocument();
  });

  it('renders Third Party label for THIRD_PARTY type', () => {
    render(<SupplierTypeBadge type="THIRD_PARTY" />);
    expect(screen.getByText('Third Party')).toBeInTheDocument();
  });

  it('renders Private Individual label for PRIVATE_INDIVIDUAL type', () => {
    render(<SupplierTypeBadge type="PRIVATE_INDIVIDUAL" />);
    expect(screen.getByText('Private Individual')).toBeInTheDocument();
  });

  it('applies green styling for PRO type', () => {
    render(<SupplierTypeBadge type="PRO" />);
    const badge = screen.getByText('PRO');
    expect(badge.className).toContain('bg-green-25');
    expect(badge.className).toContain('text-green-700');
    expect(badge.className).toContain('border-green-400');
  });

  it('applies blue styling for THIRD_PARTY type', () => {
    render(<SupplierTypeBadge type="THIRD_PARTY" />);
    const badge = screen.getByText('Third Party');
    expect(badge.className).toContain('bg-blue-25');
    expect(badge.className).toContain('text-blue-700');
    expect(badge.className).toContain('border-blue-300');
  });

  it('applies orange styling for PRIVATE_INDIVIDUAL type', () => {
    render(<SupplierTypeBadge type="PRIVATE_INDIVIDUAL" />);
    const badge = screen.getByText('Private Individual');
    expect(badge.className).toContain('bg-orange-25');
    expect(badge.className).toContain('text-orange-700');
    expect(badge.className).toContain('border-orange-300');
  });

  it('falls back to raw type string for unknown types', () => {
    render(<SupplierTypeBadge type="GOVERNMENT" />);
    expect(screen.getByText('GOVERNMENT')).toBeInTheDocument();
  });

  it('applies grey fallback styling for unknown types', () => {
    render(<SupplierTypeBadge type="UNKNOWN" />);
    const badge = screen.getByText('UNKNOWN');
    expect(badge.className).toContain('bg-grey-100');
    expect(badge.className).toContain('text-grey-700');
    expect(badge.className).toContain('border-grey-300');
  });

  it('renders nothing when type is null', () => {
    const { container } = render(<SupplierTypeBadge type={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when type is undefined', () => {
    const { container } = render(<SupplierTypeBadge />);
    expect(container.innerHTML).toBe('');
  });

  it('renders as an inline-flex span element', () => {
    render(<SupplierTypeBadge type="PRO" />);
    const badge = screen.getByText('PRO');
    expect(badge.tagName).toBe('SPAN');
    expect(badge.className).toContain('inline-flex');
  });
});
