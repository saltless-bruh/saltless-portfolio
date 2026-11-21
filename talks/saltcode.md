Saltcode is a Pi Coding Agent package that gives Pi spec-driven engineering discipline: a frontier model plans once, a local model does the building.

**How a sprint runs**

```
frontier model ──plans once per sprint──▶ typed JSON contracts on disk
                                                   │
local model ◀──── loops at $0 API cost ────────────┘
   └─▶ static gate ─▶ test gate ─▶ faithfulness gate ─▶ regression gate
                                                             │
                                          checkpoint: a git commit to resume from
```

**Who owns what** (the split is load-bearing)

1. **Pi** owns the agent loop, tool dispatch, the session store and the TUI.
2. **The extension** (TypeScript) owns orchestration, routing, access control and state.
3. **The backend** (Python) owns everything that computes, validates, runs code or stores vectors.

**Where it stands:** scaffolding. The backend contracts, providers, harness, an LSP/AST MCP server and the memory layer are done; the TypeScript extension is still a stub.

> **In short:** plan with the expensive model once, build with the free one, and let four gates decide what lands.
>
> **The honest limit:** meaning across task boundaries (one task returns cents, the next passes dollars) is still a human check.

github.com/saltless-bruh/saltcode
