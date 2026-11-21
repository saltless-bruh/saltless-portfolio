RFF is an Agent Skill and a CLI that checks whether a feature really works through the running product, instead of trusting the source, the tests or a 200 response.

**Why it exists:** an AI agent can ship software that looks finished and is not.

```
button exists    ≠ feature works
test passes      ≠ feature works
HTTP 200         ≠ the side effect happened
```

**The question it asks instead:** can the claim be falsified with a reproducible counterexample?

1. **FALSIFIED:** a reproducible counterexample breaks a claimed obligation.
2. **NOT_FALSIFIED:** every planned probe ran and none broke it. Never called "verified".
3. **BLOCKED:** a dependency, credential or environment it needs is missing.
4. **INCONCLUSIVE:** the evidence is ambiguous, or the budget ran out.

**How it keeps itself honest:** the target stays read-only during an audit, and every run is sealed with hash-chained ledgers, so a result can be checked, not just believed. One feature (`FEATURE`) or the whole product (`SYSTEM`); reports in Markdown, JSON or SARIF.

> **In short:** the auditor stops asking "does it look done?" and starts trying to prove it is not.

github.com/saltless-bruh/runtime-feature-falsifier
