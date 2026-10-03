// File: packages/shared/ui-components/src/components/Button/Button.unit.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders children correctly', () => {
    render(<Button>Click Me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('triggers onClick handler when clicked', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<Button onClick={handleClick}>Submit</Button>);
    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('suppresses onClick and disables the button when disabled is true', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(
      <Button disabled onClick={handleClick}>
        Disabled Action
      </Button>
    );

    const button = screen.getByRole('button', { name: /disabled action/i });
    expect(button).toBeDisabled();

    await user.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('renders loading spinner and disables interaction when isLoading is true', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(
      <Button isLoading onClick={handleClick}>
        Save Changes
      </Button>
    );

    const button = screen.getByRole('button', { name: /save changes/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');

    // Verify SVG spinner is rendered
    const spinner = button.querySelector('svg');
    expect(spinner).toBeInTheDocument();

    await user.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('renders leading and trailing icons correctly when not loading', () => {
    render(
      <Button
        leftIcon={<span data-testid="left-icon">←</span>}
        rightIcon={<span data-testid="right-icon">→</span>}
      >
        Navigation
      </Button>
    );

    expect(screen.getByTestId('left-icon')).toBeInTheDocument();
    expect(screen.getByTestId('right-icon')).toBeInTheDocument();
  });

  it('hides left icon when isLoading is true to prevent layout distortion', () => {
    render(
      <Button isLoading leftIcon={<span data-testid="left-icon">←</span>}>
        Loading State
      </Button>
    );

    expect(screen.queryByTestId('left-icon')).not.toBeInTheDocument();
  });

  it('defaults to type="button" to prevent accidental form submissions', () => {
    render(<Button>Action</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('forwards ref to the underlying native button element', () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(<Button ref={ref}>Ref Target</Button>);

    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current?.tagName).toBe('BUTTON');
  });
});