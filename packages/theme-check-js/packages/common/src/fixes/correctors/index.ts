import { Corrector, SourceCodeType } from '../../types';
import { JSONCorrector } from './json-corrector';
import { StringCorrector } from './string-corrector';

export { JSONCorrector, StringCorrector };

export function createCorrector<S extends SourceCodeType>(
  sourceCodeType: S,
  source: string,
): Corrector<S> {
  switch (sourceCodeType) {
    case SourceCodeType.JSON: {
      return new JSONCorrector(source) as Corrector<typeof sourceCodeType>;
    }
    case SourceCodeType.LiquidHtml: {
      return new StringCorrector(source) as Corrector<typeof sourceCodeType>;
    }
    default: {
      return assertNever(sourceCodeType);
    }
  }
}

function assertNever(x: never): never {
  throw new Error(`Case statement not exhausted: ${x}`);
}
