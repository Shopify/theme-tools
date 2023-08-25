import type { StageFunction } from './types';

/**
 * Async implementation of lodash's flow function
 */
export const flow = (fns: Array<StageFunction>) => async () => {
  let result = undefined;

  for (let i = 0; i < fns.length; i++) {
    const fn = fns[i];
    try {
      result = await fn(result);
    } catch (error) {
      console.error(`Error in function ${fn.name}:`, error);
      throw error; // Re-throw the error so it can be handled upstream
    }
  }

  return result;
};
