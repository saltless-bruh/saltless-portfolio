SNP is a self-hosted memory for coding agents and engineering teams: a Git-backed wiki the agents search, over PostgreSQL 16 and pgvector.

**How a question finds its answer**

```
agent ──wiki_search, wiki_read──▶ Scout ──▶ PostgreSQL 16 + pgvector (row-level security)
                                                ▲
raw/ + wiki/ ──▶ sync-job ──────────────────────┘
git push ──signed webhook──▶ host-sync ──▶ immutable commit snapshots, swapped in atomically
```

**What makes it careful**

1. **Scout never writes the answer itself.** Search finds the page; the page is the answer, cited by its path and heading.
2. **Every query is filtered by the caller's department** (redteam, blueteam, ai_eng, infra), in the database, not in the app.
3. **A raw file that matches no access rule is not indexed at all.** There is no quiet fallback to public.
4. **Querying and ingesting run as separate least-privilege roles**; only a one-shot service may change the schema.

> **In short:** a memory agents can cite, not a pile of embeddings they paraphrase.

github.com/saltless-bruh/memory-system
