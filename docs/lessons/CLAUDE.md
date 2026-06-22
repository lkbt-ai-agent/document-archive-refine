# Writing a Lesson

- One document captures one failure pattern.
- Front matter must match `example.md` keys (`type`, `area`, `tags`, `severity`, `status`).
- Sections are fixed. Keep the order `# Problem`, `# Cause`, `# Fix`, `# Prevention`. Do not rename or add sections.
- State the cause precisely. Cite evidence (log lines, ids, counts). Mark guesses as guesses.
- Write complete sentences with subject, object, and verb.
- Keep prose terse. One idea per bullet.
- Use bullets or `###`. Do not use "—" and "·".
- Express flows as lists, not `→` chains.
- `severity` is one of `low`, `medium`, `high`, `critical`.
- `status` is one of `open` (diagnosed only), `mitigated` (temporary workaround), `resolved` (fixed).
- If unresolved, state in `# Fix` whether each remedy is applied or proposed.
- Name files `NN-slug.md`. `NN` is a stable id. Never renumber.
- When resolved, update `status` and `# Fix`. Do not delete the record.
