import { expect, describe, it } from 'vitest';
import { UniqueSettingIds } from './index';
import { highlightedOffenses, runJSONCheck } from '../../test';
import { invalidJson, validJson } from './test-data';

describe('Module: UniqueSettingIds', () => {
  it("Should report an error for duplicate id's in settings_schema (0)", async () => {
    const offenses = await runJSONCheck(UniqueSettingIds, invalidJson, 'file.json');

    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal('Duplicate setting id found: "nosto_account_id"');

    const highlights = highlightedOffenses({ 'file.json': invalidJson }, offenses);

    expect(highlights).to.have.length(1);
    expect(highlights[0]).to.equal('"id": "nosto_account_id"');
  });

  it('should not report any errors for valid file', async () => {
    const offenses = await runJSONCheck(UniqueSettingIds, validJson);

    expect(offenses).to.be.empty;
  });
});
