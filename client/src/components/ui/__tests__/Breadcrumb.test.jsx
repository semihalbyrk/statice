import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Breadcrumb from '../Breadcrumb';

function renderBreadcrumb(items) {
  return render(
    <MemoryRouter>
      <Breadcrumb items={items} />
    </MemoryRouter>
  );
}

describe('Breadcrumb', () => {
  it('renders all breadcrumb items', () => {
    renderBreadcrumb([
      { label: 'Orders', to: '/orders' },
      { label: 'ORD-2026-0042' },
    ]);

    expect(screen.getByText('Orders')).toBeInTheDocument();
    expect(screen.getByText('ORD-2026-0042')).toBeInTheDocument();
  });

  it('renders non-last items as links', () => {
    renderBreadcrumb([
      { label: 'Orders', to: '/orders' },
      { label: 'Planning Board', to: '/orders/planning' },
      { label: 'ORD-2026-0001' },
    ]);

    const ordersLink = screen.getByText('Orders');
    expect(ordersLink.tagName).toBe('A');
    expect(ordersLink.getAttribute('href')).toBe('/orders');

    const planningLink = screen.getByText('Planning Board');
    expect(planningLink.tagName).toBe('A');
    expect(planningLink.getAttribute('href')).toBe('/orders/planning');
  });

  it('renders the last item as plain text (not a link)', () => {
    renderBreadcrumb([
      { label: 'Orders', to: '/orders' },
      { label: 'ORD-2026-0042' },
    ]);

    const lastItem = screen.getByText('ORD-2026-0042');
    expect(lastItem.tagName).toBe('SPAN');
    expect(lastItem.className).toContain('font-medium');
  });

  it('renders a single item as the last item (plain text)', () => {
    renderBreadcrumb([{ label: 'Dashboard' }]);

    const item = screen.getByText('Dashboard');
    expect(item.tagName).toBe('SPAN');
  });

  it('renders as a nav element', () => {
    const { container } = renderBreadcrumb([{ label: 'Home', to: '/' }]);
    expect(container.querySelector('nav')).toBeInTheDocument();
  });

  it('does not render separator before the first item', () => {
    const { container } = renderBreadcrumb([
      { label: 'Orders', to: '/orders' },
      { label: 'Detail' },
    ]);

    // ChevronRight icons are rendered as SVGs between items, not before the first
    const svgs = container.querySelectorAll('svg');
    expect(svgs).toHaveLength(1); // one separator between two items
  });

  it('renders Dutch/WEEE-style breadcrumb labels', () => {
    renderBreadcrumb([
      { label: 'Inbounds', to: '/inbounds' },
      { label: 'Weighing', to: '/inbounds/weighing' },
      { label: 'INB-2026-0015' },
    ]);

    expect(screen.getByText('Inbounds')).toBeInTheDocument();
    expect(screen.getByText('Weighing')).toBeInTheDocument();
    expect(screen.getByText('INB-2026-0015')).toBeInTheDocument();
  });
});
