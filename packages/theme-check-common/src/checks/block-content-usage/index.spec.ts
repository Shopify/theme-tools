import { describe, expect, it } from 'vitest';
import { recommended } from '../index';
import { Severity } from '../../types';
import { BlockContentUsage } from './index';

describe('BlockContentUsage', () => {
  it('is a recommended error', () => {
    expect(recommended).toContain(BlockContentUsage);
    expect(BlockContentUsage.meta.severity).toBe(Severity.ERROR);
  });
});
