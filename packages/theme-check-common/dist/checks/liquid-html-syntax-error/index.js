"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiquidHTMLSyntaxError = void 0;
const types_1 = require("../../types");
const utils_1 = require("../../utils");
const MultipleAssignValues_1 = require("./checks/MultipleAssignValues");
const InvalidBooleanExpressions_1 = require("./checks/InvalidBooleanExpressions");
const InvalidEchoValue_1 = require("./checks/InvalidEchoValue");
const InvalidConditionalNode_1 = require("./checks/InvalidConditionalNode");
const InvalidLoopRange_1 = require("./checks/InvalidLoopRange");
const InvalidLoopArguments_1 = require("./checks/InvalidLoopArguments");
const InvalidConditionalNodeParenthesis_1 = require("./checks/InvalidConditionalNodeParenthesis");
const InvalidFilterName_1 = require("./checks/InvalidFilterName");
const InvalidPipeSyntax_1 = require("./checks/InvalidPipeSyntax");
const utils_2 = require("../utils");
function isParsingErrorWithLocation(error) {
    return 'name' in error && error.name === 'LiquidHTMLParsingError' && 'loc' in error;
}
function cleanErrorMessage(message, highlight) {
    return message
        .replace(/Line \d+, col \d+:\s+/, 'SyntaxError: ')
        .replace(/(?!<expected ".+",) not .*/, ` not "${highlight}"`);
}
exports.LiquidHTMLSyntaxError = {
    meta: {
        code: 'LiquidHTMLSyntaxError',
        aliases: ['SyntaxError', 'HtmlParsingError'],
        name: 'Prevent LiquidHTML Syntax Errors',
        docs: {
            description: 'This check exists to inform the user of Liquid HTML syntax errors.',
            recommended: true,
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.ERROR,
        schema: {},
        targets: [],
    },
    create(context) {
        var _a, _b;
        const ast = context.file.ast;
        const filtersPromise = (_a = context.themeDocset) === null || _a === void 0 ? void 0 : _a.filters();
        const tagsPromise = (_b = context.themeDocset) === null || _b === void 0 ? void 0 : _b.tags();
        if (!(0, utils_1.isError)(ast)) {
            return {
                async BooleanExpression(node, ancestors) {
                    if ((0, utils_2.isWithinRawTagThatDoesNotParseItsContents)(ancestors))
                        return;
                    const problem = (0, InvalidBooleanExpressions_1.detectInvalidBooleanExpressions)(node, ancestors);
                    if (!problem) {
                        return;
                    }
                    context.report(problem);
                },
                async LiquidTag(node, ancestors) {
                    if ((0, utils_2.isWithinRawTagThatDoesNotParseItsContents)(ancestors))
                        return;
                    const problems = [
                        (0, MultipleAssignValues_1.detectMultipleAssignValues)(node),
                        (0, InvalidEchoValue_1.detectInvalidEchoValue)(node),
                        (0, InvalidLoopRange_1.detectInvalidLoopRange)(node),
                        (0, InvalidLoopArguments_1.detectInvalidLoopArguments)(node, await tagsPromise),
                    ].filter(Boolean);
                    // Fixers for `detectConditionalNodeUnsupportedParenthesis` and `detectInvalidConditionalNode` consume
                    // the whole node markup, so we MUST not run both.
                    const conditionalNodeProblem = (0, InvalidConditionalNodeParenthesis_1.detectConditionalNodeUnsupportedParenthesis)(node) || (0, InvalidConditionalNode_1.detectInvalidConditionalNode)(node);
                    if (conditionalNodeProblem) {
                        problems.push(conditionalNodeProblem);
                    }
                    problems.forEach(context.report);
                    const filterProblems = await (0, InvalidFilterName_1.detectInvalidFilterName)(node, await filtersPromise);
                    if (filterProblems.length > 0) {
                        filterProblems.forEach((filterProblem) => context.report(filterProblem));
                    }
                    const pipeProblems = await (0, InvalidPipeSyntax_1.detectInvalidPipeSyntax)(node);
                    if (pipeProblems.length > 0) {
                        pipeProblems.forEach((pipeProblem) => context.report(pipeProblem));
                    }
                },
                async LiquidBranch(node, ancestors) {
                    if ((0, utils_2.isWithinRawTagThatDoesNotParseItsContents)(ancestors))
                        return;
                    const problem = (0, InvalidConditionalNode_1.detectInvalidConditionalNode)(node);
                    if (!problem) {
                        return;
                    }
                    context.report(problem);
                },
                async LiquidVariableOutput(node, ancestors) {
                    if ((0, utils_2.isWithinRawTagThatDoesNotParseItsContents)(ancestors))
                        return;
                    const filterProblems = await (0, InvalidFilterName_1.detectInvalidFilterName)(node, await filtersPromise);
                    if (filterProblems.length > 0) {
                        filterProblems.forEach((problem) => context.report(problem));
                    }
                    const pipeProblems = await (0, InvalidPipeSyntax_1.detectInvalidPipeSyntax)(node);
                    if (pipeProblems.length > 0) {
                        pipeProblems.forEach((pipeProblem) => context.report(pipeProblem));
                    }
                    const problem = (0, InvalidEchoValue_1.detectInvalidEchoValue)(node);
                    if (problem) {
                        context.report(problem);
                    }
                },
            };
        }
        return {
            async onCodePathStart(file) {
                if (isParsingErrorWithLocation(ast)) {
                    const { start, end } = ast.loc;
                    const startIndex = (0, utils_1.getOffset)(file.source, start.line, start.column);
                    let endIndex = (0, utils_1.getOffset)(file.source, end.line, end.column);
                    if (startIndex === endIndex)
                        endIndex += 1;
                    const highlight = file.source.slice(startIndex, endIndex);
                    context.report({
                        message: cleanErrorMessage(ast.message, highlight),
                        startIndex,
                        endIndex: endIndex,
                    });
                }
                else {
                    context.report({
                        message: ast.message,
                        startIndex: 0,
                        endIndex: file.source.length,
                    });
                }
            },
        };
    },
};
//# sourceMappingURL=index.js.map