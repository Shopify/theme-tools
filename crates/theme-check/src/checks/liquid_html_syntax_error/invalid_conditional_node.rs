//! `checks/InvalidConditionalNode.ts`

use super::utils::{get_values_in_markup, INVALID_SYNTAX_MESSAGE};
use crate::checks::liquid_syntax_error::block::Problem;
use crate::fixes::Fix;
use crate::js;
use liquid_ast::{Markup, Position};

#[derive(Clone, Copy, PartialEq, Eq)]
enum TokenType {
    Variable,
    Logical,
    Comparison,
    Invalid,
    Literal,
}

struct Token<'a> {
    value: &'a str,
    kind: TokenType,
}

/// `classifyToken(value)` over `TOKEN_PATTERNS`, in order.
fn classify_token(value: &str) -> TokenType {
    let quote = |b: u8| b == b'\'' || b == b'"';
    let b = value.as_bytes();
    let is_number = || {
        let (int, frac) = value.split_once('.').unwrap_or((value, "1"));
        let digits = |s: &str| !s.is_empty() && s.bytes().all(|c| c.is_ascii_digit());
        digits(int) && digits(frac)
    };
    match value {
        "and" | "or" => TokenType::Logical,
        "==" | "!=" | ">=" | "<=" | ">" | "<" | "contains" => TokenType::Comparison,
        "@" | "#" | "$" | "&" => TokenType::Invalid,
        "true" | "false" | "nil" | "empty" | "blank" => TokenType::Literal,
        _ if b.len() >= 2
            && quote(b[0])
            && quote(b[b.len() - 1])
            && !b[1..b.len() - 1].iter().any(|&c| quote(c)) =>
        {
            TokenType::Literal
        }
        _ if is_number() => TokenType::Literal,
        _ => TokenType::Variable,
    }
}

/// `detectInvalidConditionalNode(node)` for a LiquidTag or LiquidBranch (`name`, `markup`,
/// `blockStartPosition`).
pub fn detect_invalid_conditional_node(
    name: Option<&str>,
    markup: &Markup,
    block_start_position: Position,
    source: &str,
) -> Option<Problem> {
    if !matches!(name, Some("if" | "elsif" | "unless")) {
        return None;
    }
    let Markup::Str(markup) = markup else {
        return None;
    };
    let (issue, fix) = analyze_conditional_expression(markup)?;

    let opening_tag = &source[block_start_position.start..block_start_position.end];
    let start = block_start_position.start + opening_tag.find(&**markup)?;
    let end = start + markup.len();
    Some(Problem {
        message: format!("{INVALID_SYNTAX_MESSAGE}: {issue}").into(),
        start,
        end,
        fix: Some(Fix::replace(start, end, fix)),
    })
}

fn is_value_token(token: &Token) -> bool {
    matches!(token.kind, TokenType::Literal | TokenType::Variable)
}

fn is_operator_token(token: &Token) -> bool {
    matches!(token.kind, TokenType::Logical | TokenType::Comparison)
}

fn join(tokens: &[Token]) -> String {
    tokens.iter().map(|t| t.value).collect::<Vec<_>>().join(" ")
}

fn has_js_logical_operators(s: &str) -> bool {
    s.contains("&&") || s.contains("||")
}

/// `ExpressionIssue`: the message and the markup that replaces the whole expression.
type ExpressionIssue = (String, String);

fn check_invalid_starting_token(tokens: &[Token]) -> Option<ExpressionIssue> {
    let first = &tokens[0];
    // `contains` is the only word-operator in the comparison pattern that is also a valid
    // identifier. When it stands alone it is a bare variable named `contains`.
    if tokens.len() == 1 && first.value == "contains" {
        return None;
    }
    matches!(first.kind, TokenType::Invalid | TokenType::Comparison).then(|| {
        (
            format!(
                "Conditional cannot start with '{}'. Use a variable or value instead",
                first.value
            ),
            "false".into(),
        )
    })
}

fn check_trailing_tokens_after_comparison(tokens: &[Token]) -> Option<ExpressionIssue> {
    for i in 0..tokens.len().saturating_sub(3) {
        let (v1, op, v2) = (&tokens[i], &tokens[i + 1], &tokens[i + 2]);
        let remaining = &tokens[i + 3..];
        if is_value_token(v1)
            && op.kind == TokenType::Comparison
            && is_value_token(v2)
            && remaining[0].kind != TokenType::Logical
        {
            let valid_expr = join(&tokens[..i + 3]);
            let junk = join(remaining);
            let message = if has_js_logical_operators(&junk) {
                format!("Conditional is invalid. Anything after '{valid_expr}' will be ignored. Use 'and'/'or' instead of '&&'/'||' for multiple conditions")
            } else {
                format!("Conditional is invalid. Anything after '{valid_expr}' will be ignored")
            };
            return Some((message, valid_expr));
        }
    }
    None
}

fn check_lax_parsing_issues(tokens: &[Token]) -> Option<ExpressionIssue> {
    for i in 0..tokens.len() - 1 {
        let current = &tokens[i];
        if current.kind != TokenType::Literal || is_operator_token(&tokens[i + 1]) {
            continue;
        }
        let remaining = &tokens[i + 1..];
        let has_unknown_operator =
            remaining[0].kind == TokenType::Variable && remaining.iter().any(is_operator_token);
        if !has_unknown_operator {
            let ignored = join(remaining);
            let message = if has_js_logical_operators(&ignored) {
                format!("Expression stops at truthy value '{}', and will ignore: '{ignored}'. Use 'and'/'or' instead of '&&'/'||' for multiple conditions", current.value)
            } else {
                format!(
                    "Expression stops at truthy value '{}', and will ignore: '{ignored}'",
                    current.value
                )
            };
            return Some((message, current.value.into()));
        }
    }
    None
}

fn analyze_conditional_expression(markup: &str) -> Option<ExpressionIssue> {
    let trimmed = js::trim(markup);
    let tokens: Vec<Token> = get_values_in_markup(trimmed)
        .map(|(value, _)| Token {
            value,
            kind: classify_token(value),
        })
        .collect();
    if tokens.is_empty() {
        return None;
    }
    check_invalid_starting_token(&tokens)
        .or_else(|| check_trailing_tokens_after_comparison(&tokens))
        .or_else(|| check_lax_parsing_issues(&tokens))
}
