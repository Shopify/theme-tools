import { describe, expect, it } from 'vitest';
import { recommended } from '../index';
import { ValidBlockTagPlacement } from './index';

describe('ValidBlockTagPlacement', () => {
  it('is enabled in the recommended configuration', () => {
    expect(recommended).toContain(ValidBlockTagPlacement);
  });
});
