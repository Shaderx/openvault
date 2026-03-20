TL;DR: Use ST's `safeSetExtensionPrompt` with its built-in `injection_position` constants (0–4) for predefined positions, and register `{{openvault_memory}}` / `{{openvault_world}}` macros for the Custom path. Approach A is correct but needs a nuance — ST's extension prompt system uses different position constants than World Info.

***

## Position Constants to Use

ST's `safeSetExtensionPrompt` accepts a numeric `injection_position` argument. The relevant enum values (from `extension_prompt_types` in ST core) are:

| UI Label | Constant | Meaning |
|---|---|---|
| ↑Char (Before main) | `0` | Before system/char card prompt |
| ↓Char (After main) | `1` | After main prompt |
| ↑AN | `2` | Top of Author's Note block |
| ↓AN | `3` | Bottom of Author's Note block |
| In-chat (depth) | `4` | In-chat at specified depth |

↑EM / ↓EM map to World Info positions `5`/`6` (top/bottom of example messages), which are **World Info–only** — `safeSetExtensionPrompt` does not support them natively. Outlet is also WI-only: it places content at a `{{outlet::name}}` macro in the character card. For those two, you'd need Approach B (World Info entries) or just exclude them from the extension prompt path.

***

## Implementation Plan (Approach A + partial B)

**Settings schema** — add to `extension_settings.openvault`:

```js
{
  memory: { position: 1, depth: 4 },  // default: after main
  world:  { position: 1, depth: 4 },
  // "custom" = position: -1 → macro-only, no safeSetExtensionPrompt call
}
```

**Injection call** — replace the static `safeSetExtensionPrompt('openvault_memory', content)` with:

```js
const pos = settings.memory.position;
if (pos === -1) return; // custom macro handles it
safeSetExtensionPrompt(
  'openvault_memory',
  content,
  pos,              // injection_position enum
  settings.memory.depth  // only used when pos === 4
);
```

**Custom macro registration** — register on `app_ready`:

```js
SillyTavern.getContext().registerMacro(
  'openvault_memory',
  () => lastRetrievedMemory ?? ''
);
SillyTavern.getContext().registerMacro(
  'openvault_world',
  () => lastRetrievedWorld ?? ''
);
```

Cache the last retrieved strings in module-level vars, updated in `retrieveAndInjectContext()` before the `safeSetExtensionPrompt` call.

***

## UI Placement

**Settings panel** — two `<select>` dropdowns (one per injection type): `↑Char | ↓Char | ↑AN | ↓AN | In-chat | Custom`. Show a depth `<input>` that appears only when "In-chat" is selected. Below each dropdown, show a read-only pill when "Custom" is selected:

```html
<span class="ov-macro-pill" title="Click to copy">{{openvault_memory}}</span>
```

**Display panel** — in the active display widget, show a small badge per injection showing current position or "📋 Macro" with the macro name for easy copy-paste.

***

## Outlet & EM Positions

These require creating hidden World Info entries (Approach B fragment) with `position: 5/6` or the outlet `automationId` field . If you want to support them, add a `useWorldInfo: true` flag in settings and create/update a hidden WI entry on retrieval instead of calling `safeSetExtensionPrompt`. Recommend deferring this to v2 — the five extension-prompt positions cover 95% of use cases.