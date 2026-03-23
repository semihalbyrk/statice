import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ContractRagBadge from '../ContractRagBadge';

describe('ContractRagBadge', () => {
  it('renders Green label for GREEN status', () => {
    render(<ContractRagBadge status="GREEN" />);
    expect(screen.getByText('Green')).toBeInTheDocument();
  });

  it('renders Amber label for AMBER status', () => {
    render(<ContractRagBadge status="AMBER" />);
    expect(screen.getByText('Amber')).toBeInTheDocument();
  });

  it('renders Red label for RED status', () => {
    render(<ContractRagBadge status="RED" />);
    expect(screen.getByText('Red')).toBeInTheDocument();
  });

  it('applies green badge classes for GREEN status', () => {
    render(<ContractRagBadge status="GREEN" />);
    const badge = screen.getByText('Green');
    expect(badge.className).toContain('bg-green-25');
    expect(badge.className).toContain('text-green-700');
    expect(badge.className).toContain('border-green-300');
  });

  it('applies orange badge classes for AMBER status', () => {
    render(<ContractRagBadge status="AMBER" />);
    const badge = screen.getByText('Amber');
    expect(badge.className).toContain('bg-orange-25');
    expect(badge.className).toContain('text-orange-700');
    expect(badge.className).toContain('border-orange-300');
  });

  it('applies red badge classes for RED status', () => {
    render(<ContractRagBadge status="RED" />);
    const badge = screen.getByText('Red');
    expect(badge.className).toContain('bg-red-25');
    expect(badge.className).toContain('text-red-700');
    expect(badge.className).toContain('border-red-300');
  });

  it('renders nothing when status is null', () => {
    const { container } = render(<ContractRagBadge status={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when status is undefined', () => {
    const { container } = render(<ContractRagBadge />);
    expect(container.innerHTML).toBe('');
  });

  it('renders a green dot for GREEN status with showLabel dot', () => {
    const { container } = render(<ContractRagBadge status="GREEN" showLabel={true} />);
    const dot = container.querySelector('.bg-green-500');
    expect(dot).toBeInTheDocument();
  });

  it('renders dot-only mode when showLabel is false', () => {
    const { container } = render(<ContractRagBadge status="RED" showLabel={false} />);
    // Should not show text label
    expect(screen.queryByText('Red')).not.toBeInTheDocument();
    // Should render the dot
    const dot = container.querySelector('.bg-red-500');
    expect(dot).toBeInTheDocument();
  });

  it('dot-only mode renders with title attribute', () => {
    const { container } = render(<ContractRagBadge status="AMBER" showLabel={false} />);
    const dot = container.querySelector('.bg-orange-500');
    expect(dot.getAttribute('title')).toBe('Amber');
  });

  it('falls back to GREEN config for unknown status', () => {
    render(<ContractRagBadge status="UNKNOWN" />);
    expect(screen.getByText('Green')).toBeInTheDocument();
  });

  it('renders as inline-flex span with label', () => {
    render(<ContractRagBadge status="GREEN" />);
    const badge = screen.getByText('Green');
    expect(badge.tagName).toBe('SPAN');
    expect(badge.className).toContain('inline-flex');
  });
});
