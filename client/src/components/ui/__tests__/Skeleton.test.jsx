import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import Skeleton, { TableSkeleton } from '../Skeleton';

describe('Skeleton', () => {
  it('renders a div element', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild;
    expect(el.tagName).toBe('DIV');
  });

  it('has animate-pulse class for loading animation', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild.className).toContain('animate-pulse');
  });

  it('has bg-grey-200 class for placeholder color', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild.className).toContain('bg-grey-200');
  });

  it('has rounded class', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild.className).toContain('rounded');
  });

  it('accepts and applies custom className', () => {
    const { container } = render(<Skeleton className="h-8 w-32" />);
    const el = container.firstChild;
    expect(el.className).toContain('h-8');
    expect(el.className).toContain('w-32');
  });

  it('works without custom className', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toBeTruthy();
  });
});

describe('TableSkeleton', () => {
  it('renders the default number of rows (5)', () => {
    const { container } = render(<TableSkeleton />);
    const rows = container.querySelectorAll('.flex.gap-4');
    expect(rows).toHaveLength(5);
  });

  it('renders the default number of columns (4) per row', () => {
    const { container } = render(<TableSkeleton />);
    const firstRow = container.querySelector('.flex.gap-4');
    const cells = firstRow.querySelectorAll('.animate-pulse');
    expect(cells).toHaveLength(4);
  });

  it('renders custom number of rows', () => {
    const { container } = render(<TableSkeleton rows={3} />);
    const rows = container.querySelectorAll('.flex.gap-4');
    expect(rows).toHaveLength(3);
  });

  it('renders custom number of columns', () => {
    const { container } = render(<TableSkeleton rows={1} cols={6} />);
    const firstRow = container.querySelector('.flex.gap-4');
    const cells = firstRow.querySelectorAll('.animate-pulse');
    expect(cells).toHaveLength(6);
  });

  it('each skeleton cell has h-4 and flex-1 classes', () => {
    const { container } = render(<TableSkeleton rows={1} cols={1} />);
    const cell = container.querySelector('.animate-pulse');
    expect(cell.className).toContain('h-4');
    expect(cell.className).toContain('flex-1');
  });
});
