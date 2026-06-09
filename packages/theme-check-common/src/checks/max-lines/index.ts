import { LiquidCheckDefinition, SchemaProp, Severity, SourceCodeType } from '../../types';

const schema = {
  max: SchemaProp.number(300),
  skipBlankLines: SchemaProp.boolean(false),
  skipComments: SchemaProp.boolean(false),
  skipSchema: SchemaProp.boolean(true),
  skipDoc: SchemaProp.boolean(true),
};

export const MaxLines: LiquidCheckDefinition<typeof schema> = {
  meta: {
    code: 'MaxLines',
    name: 'Max Lines',
    docs: {
      description:
        'Enforce a maximum number of lines per file to keep files focused and maintainable.',
      recommended: false,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema,
    targets: [],
  },

  create(context) {
    const skipRanges: Array<[number, number]> = [];

    return {
      async LiquidRawTag(node) {
        const { skipSchema, skipComments, skipDoc } = context.settings;
        if (
          (skipSchema && node.name === 'schema') ||
          (skipComments && node.name === 'comment') ||
          (skipDoc && node.name === 'doc')
        ) {
          skipRanges.push([node.position.start, node.position.end]);
        }
      },

      async LiquidTag(node) {
        if (context.settings.skipComments && node.name === '#') {
          skipRanges.push([node.position.start, node.position.end]);
        }
      },

      async HtmlComment(node) {
        if (context.settings.skipComments) {
          skipRanges.push([node.position.start, node.position.end]);
        }
      },

      async onCodePathEnd(file) {
        const { max, skipBlankLines } = context.settings;
        const lines = file.source.split('\n');

        const lineStartOffsets: number[] = [];
        let offset = 0;
        for (const line of lines) {
          lineStartOffsets.push(offset);
          offset += line.length + 1;
        }

        const countingLineIndices: number[] = [];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i] ?? '';
          if (skipBlankLines && line.trim() === '') continue;

          const lineStart = lineStartOffsets[i] ?? 0;
          const lineEnd = lineStart + line.length;

          const isSkipped = skipRanges.some(([s, e]) => lineEnd >= s && lineStart <= e);

          if (!isSkipped) countingLineIndices.push(i);
        }

        if (countingLineIndices.length > max) {
          const excessLineIndex = countingLineIndices.at(max);
          const excessLine = excessLineIndex !== undefined ? lines.at(excessLineIndex) : undefined;

          if (excessLineIndex !== undefined && excessLine !== undefined) {
            const startIndex = lineStartOffsets[excessLineIndex] ?? 0;
            context.report({
              message: `File has too many lines (${countingLineIndices.length}). Maximum allowed is ${max}.`,
              startIndex,
              endIndex: startIndex + excessLine.length,
            });
          }
        }
      },
    };
  },
};
