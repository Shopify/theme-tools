import { describe, expect, it } from 'vitest';
import { recommended } from '../index';
import { Severity } from '../../types';
import { ValidBlockContentSettingType } from './index';

describe('ValidBlockContentSettingType', () => {
  it('is a recommended error', () => {
    expect(recommended).toContain(ValidBlockContentSettingType);
    expect(ValidBlockContentSettingType.meta.severity).toBe(Severity.ERROR);
  });
});
