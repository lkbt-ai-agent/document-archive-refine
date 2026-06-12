# Writing an architecture doc

- Front matter is required and must match `example.md`: created/updated dates,
  status (`draft|approved|superseded`), a one-sentence overview, and research refs.
- `overview` must be exactly one sentence stating the doc's role — nothing more.
- The body is free-form — shape it to fit the subdirectory's subject. No fixed
  section skeleton is imposed.
- Keep prose terse — one idea per bullet, like the plan docs.
- `## n.` section numbers are stable cross-ref IDs (cited elsewhere as `§n`).
  Never renumber; append new sections at the end.
- Layers are ordered by abstraction: `01` highest … `06` lowest. A doc may
  reference higher-level docs (lower number) only; never reference a lower-level
  (higher number) doc. References point up, never down.
- Define each concept once, in the highest layer that owns it. Lower docs
  reference that definition — never restate or duplicate it.
- Express flows and multi-step processes as ordered/unordered lists, not arrow
  (`→`) chains in prose. Break long sentences into indented list items.
- Prefer lists over Mermaid. Use a diagram only when a graph is genuinely
  clearer than prose. SQL/bash code blocks are content, not diagrams.

## Subdirectories

- `01-overview/` — System overview, tech stack, deployment topology.
- `02-infrastructure/` — DB environment & spec, LLM runtime environment & spec, environment variables.
- `03-domains/` — Business feature requirements, process flows, domain rules.
- `04-data/` — DB schema, ERD/relations, indexes, migrations, data rules.
- `05-backend/` — Backend implementation spec, API contracts, backend coding guide.
- `06-frontend/` — Frontend implementation spec, UI/UX design, frontend coding guide.

See `example.md` for the front matter.
