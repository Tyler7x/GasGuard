//! Detect External Calls Inside Loops
//!
//! Flags external function calls that appear inside loop bodies.
//! This pattern increases gas costs and expands the reentrancy attack surface.

use crate::rule_engine::{Rule, RuleViolation, ViolationSeverity};
use syn::{Expr, Item, Stmt};

pub struct ExternalCallsInLoopsRule;

impl Rule for ExternalCallsInLoopsRule {
    fn name(&self) -> &str {
        "external-calls-in-loops"
    }

    fn description(&self) -> &str {
        "Detects external calls inside loop bodies. \
         This increases gas risk and expands the reentrancy attack surface."
    }

    fn check(&self, ast: &[Item]) -> Vec<RuleViolation> {
        let mut violations = Vec::new();
        for item in ast {
            if let Item::Fn(func) = item {
                self.check_stmts(&func.block.stmts, &mut violations);
            }
        }
        violations
    }
}

impl ExternalCallsInLoopsRule {
    fn check_stmts(&self, stmts: &[Stmt], violations: &mut Vec<RuleViolation>) {
        for stmt in stmts {
            if let Stmt::Expr(Expr::ForLoop(loop_expr), _) = stmt {
                self.check_loop_body(&loop_expr.body.stmts, violations);
            }
            if let Stmt::Expr(Expr::While(loop_expr), _) = stmt {
                self.check_loop_body(&loop_expr.body.stmts, violations);
            }
        }
    }

    fn check_loop_body(&self, stmts: &[Stmt], violations: &mut Vec<RuleViolation>) {
        for stmt in stmts {
            if let Stmt::Expr(Expr::MethodCall(call), _) = stmt {
                let method = call.method.to_string();
                if matches!(method.as_str(), "transfer" | "call" | "send" | "invoke") {
                    violations.push(RuleViolation {
                        rule_name: self.name().to_string(),
                        description: format!(
                            "External call `{}` inside a loop increases gas and reentrancy risk.",
                            method
                        ),
                        severity: ViolationSeverity::High,
                        line_number: 0,
                        column_number: 0,
                        variable_name: method,
                        suggestion: "Collect results in the loop and perform external calls after."
                            .to_string(),
                    });
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use syn::parse_file;

    #[test]
    fn no_violation_no_loop() {
        let ast = parse_file("fn f() { x.transfer(1); }").expect("parse");
        assert!(ExternalCallsInLoopsRule.check(&ast.items).is_empty());
    }
}