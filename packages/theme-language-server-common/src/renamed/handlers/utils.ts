import { Template } from '@shopify/theme-check-common';

// this is very very optimistic...
export function isValidTemplate(parsed: unknown): parsed is Template.Template {
  return (
    typeof parsed === 'object' &&
    parsed !== null &&
    'sections' in parsed &&
    'order' in parsed &&
    Array.isArray((parsed as Template.Template).order)
  );
}

export function isValidSectionGroup(parsed: unknown): parsed is Template.SectionGroup {
  return (
    typeof parsed === 'object' &&
    parsed !== null &&
    'sections' in parsed &&
    'order' in parsed &&
    Array.isArray((parsed as Template.SectionGroup).order)
  );
}
