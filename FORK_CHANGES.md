# Fork Changes

Local modifications to OpenVault, tracked separately from upstream.

---

## 1. Move `openvault_entities` injection to same location as `scene_memory`

**File:** `src/retrieval/retrieve.js` — `injectContext()`

**Before:** Entity context (`openvault_entities`) was hardcoded to position `1, 0` (↓Main — after system prompt), placing it far from `scene_memory` in the prompt.

**After:** Entity context now uses the same `memoryPosition` / `memoryDepth` as `scene_memory` and is injected immediately before it, so `<entity_context>` appears right above `<scene_memory>` in the final prompt.

---

## 2. Fix memory/chat overlap by using MAX instead of MIN source-message check

**File:** `src/retrieval/retrieve.js` — `_getHiddenMemories()`

**Before:** Used `Math.min` to check the **oldest** source message in a memory's batch. If that oldest message was hidden (`is_system = true`), the memory was injected — even when newer source messages in the same batch were still visible in chat. This caused overlapping content between injected memories and visible chat messages.

**After:** Uses `Math.max` to check the **newest** source message. A memory is only injectable when all of its source messages are hidden. This eliminates overlap when a batch spans both hidden and visible messages, regardless of which extension performs the hiding (works with any `is_system`-based hide mechanism).
