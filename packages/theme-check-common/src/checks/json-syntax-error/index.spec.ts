import { expect, describe, it } from 'vitest';
import { JSONSyntaxError } from './index';
import { highlightedOffenses, runJSONCheck } from '../../test';

describe('Module: JSONSyntaxError', () => {
  it('should report an error for invalid JSON (0)', async () => {
    const invalidJson = `{
      "key1": "value1",
      "key2": "value2",,
    }`;

    const offenses = await runJSONCheck(JSONSyntaxError, invalidJson, 'file.json');
    expect(offenses).to.have.length(2);
    expect(offenses[0].message).to.equal('Property name expected');
    expect(offenses[1].message).to.equal('Expecting a value');

    const highlights = highlightedOffenses({ 'file.json': invalidJson }, offenses);
    expect(highlights).to.have.length(2);
    expect(highlights[0]).to.equal(',');
    expect(highlights[1]).to.equal(',');
  });

  it('should report an error for invalid JSON (1)', async () => {
    const invalidJson = `{
      "key1": "value1",
      "key2": "value2"
    `;

    const offenses = await runJSONCheck(JSONSyntaxError, invalidJson, 'file.json');
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal('Expecting a closing brace (})');

    const highlights = highlightedOffenses({ 'file.json': invalidJson }, offenses);
    expect(highlights).to.have.length(1);
    expect(highlights[0]).to.equal('');
  });

  it('should report an error for invalid JSON (2)', async () => {
    const invalidJson = `{
      'key1': "value1",
      "key2": "value2"
    }`;

    const offenses = await runJSONCheck(JSONSyntaxError, invalidJson, 'file.json');
    expect(offenses).to.have.length(3);
    expect(offenses[0].message).to.equal('Invalid symbol');
    expect(offenses[1].message).to.equal('Property name expected');
    expect(offenses[2].message).to.equal('Expecting a value');

    const highlights = highlightedOffenses({ 'file.json': invalidJson }, offenses);
    expect(highlights).to.have.length(3);
    expect(highlights[0]).to.equal("'key1'");
  });

  it('should not report any errors for valid JSON', async () => {
    const validJson = `{
      "key1": "value1",
      "key2": "value2"
    }`;

    const offenses = await runJSONCheck(JSONSyntaxError, validJson);
    expect(offenses).to.be.empty;
  });
});
