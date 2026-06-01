//! Detect Unchecked Return Values
//!
//! Flags external call results that are silently discarded, which can hide
//! failures and introduce security vulnerabilities.

use crate::rule_engine::{Rule, RuleViolation, ViolationSeverity};
use syn::{Expr, Item, Stmt};

pub struct UncheckedReturnValuesRule;

impl Rule for UncheckedReturnValuesRule {
    fn name(&self) -> &str {
        "unchecked-return-values"
    }

    fn description(&self) -> &str {
        "Detects external call results that are ignored. Unchecked return values \
         may hide failures and lead to silent errors in contract execution."
    }

    fn check(&self, ast: &[Item]) -> Vec<RuleViolation> {
        let mut violations = Vec::new();
        for item in ast {
            if let Item::Fn(func) = item {
                self.check_stmts(&func.block.stmts, &mut violations);
            }
            if let Item::Impl(impl_block) = item {
                for impl_item in &impl_block.items {
                    if let syn::ImplItem::Fn(method) = impl_item {
                        self.check_stmts(&method.block.stmts, &mut violations);
                    }
                }
            }
        }
        violations
    }
}

impl UncheckedReturnValuesRule {
    fn check_stmts(&self, stmts: &[Stmt], violations: &mut Vec<RuleViolation>) {
        for stmt in stmts {
            if let Stmt::Expr(expr, _) = stmt {
                if self.is_call_expr(expr) {
                    violations.push(RuleViolation {
                        rule_name: self.name().to_string(),
                        description: "Return value of a function call is not checked. \
                            Ignoring return values can hide failures."
                            .to_string(),
                        severity: ViolationSeverity::High,
                        line_number: 0,
                        column_number: 0,
                        variable_name: String::new(),
                        suggestion: "Bind the return value to a variable and handle \
                            the result, e.g. `let result = call(...)?;`."
                            .to_string(),
                    });
                }
            }
        }
    }

    fn is_call_expr(&self, expr: &Expr) -> bool {
        matches!(expr, Expr::Call(_) | Expr::MethodCall(_))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use syn::parse_file;

    fn check(code: &str) -> Vec<RuleViolation> {
        let ast = parse_file(code).expect("parse failed");
        UncheckedReturnValuesRule.check(&ast.items)
    }

    #[test]
    fn flags_ignored_call_result() {
        let code = r#"
            fn transfer(to: Address, amount: u64) {
                do_transfer(to, amount);
            }
        "#;
        assert!(!check(code).is_empty());
    }

    #[test]
    fn no_violation_when_result_is_bound() {
        let code = r#"
            fn transfer(to: Address, amount: u64) {
                let _result = do_transfer(to, amount);
            }
        "#;
        assert!(check(code).is_empty());
    }

    #[test]
    fn flags_ignored_method_call() {
        let code = r#"
            fn run(ctx: Context) {
                ctx.emit_event();
            }
        "#;
        assert!(!check(code).is_empty());
    }
}
