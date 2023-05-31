import fs from 'node:fs';
import { promisify } from 'node:util';

export const fileExists = promisify(fs.exists);
