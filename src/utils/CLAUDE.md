# Utility Modules

Shared utilities used across extraction, retrieval, and graph subsystems.

## `stemmer.js` — Shared Stemming
**Functions**: `stemWord(word)`, `stemName(name)`
- **Language Detection**: Cyrillic → Russian stemmer, Latin → English, other → pass-through.
- **Cyrillic Over-Stem Guard**: Snowball multi-pass can over-strip (e.g., `елена` → `ел`). Guard limits stripping to max 3 chars; falls back to single-char removal.
- **`stemName()`**: Multi-word names → Set of stems, no stopword filtering (entity names are sacred).
- **Usage**: Graph-anchored entity detection in `query-context.js`, graph merge token overlap.

## `stopwords.js` — Unified Stopword Filtering
**Exports**: `ALL_STOPWORDS` (Set), `removeStopwords()` (from package)
- **Base**: EN + RU from `stopword` package.
- **GRAPH_CUSTOM**: Generic terms that shouldn't block entity merging ("the", "red", "large", "burgundy").
- **QUERY_STARTERS**: Sentence starters and discourse markers ("The", "Запомни", "Короче").
- **Usage**: Graph token overlap guard, query context filtering.

## `russian-imperatives.js` — Imperative Verb Detection
**Exports**: `isLikelyImperative(word)`, `RUSSIAN_IMPERATIVES` (Set)
- **Purpose**: Prevents capitalized imperative verbs from being extracted as entities in Cyrillic text.
- **Two-Layer**: Known imperatives set (O(1)) + suffix heuristic for unlisted verbs.
- **Suffixes**: `айте`, `яйте`, `ейте`, `ойте`, `ите`, `ись`, `ай`, `яй`, `ей`, `ой`.
- **Usage**: Query context entity filtering (via stopwords integration).

## GOTCHAS
- **No Stopwords in `stemName()`**: Entity names like "The Castle" should keep "castl" stem even though "the" is a stopword.
- **Over-Stem Guard Only for Cyrillic**: English stemming doesn't get the guard — Snowball is well-behaved for Latin.
