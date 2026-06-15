# Writing an Architecture Document
- Front matter must match `example.md`.
- `overview` is exactly one sentence describing the doc's role.
- Keep prose terse. One idea per bullet.
- Use bullets or `###` for subtopics. Do not use "—".
- `## n.` are stable cross-ref IDs (`§n`). Never renumber. Append only.
- Layers: `01` (highest) → `06` (lowest). Reference upward only.
- Express flows as lists, not `→` chains.
- Prefer lists over Mermaid. Use diagrams only when clearly better.
- SQL/bash code blocks are content, not diagrams.
