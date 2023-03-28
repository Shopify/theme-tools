import { Position } from '@shopify/prettier-plugin-liquid/dist/types';
import { LiquidCheck } from '@shopify/theme-check-common';
import { Offense } from '../types';

type DisabledChecksMap = Map<string, Map<string, { from: number; to?: number }[]>>;

export function createDisabledChecksModule() {
  const SPECIFIC_CHECK_NOT_DEFINED = '@all';
  const INLINE_COMMENT_TAG = '#';
  const disabledChecks: DisabledChecksMap = new Map();

  function determineRanges(absolutePath: string, value: string, position: Position) {
    const [_, command, checksJoined] =
      value.trim().match(/^(?:theme\-check\-(disable|enable)) ?(.*)/) || [];

    const checks = checksJoined ? checksJoined.split(/,[ ]*/) : [SPECIFIC_CHECK_NOT_DEFINED];

    checks.forEach((check) => {
      const disabledRanges = disabledChecks.get(absolutePath)!;

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

  const DisabledChecks: Partial<LiquidCheck> = {
    async onCodePathStart({ absolutePath }) {
      disabledChecks.set(absolutePath, new Map());
    },

    async LiquidRawTag(node, { absolutePath }) {
      if (node.name !== 'comment') {
        return;
      }

      determineRanges(absolutePath, node.body.value, node.position);
    },

    async LiquidTag(node, { absolutePath }) {
      if (typeof node.markup !== 'string' || node.name !== INLINE_COMMENT_TAG) {
        return;
      }

      determineRanges(absolutePath, node.markup, node.position);
    },
  };

  function isDisabled(offense: Offense) {
    const ranges = [SPECIFIC_CHECK_NOT_DEFINED, offense.check].flatMap((check) => {
      if (!disabledChecks.has(offense.absolutePath)) {
        return [];
      }
      if (!disabledChecks.get(offense.absolutePath)!.has(check)) {
        return [];
      }
      return disabledChecks.get(offense.absolutePath)!.get(check)!;
    });

    return ranges.some(
      (range) => offense.start.index >= range.from && (!range.to || offense.end.index <= range.to),
    );
  }

  return {
    DisabledChecks,
    isDisabled,
  };
}
