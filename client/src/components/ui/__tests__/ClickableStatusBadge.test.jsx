import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ClickableStatusBadge from '../ClickableStatusBadge';

describe('ClickableStatusBadge', () => {
  it('renders the current status label', () => {
    render(<ClickableStatusBadge status="PLANNED" />);
    expect(screen.getByText('Planned')).toBeInTheDocument();
  });

  it('renders as a button element', () => {
    render(<ClickableStatusBadge status="COMPLETED" />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('does not show dropdown when there are no transitions', () => {
    render(<ClickableStatusBadge status="COMPLETED" allowedTransitions={[]} />);

    fireEvent.click(screen.getByRole('button'));

    // No dropdown should appear
    expect(screen.queryByText('In Progress')).not.toBeInTheDocument();
  });

  it('shows dropdown with transition options when clicked', () => {
    render(
      <ClickableStatusBadge
        status="PLANNED"
        allowedTransitions={['IN_PROGRESS', 'CANCELLED']}
        onTransition={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('calls onTransition with the chosen status when a transition is selected', () => {
    const handleTransition = vi.fn();
    render(
      <ClickableStatusBadge
        status="PLANNED"
        allowedTransitions={['IN_PROGRESS', 'CANCELLED']}
        onTransition={handleTransition}
      />
    );

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('In Progress'));

    expect(handleTransition).toHaveBeenCalledWith('IN_PROGRESS');
  });

  it('closes dropdown after selecting a transition', () => {
    render(
      <ClickableStatusBadge
        status="ARRIVED"
        allowedTransitions={['WEIGHED_IN']}
        onTransition={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Weighed In')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Weighed In'));
    expect(screen.queryByText('Weighed In')).not.toBeInTheDocument();
  });

  it('shows chevron indicator when transitions are available', () => {
    const { container } = render(
      <ClickableStatusBadge
        status="PLANNED"
        allowedTransitions={['IN_PROGRESS']}
        onTransition={vi.fn()}
      />
    );

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('does not show chevron when there are no transitions', () => {
    const { container } = render(
      <ClickableStatusBadge status="COMPLETED" allowedTransitions={[]} />
    );

    // The button itself has no nested SVG chevron
    const button = screen.getByRole('button');
    const svgs = button.querySelectorAll('svg');
    expect(svgs).toHaveLength(0);
  });

  it('does not open dropdown when disabled is true', () => {
    render(
      <ClickableStatusBadge
        status="PLANNED"
        allowedTransitions={['IN_PROGRESS']}
        onTransition={vi.fn()}
        disabled={true}
      />
    );

    fireEvent.click(screen.getByRole('button'));

    expect(screen.queryByText('In Progress')).not.toBeInTheDocument();
  });

  it('falls back to raw status string for unknown statuses', () => {
    render(<ClickableStatusBadge status="UNKNOWN_STATUS" />);
    expect(screen.getByText('UNKNOWN STATUS')).toBeInTheDocument();
  });

  it('closes the dropdown on outside click', () => {
    render(
      <ClickableStatusBadge
        status="PLANNED"
        allowedTransitions={['IN_PROGRESS']}
        onTransition={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('In Progress')).toBeInTheDocument();

    fireEvent.mouseDown(document);
    expect(screen.queryByText('In Progress')).not.toBeInTheDocument();
  });

  it('uses translated status labels for display names', () => {
    render(
      <ClickableStatusBadge
        status="ARRIVED"
        allowedTransitions={['WEIGHED_IN', 'WEIGHED_OUT']}
        onTransition={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByText('Weighed In')).toBeInTheDocument();
    expect(screen.getByText('Weighed Out')).toBeInTheDocument();
  });
});
