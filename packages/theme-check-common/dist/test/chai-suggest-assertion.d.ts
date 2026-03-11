import { Fix } from '../types';
declare module 'vitest' {
    interface Assertion {
        /**
         * @param source {string} - the source to correct
         * @param message {string} - the suggestion message
         * @param fix {Fix} - the Fix suggested
         *
         * @example
         * expect(offense).to.suggest(file, 'Use an HTML script tag with the defer attribute instead', {
         *   startIndex: 0,
         *   endIndex: file.length,
         *   insert: '<script ... defer></script>'
         * });
         */
        suggest: (source: string, message: string, suggestion?: Fix) => void;
    }
}
export declare const SuggestAssertion: {
    name: string;
    fn: (this: Chai.AssertionPrototype, ...args: any[]) => void;
};
