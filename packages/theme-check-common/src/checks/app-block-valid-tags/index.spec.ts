import { describe, it, expect } from 'vitest';
import { ForbiddenTag } from './index';

describe('Module: AppBlockValidTags', () => {
  it('should contain specifically the following forbidden tags', async () => {
    const actualTagValues = Object.values(ForbiddenTag);
    const expectedTagValues = [
      'javascript',
      'stylesheet',
      'include',
      'layout',
      'section',
      'sections',
    ];

    expectedTagValues.forEach((tag) => expect(actualTagValues).toContain(tag));
    expect(actualTagValues.length).toBe(expectedTagValues.length);
  });
});
