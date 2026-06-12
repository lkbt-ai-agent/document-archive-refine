# Writing an architecture doc

- Front matter is required and must match `example.md`: created/updated dates,
  status (`draft|approved|superseded`), a one-sentence overview, and research refs.
- The body is free-form — shape it to fit the subdirectory's subject. No fixed
  section skeleton is imposed.
- Keep prose terse — one idea per bullet, like the plan docs.
- `## n.` section numbers are stable cross-ref IDs (cited elsewhere as `§n`).
  Never renumber; append new sections at the end.
- Prefer ordered/unordered lists over Mermaid. Use a diagram only when a graph
  is genuinely clearer than prose. SQL/bash code blocks are content, not diagrams.
- Don't duplicate across docs — reference the owning doc (`§n`) instead.

## Subdirectories

- `01-overview/` — System overview, tech stack, deployment topology.
- `02-infrastructure/` — DB environment & spec, LLM runtime environment & spec, environment variables.
- `03-domains/` — Business feature requirements, process flows, domain rules.
- `04-data/` — DB schema, ERD/relations, indexes, migrations, data rules.
- `05-backend/` — Backend implementation spec, API contracts, backend coding guide.
- `06-frontend/` — Frontend implementation spec, UI/UX design, frontend coding guide.

See `example.md` for the front matter.
