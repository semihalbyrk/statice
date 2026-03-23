import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import UnauthorisedPage from '../UnauthorisedPage';

function renderUnauthorisedPage() {
  return render(
    <MemoryRouter>
      <UnauthorisedPage />
    </MemoryRouter>
  );
}

describe('UnauthorisedPage', () => {
  it('renders the 403 heading', () => {
    renderUnauthorisedPage();
    expect(screen.getByText('403')).toBeInTheDocument();
  });

  it('renders the "Access Denied" message', () => {
    renderUnauthorisedPage();
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
  });

  it('renders the permission description', () => {
    renderUnauthorisedPage();
    expect(screen.getByText("You don't have permission to view this page.")).toBeInTheDocument();
  });

  it('renders a Go Back button', () => {
    renderUnauthorisedPage();
    expect(screen.getByText('Go Back')).toBeInTheDocument();
  });

  it('renders a Dashboard link', () => {
    renderUnauthorisedPage();
    const link = screen.getByText('Dashboard');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/dashboard');
  });

  it('calls window.history.back on Go Back click', async () => {
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const user = userEvent.setup();

    renderUnauthorisedPage();
    await user.click(screen.getByText('Go Back'));

    expect(backSpy).toHaveBeenCalled();
    backSpy.mockRestore();
  });
});
