import { Dependencies } from '@shopify/theme-check-common';
import fs from 'node:fs/promises';

export async function fileExists(path: string) {
  try {
    await fs.stat(path);
    return true;
  } catch (e) {
    return false;
  }
}

export const fileSize: NonNullable<Dependencies['fileSize']> = async (path: string) => {
  try {
    const stats = await fs.stat(path);
    return stats.size;
  } catch (error) {
    console.error(`Failed to get file size: ${error}`);
    return 0;
  }
};
