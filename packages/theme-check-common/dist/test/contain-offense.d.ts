import { MatcherState, RawMatcherFn } from '@vitest/expect';
interface CustomMatchers<R = unknown> {
    containOffense(offense: any): R;
}
declare module 'vitest' {
    interface Assertion<T = any> extends CustomMatchers<T> {
    }
    interface AsymmetricMatchersContaining extends CustomMatchers {
    }
}
export declare const containOffense: RawMatcherFn<MatcherState>;
export {};
