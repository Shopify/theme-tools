export function isContentForBlock(nodeMarkup: string) {
  const [blockType] = nodeMarkup.split(',');
  if (blockType.replace(/["']/g, '') !== 'block') {
    return false;
  }
  return true;
}
