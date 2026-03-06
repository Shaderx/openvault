# Design: Refactor `src/utils.js` Into `src/utils/` Sub-Modules

## 1. Problem Statement

`src/utils.js` is a 300+ line monolith containing 8 unrelated concerns: logging, data access, data mutations, text processing, DOM helpers, settings checks, ST integration, and async primitives. It is the most-imported file in the codebase (~20 consumers). A `src/utils/` directory already exists with 3 well-scoped modules (stemmer, stopwords, russian-imperatives), making the coexistence of `utils.js` and `utils/` confusing.

Additionally, `isAutomaticMode()` and `isExtensionEnabled()` are identical implementations — a DRY violation.

## 2. Goals & Non-Goals

**Must do:**
- Split `src/utils.js` into 5 cohesive modules inside `src/utils/`.
- Delete `src/utils.js` entirely (no barrel re-export).
- Update all ~20 consumer imports to point directly to sub-modules.
- Collapse `isAutomaticMode` into `isExtensionEnabled`.
- Split `tests/utils.test.js` into matching test files.
- Update `src/utils/CLAUDE.md` to document the new module layout.

**Won't do:**
- Change any function signatures or behavior.
- Rename functions beyond the `isAutomaticMode` → `isExtensionEnabled` collapse.
- Move the existing `src/utils/` modules (stemmer, stopwords, russian-imperatives) — they stay as-is.

## 3. Proposed Module Layout

### 3.1 `src/utils/logging.js`
| Export | Dependencies |
|---|---|
| `log(message)` | `getDeps`, `extensionName` |
| `logRequest(label, data)` | `getDeps`, `extensionName` |

### 3.2 `src/utils/data.js`
| Export | Dependencies |
|---|---|
| `getOpenVaultData()` | `getDeps`, constants |
| `getCurrentChatId()` | `getDeps` |
| `saveOpenVaultData(expectedChatId?)` | `getDeps`, `log` (from logging.js), `showToast` (from dom.js) |
| `generateId()` | `getDeps` |
| `updateMemory(id, updates)` | `getOpenVaultData`, `getDeps`, `log`, `showToast` |
| `deleteMemory(id)` | `getOpenVaultData`, `getDeps`, `log` |
| `deleteCurrentChatData()` | `getDeps`, `log` |
| `deleteCurrentChatEmbeddings()` | `getOpenVaultData`, `getDeps`, `log` |

Internal dependency: `data.js` imports from `logging.js` and `dom.js`. No circular deps.

### 3.3 `src/utils/text.js`
| Export | Dependencies |
|---|---|
| `estimateTokens(text)` | none |
| `sliceToTokenBudget(memories, tokenBudget)` | `estimateTokens` (internal) |
| `stripThinkingTags(text)` | none |
| `safeParseJSON(input)` | `stripThinkingTags` (internal), `extractBalancedJSON` (private), `getDeps`, `jsonrepair` |
| `sortMemoriesBySequence(memories, ascending?)` | none |

`extractBalancedJSON` remains a private (non-exported) function.

### 3.4 `src/utils/dom.js`
| Export | Dependencies |
|---|---|
| `escapeHtml(str)` | none |
| `showToast(type, message, title?, options?)` | `getDeps` |

### 3.5 `src/utils/st-helpers.js`
| Export | Dependencies |
|---|---|
| `safeSetExtensionPrompt(content, name?)` | `getDeps`, `extensionName` |
| `isExtensionEnabled()` | `getDeps`, `extensionName` |
| `withTimeout(promise, ms, operation?)` | none |
| `yieldToMain()` | none |

**Deleted:** `isAutomaticMode()` — identical to `isExtensionEnabled()`.

## 4. DRY Fix: `isAutomaticMode` Collapse

Current state — both functions are identical:
```js
// isExtensionEnabled
getDeps().getExtensionSettings()[extensionName]?.enabled === true;
// isAutomaticMode — comment says "automatic mode is now implicit"
getDeps().getExtensionSettings()[extensionName]?.enabled === true;
```

**Action:** Delete `isAutomaticMode`. Update its 2 callers:
- `src/events.js` — `isAutomaticMode` → `isExtensionEnabled`
- `src/retrieval/retrieve.js` — `isAutomaticMode` → `isExtensionEnabled`

## 5. Consumer Import Rewiring

Each consumer's `from '../utils.js'` / `from './utils.js'` becomes direct imports from sub-modules.

