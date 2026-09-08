# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root, or
- **`CONTEXT-MAP.md`** at the repo root if it exists; read each context relevant to the topic.
- **`docs/adr/`**: read ADRs that concern the area about to be changed.

If these files do not exist, proceed silently. The `/domain-modeling` skill creates them lazily when terminology or decisions are resolved.

## File structure

This repository uses a single-context layout:

```text
/
├── CONTEXT.md
├── docs/adr/
└── src/
```

## Use the glossary's vocabulary

When output names a domain concept, use the term defined in `CONTEXT.md`. Avoid synonyms that its glossary explicitly rejects.

If a needed concept is absent, reconsider whether the language belongs to the project or note the gap for `/domain-modeling`.

## Flag ADR conflicts

If output contradicts an existing ADR, surface that conflict explicitly rather than silently overriding the decision.
