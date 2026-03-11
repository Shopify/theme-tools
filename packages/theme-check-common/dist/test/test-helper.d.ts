import { CheckDefinition, ChecksSettings, Dependencies, JSONCorrector, Offense, SourceCodeType, StringCorrector, Theme } from '../index';
import { MockTheme } from './MockTheme';
export { JSONCorrector, StringCorrector };
export declare function getTheme(themeDesc: MockTheme): Theme;
export declare function check(themeDesc: MockTheme, checks?: CheckDefinition[], mockDependencies?: Partial<Dependencies>, checkSettings?: ChecksSettings): Promise<Offense[]>;
export declare function runLiquidCheck(checkDef: CheckDefinition<SourceCodeType.LiquidHtml>, sourceCode: string, fileName?: string, mockDependencies?: Partial<Dependencies>, existingThemeFiles?: MockTheme): Promise<Offense[]>;
export declare function runJSONCheck(checkDef: CheckDefinition<SourceCodeType.JSON>, sourceCode: string, fileName?: string, mockDependencies?: Partial<Dependencies>): Promise<Offense[]>;
export declare function autofix(themeDesc: MockTheme, offenses: Offense[]): Promise<{
    [x: string]: string;
}>;
export declare function applyFix(themeDescOrSource: MockTheme | string, offense: Offense): string | undefined;
export declare function applySuggestions(themeDescOrSource: MockTheme | string, offense: Offense): undefined | string[];
export declare function highlightedOffenses(themeOrSource: MockTheme | string, offenses: Offense[]): string[];
export declare function prettyJSON(obj: any): string;
