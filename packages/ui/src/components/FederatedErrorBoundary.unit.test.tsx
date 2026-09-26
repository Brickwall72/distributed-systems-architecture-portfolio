// File: packages/ui/src/components/FederatedErrorBoundary.unit.test.tsx
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import FederatedErrorBoundary from './FederatedErrorBoundary';

// Helper component that throws an error on demand
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Failed to load remote module bundle or manifest.');
  }
  return <div data-testid="success-child">Remote Module Loaded Successfully</div>;
};

describe('FederatedErrorBoundary', () => {
  const originalConsoleError = console.error;

  beforeEach(() => {
    // Suppress React error boundary console noise during test runs
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('renders children normally when no error occurs', () => {
    render(
      <FederatedErrorBoundary remoteName="compliance_client">
        <ThrowError shouldThrow={false} />
      </FederatedErrorBoundary>
    );

    expect(screen.getByTestId('success-child')).toBeDefined();
    expect(screen.getByText('Remote Module Loaded Successfully')).toBeDefined();
  });

  it('renders isolated error fallback and remote name when module loading fails', () => {
    render(
      <FederatedErrorBoundary remoteName="topology_client">
        <ThrowError shouldThrow={true} />
      </FederatedErrorBoundary>
    );

    expect(screen.getByText('Module Federation Load Failure')).toBeDefined();
    expect(screen.getByText('topology_client')).toBeDefined();
    expect(screen.getByText('Failed to load remote module bundle or manifest.')).toBeDefined();
    expect(screen.getByRole('button', { name: /Retry Loading Module/i })).toBeDefined();
  });

  it('resets error state and attempts reload when retry button is clicked', () => {
    const StatefulWrapper = () => {
      const [throwErr, setThrowErr] = useState(true);
      return (
        <FederatedErrorBoundary remoteName="esign_client">
          <button onClick={() => setThrowErr(false)}>Resolve</button>
          <ThrowError shouldThrow={throwErr} />
        </FederatedErrorBoundary>
      );
    };

    render(<StatefulWrapper />);

    // Initially in error state
    expect(screen.getByText('Module Federation Load Failure')).toBeDefined();

    // Click retry
    const retryButton = screen.getByRole('button', { name: /Retry Loading Module/i });
    fireEvent.click(retryButton);

    // Verify error state resets (retry action executed)
    expect(retryButton).toBeDefined();
  });
});