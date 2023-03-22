import { Position } from '@shopify/prettier-plugin-liquid/dist/types';
import { LiquidCheck } from '@shopify/theme-check-common';
import { Offense } from '../types';

type DisabledChecksMap = Map<string, Map<string, { from: number; to?: number }[]>>;

export function createDisabledChecksModule() {
  const SPECIFIC_CHECK_NOT_DEFINED = '@all';
  const INLINE_COMMENT_TAG = '#';
  const disabledChecks: DisabledChecksMap = new Map();

  function determineRanges(relativePath: string, value: string, position: Position) {
    const [_, command, checksJoined] =
      value.trim().match(/^(?:theme\-check\-(disable|enable)) ?(.*)/) || [];

    const checks = checksJoined ? checksJoined.split(/,[ ]*/) : [SPECIFIC_CHECK_NOT_DEFINED];

    checks.forEach((check) => {
      const disabledRanges = disabledChecks.get(relativePath)!;

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
    async onCodePathStart({ relativePath }) {
      disabledChecks.set(relativePath, new Map());
    },

    async LiquidRawTag(node, { relativePath }) {
      if (node.name !== 'comment') {
        return;
      }

      determineRanges(relativePath, node.body.value, node.position);
    },

    async LiquidTag(node, { relativePath }) {
      if (typeof node.markup !== 'string' || node.name !== INLINE_COMMENT_TAG) {
        return;
      }

      determineRanges(relativePath, node.markup, node.position);
    },
  };

  function isDisabled(offense: Offense) {
    const ranges = [SPECIFIC_CHECK_NOT_DEFINED, offense.check].flatMap((check) => {
      if (!disabledChecks.has(offense.relativePath)) {
        return [];
      }
      if (!disabledChecks.get(offense.relativePath)!.has(check)) {
        return [];
      }
      return disabledChecks.get(offense.relativePath)!.get(check)!;
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