| File | Old Import | New Source(s) |
|---|---|---|
| `src/pov.js` | `getOpenVaultData, log` | `data.js`, `logging.js` |
| `src/llm.js` | `log, logRequest, showToast, withTimeout` | `logging.js`, `dom.js`, `st-helpers.js` |
| `src/embeddings.js` | `log` | `logging.js` |
| `src/prompts.js` | `sortMemoriesBySequence` | `text.js` |
| `src/events.js` | `getOpenVaultData, isAutomaticMode, log, safeSetExtensionPrompt, showToast, withTimeout` | `data.js`, `st-helpers.js`, `logging.js`, `dom.js` (rename `isAutomaticMode` → `isExtensionEnabled`) |
| `src/graph/graph.js` | `log` | `logging.js` |
| `src/graph/communities.js` | `log, yieldToMain` | `logging.js`, `st-helpers.js` |
| `src/extraction/worker.js` | `getCurrentChatId, getOpenVaultData, isExtensionEnabled, log` | `data.js`, `st-helpers.js`, `logging.js` |
| `src/extraction/extract.js` | `estimateTokens, getCurrentChatId, getOpenVaultData, isExtensionEnabled, log, safeSetExtensionPrompt, saveOpenVaultData, showToast, sliceToTokenBudget, sortMemoriesBySequence, yieldToMain` | `text.js`, `data.js`, `st-helpers.js`, `logging.js`, `dom.js` |
| `src/extraction/structured.js` | `stripThinkingTags` | `text.js` |
| `src/extraction/scheduler.js` | `estimateTokens` | `text.js` |
| `src/reflection/reflect.js` | `generateId, log, sortMemoriesBySequence` | `data.js`, `logging.js`, `text.js` |
| `src/retrieval/formatting.js` | `estimateTokens` | `text.js` |
| `src/retrieval/retrieve.js` | `getOpenVaultData, isAutomaticMode, isExtensionEnabled, log, safeSetExtensionPrompt` | `data.js`, `st-helpers.js`, `logging.js` (rename `isAutomaticMode` → `isExtensionEnabled`) |
| `src/retrieval/scoring.js` | `log, sliceToTokenBudget` | `logging.js`, `text.js` |
| `src/retrieval/world-context.js` | `estimateTokens` | `text.js` |
| `src/ui/templates.js` | `escapeHtml` | `dom.js` |
| `src/ui/status.js` | `getOpenVaultData, log` | `data.js`, `logging.js` |
| `src/ui/export-debug.js` | `getOpenVaultData, showToast` | `data.js`, `dom.js` |
| `src/ui/settings.js` | `deleteCurrentChatData, deleteCurrentChatEmbeddings, getOpenVaultData, showToast` | `data.js`, `dom.js` |
| `src/ui/render.js` | `deleteMemory, escapeHtml, getOpenVaultData, showToast, updateMemory` | `data.js`, `dom.js` |

## 6. Test File Split

`tests/utils.test.js` → split into files matching the module structure:

| New Test File | Describe Blocks Moved |
|---|---|
| `tests/utils/logging.test.js` | `log` |
| `tests/utils/data.test.js` | `getOpenVaultData`, `getCurrentChatId`, `saveOpenVaultData`, `generateId` |
| `tests/utils/text.test.js` | `safeParseJSON`, `stripThinkingTags`, `sortMemoriesBySequence`, `safeParseJSON with thinking tags`, `safeParseJSON with conversational filler` |
| `tests/utils/dom.test.js` | `escapeHtml`, `showToast` |
| `tests/utils/st-helpers.test.js` | `withTimeout`, `safeSetExtensionPrompt`, `isExtensionEnabled`, `yieldToMain` |

**Removed from test file:**
- `isAutomaticMode` tests (function deleted; behavior covered by `isExtensionEnabled` tests).
- `getExtractedMessageIds` / `getUnextractedMessageIds` tests — these test `src/extraction/scheduler.js`, not utils. They belong in a scheduler test file (out of scope for this refactor, but noted).

## 7. Risks & Edge Cases

- **Circular imports:** `data.js` imports `log` from `logging.js` and `showToast` from `dom.js`. Both `logging.js` and `dom.js` are leaf modules (no imports from sibling utils). No cycles.
- **Path depth change:** Files in `src/` go from `./utils.js` to `./utils/logging.js` (one level deeper). Files in `src/sub/` go from `../utils.js` to `../utils/logging.js` (same depth). No breakage risk.
- **`jsonrepair` import:** Stays in `text.js` — the only module needing it.
- **`safeParseJSON` uses `getDeps().console`:** `text.js` gets a `getDeps` import, which is consistent with how other modules work.
