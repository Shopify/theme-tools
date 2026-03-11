import { Fix } from '../types';
declare module 'vitest' {
    interface Assertion {
        /**
         * @param source {string} - the source to correct
         * @param message {string} - the suggestion message
         * @param fix {Fix} - the Fix suggested
         *
         * @example
         * expect(offense).to.offerFix(file, {
         *   startIndex: 0,
         *   endIndex: file.length,
         *   insert: '<script ... defer></script>'
         * });
         */
        offerFix: (source: string, fix: Fix) => void;
    }
}
export declare const OfferFixAssertion: {
    name: string;
    fn: (this: Chai.AssertionPrototype, ...args: any[]) => void;
};
