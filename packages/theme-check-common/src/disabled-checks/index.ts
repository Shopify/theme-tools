import { Position } from '@shopify/liquid-html-parser';
import { LiquidCheckDefinition, Offense, UriString } from '../types';

type CheckName = string;
type DisabledChecksMap = Map<UriString, Map<CheckName, { from: number; to?: number }[]>>;

export function createDisabledChecksModule() {
  const SPECIFIC_CHECK_NOT_DEFINED = '@all';
  const INLINE_COMMENT_TAG = '#';
  const disabledChecks: DisabledChecksMap = new Map();

  function determineRanges(uri: string, value: string, position: Position) {
    const [_, command, checksJoined] =
      value.trim().match(/^(?:theme\-check\-(disable|enable)) ?(.*)/) || [];

    const checks = checksJoined ? checksJoined.split(/,[ ]*/) : [SPECIFIC_CHECK_NOT_DEFINED];

    checks.forEach((check) => {
      const disabledRanges = disabledChecks.get(uri)!;

      if (command === 'disable') {
        if (!disabledRanges.has(check)) {
          disabledRanges.set(check, []);
        }
        disabledRanges.get(check)!.push({ from: position.end });
      }

      if (command === 'enable') {
        let disabledRangesForCheck = disabledRanges.get(check);
        if (disabledRangesForCheck) {
          disabledRangesForCheck[disabledRangesForCheck.length - 1].to = position.start;
        } else {
          if (check === SPECIFIC_CHECK_NOT_DEFINED) {
            for (let ranges of disabledRanges.values()) {
              for (let range of ranges) {
                if (!range.to) {
                  range.to = position.start;
                }
              }
            }
          }
        }
      }
    });
  }

  const DisabledChecksVisitor: LiquidCheckDefinition = {
    meta: { schema: {} } as any,
    create: ({ file }) => ({
      async onCodePathStart() {
        disabledChecks.set(file.uri, new Map());
      },

      async LiquidRawTag(node) {
        if (node.name !== 'comment') {
          return;
        }

        determineRanges(file.uri, node.body.value, node.position);
      },

      async LiquidTag(node) {
        if (typeof node.markup !== 'string' || node.name !== INLINE_COMMENT_TAG) {
          return;
        }

        determineRanges(file.uri, node.markup, node.position);
      },
    }),
  };

  function isDisabled(offense: Offense) {
    const ranges = [SPECIFIC_CHECK_NOT_DEFINED, offense.check].flatMap((check) => {
      if (!disabledChecks.has(offense.uri)) {
        return [];
      }
      if (!disabledChecks.get(offense.uri)!.has(check)) {
        return [];
      }
      return disabledChecks.get(offense.uri)!.get(check)!;
    });

    return ranges.some(
      (range) => offense.start.index >= range.from && (!range.to || offense.end.index <= range.to),
    );
  }

  return {
    DisabledChecksVisitor,
    isDisabled,
  };
}
