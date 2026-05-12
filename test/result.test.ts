import { describe, it, expect } from 'vitest';
import { ok, err } from '../src/lib/result';

describe('Result helpers', () => {
  it('ok() wraps a value as a success', () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 });
  });

  it('err() wraps an error as a failure', () => {
    expect(err('nope')).toEqual({ ok: false, error: 'nope' });
  });
});
