// File: services/core/topology-service/client/src/widgets/ConnectionFormWidget.unit.test.tsx
import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import ConnectionFormWidget from './ConnectionFormWidget';

const server = setupServer(
  http.post('/api/v1/topology/entities', () => {
    return HttpResponse.json({ success: true }, { status: 201 });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('ConnectionFormWidget Component Interactivity', () => {
  it('should render all deployment form fields and the action button', () => {
    render(<ConnectionFormWidget />);
    
    expect(screen.getByText(/Deploy Asset Connection/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Source Node ID/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Target Node ID/i)).toBeInTheDocument();
  });

  it('should submit the connection payload and dispatch the browser event bus mutation signal', async () => {
    const eventListener = vi.fn();
    window.addEventListener('topology:graph-mutated', eventListener);

    render(<ConnectionFormWidget />);

    // Fill out required inputs
    fireEvent.change(screen.getByLabelText(/Source Node ID/i), { target: { value: 'ac-f16-alpha' } });
    fireEvent.change(screen.getByLabelText(/Target Node ID/i), { target: { value: 'fob-bastion' } });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /Inject Graph Connection/i }));

    // Verify the browser event bus successfully fired
    await waitFor(() => {
      expect(eventListener).toHaveBeenCalled();
    });

    window.removeEventListener('topology:graph-mutated', eventListener);
  });
});