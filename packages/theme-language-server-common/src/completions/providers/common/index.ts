export { createCompletionItem } from './CompletionItemProperties';
export { Provider } from './Provider';

export function sortByName(
  { name: nameA }: { name: string },
  { name: nameB }: { name: string },
): number {
  if (nameA < nameB) {
    return -1;
  }

  if (nameA > nameB) {
    return 1;
  }

  // names must be equal
  return 0;
}
