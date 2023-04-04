import {
  Config as ThemeCheckConfig,
  allChecks,
  recommended as recommendedChecks,
} from '@shopify/theme-check-common';

export * from './types';
export { startServer } from './server';
export { ThemeCheckConfig, recommendedChecks, allChecks };
