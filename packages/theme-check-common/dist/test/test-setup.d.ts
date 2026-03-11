declare global {
    export namespace Chai {
        interface ChaiUtils {
            /** deep equality */
            eql: (a: any, b: any) => boolean;
        }
    }
}
export {};
