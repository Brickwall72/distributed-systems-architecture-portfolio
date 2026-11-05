import type { Request, Response } from 'express';
import { createRateLimit } from './rateLimit';

const call = (limiter: ReturnType<typeof createRateLimit>, ip: string | undefined) => {
  const next = vi.fn();
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  limiter({ ip } as Request, { status } as unknown as Response, next);
  return { next, status, json };
};

describe('createRateLimit', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('allows up to the max per window and rejects beyond it', () => {
    const limiter = createRateLimit(2);
    expect(call(limiter, '1.1.1.1').next).toHaveBeenCalled();
    expect(call(limiter, '1.1.1.1').next).toHaveBeenCalled();

    const blocked = call(limiter, '1.1.1.1');
    expect(blocked.next).not.toHaveBeenCalled();
    expect(blocked.status).toHaveBeenCalledWith(429);
    expect(blocked.json).toHaveBeenCalledWith({ error: 'Too many requests' });
  });

  it('tracks each IP independently', () => {
    const limiter = createRateLimit(1);
    call(limiter, '1.1.1.1');
    expect(call(limiter, '1.1.1.1').status).toHaveBeenCalledWith(429);
    expect(call(limiter, '2.2.2.2').next).toHaveBeenCalled();
  });

  it('resets the count once the window has elapsed', () => {
    const limiter = createRateLimit(1);
    call(limiter, '1.1.1.1');
    expect(call(limiter, '1.1.1.1').status).toHaveBeenCalledWith(429);

    vi.advanceTimersByTime(60_001);
    expect(call(limiter, '1.1.1.1').next).toHaveBeenCalled();
  });

  it('groups requests without an IP under a single key', () => {
    const limiter = createRateLimit(1);
    call(limiter, undefined);
    expect(call(limiter, undefined).status).toHaveBeenCalledWith(429);
  });
});
