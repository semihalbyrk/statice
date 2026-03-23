import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RowActionMenu from '../RowActionMenu';

// Minimal icon stub for lucide-react
const MockIcon = (props) => <svg data-testid="mock-icon" {...props} />;

describe('RowActionMenu', () => {
  it('renders nothing when actions array is empty', () => {
    const { container } = render(<RowActionMenu actions={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders the trigger button when actions are provided', () => {
    const actions = [{ label: 'Edit', onClick: vi.fn() }];
    render(<RowActionMenu actions={actions} />);

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('does not show the dropdown menu initially', () => {
    const actions = [{ label: 'View Details', onClick: vi.fn() }];
    render(<RowActionMenu actions={actions} />);

    expect(screen.queryByText('View Details')).not.toBeInTheDocument();
  });

  it('shows dropdown menu items when trigger is clicked', () => {
    const actions = [
      { label: 'View Details', onClick: vi.fn() },
      { label: 'Cancel Order', onClick: vi.fn(), variant: 'danger' },
    ];
    render(<RowActionMenu actions={actions} />);

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByText('View Details')).toBeInTheDocument();
    expect(screen.getByText('Cancel Order')).toBeInTheDocument();
  });

  it('calls action onClick and closes menu when a menu item is clicked', () => {
    const handleEdit = vi.fn();
    const actions = [{ label: 'Edit', onClick: handleEdit }];
    render(<RowActionMenu actions={actions} />);

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Edit'));

    expect(handleEdit).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
  });

  it('toggles the dropdown on repeated trigger clicks', () => {
    const actions = [{ label: 'Delete', onClick: vi.fn(), variant: 'danger' }];
    render(<RowActionMenu actions={actions} />);

    const trigger = screen.getByRole('button');

    // Open
    fireEvent.click(trigger);
    expect(screen.getByText('Delete')).toBeInTheDocument();

    // Close
    fireEvent.click(trigger);
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('renders icon when action has an icon component', () => {
    const actions = [{ label: 'Edit', onClick: vi.fn(), icon: MockIcon }];
    render(<RowActionMenu actions={actions} />);

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByTestId('mock-icon')).toBeInTheDocument();
  });

  it('applies danger styling for danger variant items', () => {
    const actions = [{ label: 'Delete Inbound', onClick: vi.fn(), variant: 'danger' }];
    render(<RowActionMenu actions={actions} />);

    fireEvent.click(screen.getByRole('button'));

    const item = screen.getByText('Delete Inbound');
    expect(item.className).toContain('text-red-600');
  });

  it('applies standard styling for non-danger items', () => {
    const actions = [{ label: 'Edit Supplier', onClick: vi.fn() }];
    render(<RowActionMenu actions={actions} />);

    fireEvent.click(screen.getByRole('button'));

    const item = screen.getByText('Edit Supplier');
    expect(item.className).toContain('text-grey-700');
  });

  it('closes the menu when clicking outside', () => {
    const actions = [{ label: 'Edit', onClick: vi.fn() }];
    render(<RowActionMenu actions={actions} />);

    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Edit')).toBeInTheDocument();

    // Simulate click outside
    fireEvent.mouseDown(document);

    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
  });
});
