import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Topbar from '../Topbar';

describe('Topbar', () => {
  it('renders a header element', () => {
    const { container } = render(<Topbar onToggleSidebar={vi.fn()} />);
    expect(container.querySelector('header')).toBeInTheDocument();
  });

  it('renders the hamburger menu button', () => {
    render(<Topbar onToggleSidebar={vi.fn()} />);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('calls onToggleSidebar when hamburger button is clicked', () => {
    const handleToggle = vi.fn();
    render(<Topbar onToggleSidebar={handleToggle} />);

    fireEvent.click(screen.getByRole('button'));

    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it('has sticky positioning', () => {
    const { container } = render(<Topbar onToggleSidebar={vi.fn()} />);
    const header = container.querySelector('header');
    expect(header.className).toContain('sticky');
    expect(header.className).toContain('top-0');
  });

  it('has proper height and border styling', () => {
    const { container } = render(<Topbar onToggleSidebar={vi.fn()} />);
    const header = container.querySelector('header');
    expect(header.className).toContain('h-14');
    expect(header.className).toContain('border-b');
    expect(header.className).toContain('border-grey-200');
  });

  it('has z-40 for layering above content', () => {
    const { container } = render(<Topbar onToggleSidebar={vi.fn()} />);
    const header = container.querySelector('header');
    expect(header.className).toContain('z-40');
  });

  it('hamburger button is hidden on large screens (lg:hidden)', () => {
    render(<Topbar onToggleSidebar={vi.fn()} />);
    const button = screen.getByRole('button');
    expect(button.className).toContain('lg:hidden');
  });
});
