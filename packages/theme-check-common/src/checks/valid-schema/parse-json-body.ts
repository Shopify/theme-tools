import { LiquidRawTag, Position } from '@shopify/liquid-html-parser';

/**
 * Parses the error message from a `SyntaxError`
 * Returns the character position number from the error.
 */
const getErrorPositionFromSyntaxError = (error: SyntaxError): number => {
  let matches;
  if ((matches = error.message.match(/at position (\d+)/))) {
    return Number(matches[1]);
  }

  return 0;
};

/**
 * Returns the portion of `input` before the first occurrence of `substring`.
 */
const substringBefore = (input: string, substring: string): string => {
  const index = input.indexOf(substring);

  if (index === -1) {
    return input;
  }

  return input.slice(0, index);
};

export class JsonParseError extends SyntaxError {
  position: Position;

  constructor(message: string, position: Position) {
    super(message);
    this.name = 'JsonParseError';
    this.position = position;
  }
}

/**
 * Parses the body of a liquid raw tag as JSON and returns the parsed object.
 *
 * When the body is not valid JSON, returns an error message, and the indicies of the error.
 */
export const parseJsonBody = (node: LiquidRawTag): object | Error => {
  try {
    return JSON.parse(node.body.value);
  } catch (error) {
    const defaultPosition = {
      start: node.blockStartPosition.end,
      end: node.blockEndPosition.start,
    };

    if (error instanceof SyntaxError) {
      const schemaCharIndex = getErrorPositionFromSyntaxError(error);

      const offset = node.blockStartPosition.end;
      const position = schemaCharIndex
        ? {
            /**
             * Offset the error indicies by the position where the syntax error occurred.
             * A single character position can be hard to see it or hover for details.
             * A position length of 3 characters makes a good balance between visibility and accuracy.
             */
            start: offset + schemaCharIndex - 1,
            end: offset + schemaCharIndex + 1,
          }
        : defaultPosition;

      const sanitizedMessage = substringBefore(error.message, ' in JSON at position');

      return new JsonParseError(sanitizedMessage, position);
    }

    return new JsonParseError((error as Error)?.message ?? 'Unknown error', defaultPosition);
  }
};
