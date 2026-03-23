import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotFoundPage from '../NotFoundPage';

function renderNotFoundPage() {
  return render(
    <MemoryRouter>
      <NotFoundPage />
    </MemoryRouter>
  );
}

describe('NotFoundPage', () => {
  it('renders the 404 heading', () => {
    renderNotFoundPage();
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('renders the "Page not found" message', () => {
    renderNotFoundPage();
    expect(screen.getByText('Page not found')).toBeInTheDocument();
  });

  it('renders the description text', () => {
    renderNotFoundPage();
    expect(screen.getByText('The page you are looking for does not exist or has been moved.')).toBeInTheDocument();
  });

  it('renders a link to the dashboard', () => {
    renderNotFoundPage();
    const link = screen.getByText('Go to Dashboard');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/dashboard');
  });
});
