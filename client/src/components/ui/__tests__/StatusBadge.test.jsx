import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusBadge, { STATUS_CONFIG } from '../StatusBadge';

describe('StatusBadge', () => {
  it('renders the correct label for PLANNED status', () => {
    render(<StatusBadge status="PLANNED" />);
    expect(screen.getByText('Planned')).toBeInTheDocument();
  });

  it('renders the correct label for IN_PROGRESS status', () => {
    render(<StatusBadge status="IN_PROGRESS" />);
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('renders the correct label for COMPLETED status', () => {
    render(<StatusBadge status="COMPLETED" />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('renders the correct label for CANCELLED status', () => {
    render(<StatusBadge status="CANCELLED" />);
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('renders the correct label for ARRIVED status', () => {
    render(<StatusBadge status="ARRIVED" />);
    expect(screen.getByText('Arrived')).toBeInTheDocument();
  });

  it('renders the correct label for READY_FOR_SORTING status', () => {
    render(<StatusBadge status="READY_FOR_SORTING" />);
    expect(screen.getByText('Ready for Sorting')).toBeInTheDocument();
  });

  it('applies correct CSS classes for COMPLETED status', () => {
    render(<StatusBadge status="COMPLETED" />);
    const badge = screen.getByText('Completed');
    expect(badge.className).toContain('bg-green-25');
    expect(badge.className).toContain('text-green-700');
    expect(badge.className).toContain('border-green-400');
  });

  it('applies correct CSS classes for CANCELLED status', () => {
    render(<StatusBadge status="CANCELLED" />);
    const badge = screen.getByText('Cancelled');
    expect(badge.className).toContain('bg-red-25');
    expect(badge.className).toContain('text-red-700');
  });

  it('falls back to raw status string for unknown statuses', () => {
    render(<StatusBadge status="UNKNOWN_STATUS" />);
    expect(screen.getByText('UNKNOWN_STATUS')).toBeInTheDocument();
  });

  it('applies fallback grey classes for unknown statuses', () => {
    render(<StatusBadge status="SOMETHING_ELSE" />);
    const badge = screen.getByText('SOMETHING_ELSE');
    expect(badge.className).toContain('bg-grey-100');
    expect(badge.className).toContain('text-grey-700');
  });

  it('renders as an inline-flex span element', () => {
    render(<StatusBadge status="ACTIVE" />);
    const badge = screen.getByText('Active');
    expect(badge.tagName).toBe('SPAN');
    expect(badge.className).toContain('inline-flex');
  });

  it('exports STATUS_CONFIG with all expected statuses', () => {
    const expectedStatuses = [
      'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED',
      'ARRIVED', 'WEIGHED_IN', 'WEIGHED_OUT', 'READY_FOR_SORTING', 'SORTED',
      'ACTIVE', 'INACTIVE',
    ];
    expectedStatuses.forEach((status) => {
      expect(STATUS_CONFIG[status]).toBeDefined();
      expect(STATUS_CONFIG[status].label).toBeTruthy();
      expect(STATUS_CONFIG[status].className).toBeTruthy();
    });
  });
});
