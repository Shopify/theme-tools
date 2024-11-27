import { AugmentedDependencies, CheckNodeMethod, LiquidCheckDefinition, LiquidHtmlNode, LiquidHtmlNodeTypes, RelativePath, Schema, Settings, Severity, SourceCodeType, StringCorrector, UriString, ValidateJSON } from "../..";

export const PresetsKeyMatches: LiquidCheckDefinition = {
    meta: {
        name: "PresetsKeyMatches",
        code: "PresetsKeyMatches",
        severity: Severity.ERROR,
        type: SourceCodeType.LiquidHtml,
        docs: {
            description: "",
            recommended: undefined,
            url: undefined
        },
        schema: {},
        targets: [],
    },

    create(context){
        return{
            async Document(node){
                debugger;
            }
        }
    }
}
