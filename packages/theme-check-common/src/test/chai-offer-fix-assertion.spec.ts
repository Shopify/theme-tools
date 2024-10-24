import { expect, describe, it } from 'vitest';
import { LiquidHtmlSuggestion, Offense, Fix, SourceCodeType } from '../types';

describe('Module: SuggestAssertion', () => {
  const file = 'I love tea!';
  const suggestionMessage = 'Replace tea with coffee!';
  const suggestion: LiquidHtmlSuggestion = {
    message: suggestionMessage,
    fix: (corrector) => {
      corrector.replace(file.indexOf('tea'), file.indexOf('tea') + 3, 'coffee');
    },
  };

  const appliedSuggestion: Fix = {
    startIndex: file.indexOf('tea'),
    endIndex: file.indexOf('tea') + 3,
    insert: 'coffee',
  };

  let offense: Offense<SourceCodeType.LiquidHtml>;

  it('should do negative assertions correctly', () => {
    offense = buildOffense();
    expect(offense).not.to.suggest(file, suggestionMessage);

    offense = buildOffense([suggestion]);
    expect(offense).not.to.suggest(file, suggestionMessage + 'typo', appliedSuggestion);
    expect(offense).not.to.suggest(file, suggestionMessage, {
      startIndex: 0, // wrong index,
      endIndex: 0,
      insert: 'coffee',
    });
  });

  it('should do positive assertions correctly', () => {
    offense = buildOffense([suggestion]);
    expect(offense).to.suggest(file, suggestionMessage);
    expect(offense).to.suggest(file, suggestionMessage, appliedSuggestion);
  });

  function buildOffense(suggestions?: LiquidHtmlSuggestion[]): Offense<SourceCodeType.LiquidHtml> {
    return {
      type: SourceCodeType.LiquidHtml,
      message: 'Coffee is better',
      uri: 'file:///snippets/cookies.liquid',
      check: '',
      severity: 0,
      start: { index: 0, line: 0, character: 0 },
      end: { index: 0, line: 0, character: 0 },
      suggest: suggestions,
    };
  }
});
