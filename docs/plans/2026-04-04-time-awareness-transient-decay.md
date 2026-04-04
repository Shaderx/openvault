# Time Awareness and Transient Memory Decay Implementation Plan

**Goal:** Add temporal context extraction and transient memory decay to OpenVault memories.
**Architecture:** Schema extensions to EventSchema/MemorySchema with opportunistic time extraction; decay math multiplies lambda for transient memories; formatting prepends time tags to summaries.
**Tech Stack:** JavaScript (ESM), Zod schemas, Vitest for testing.

---

## File Structure Overview

**Create:** None (all modifications to existing files)

**Modify:**
- `src/constants.js` - Add `transientDecayMultiplier` default setting
- `src/store/schemas.js` - Add `temporal_anchor` and `is_transient` to EventSchema, MemorySchema, MemoryUpdateSchema, ScoringConfigSchema
- `src/store/chat-data.js` - Add new fields to `allowedFields` in `updateMemory()`
- `src/prompts/events/rules.js` - Add field instructions for temporal extraction
- `src/prompts/events/en.js` - Update all examples with new fields
- `src/prompts/events/ru.js` - Update all examples with new fields
- `src/retrieval/retrieve.js` - Pass `transientDecayMultiplier` in scoringConfig
- `src/retrieval/math.js` - Apply multiplier in `calculateScore()` for transient memories
- `src/retrieval/formatting.js` - Prepend `temporal_anchor` in `formatMemory()`
- `templates/settings_panel.html` - Add informational hint about time awareness
- `src/types.d.ts` - Regenerate after schema changes

---

### Task 1: Add Default Setting for Transient Decay Multiplier

**Files:**
- Modify: `src/constants.js`
- Test: `tests/constants.test.js` (if exists, otherwise verify via schema tests)

**Purpose:** Add the `transientDecayMultiplier` constant to default settings for configurable transient memory decay acceleration.

**Common Pitfalls:**
- Ensure the constant is added to `defaultSettings` object, not exported separately
- Maintain alphabetical order if the file has organized keys

- [ ] Step 1: Write the failing test

```javascript
// tests/constants.test.js - add new test
import { describe, it, expect } from 'vitest';
import { defaultSettings } from '../src/constants.js';

describe('defaultSettings', () => {
  it('should have transientDecayMultiplier defined', () => {
    expect(defaultSettings.transientDecayMultiplier).toBeDefined();
    expect(defaultSettings.transientDecayMultiplier).toBe(5.0);
  });
});
```

- [ ] Step 2: Run test to verify it fails

Run: `npm test -- tests/constants.test.js -v`
Expected: FAIL with "expected undefined to be defined" or similar

- [ ] Step 3: Write minimal implementation

```javascript
// In src/constants.js, add to defaultSettings object:
export const defaultSettings = {
  // ... existing settings ...
  transientDecayMultiplier: 5.0,  // Multiplier for short-term memory decay
  // ... rest of settings ...
};
```

- [ ] Step 4: Run test to verify it passes

Run: `npm test -- tests/constants.test.js -v`
Expected: PASS

- [ ] Step 5: Commit

```bash
git add -A && git commit -m "feat(constants): add transientDecayMultiplier default setting"
```

---

### Task 2: Extend Zod Schemas with Temporal Fields

**Files:**
- Modify: `src/store/schemas.js`
- Test: `tests/store/schemas.test.js`

**Purpose:** Add `temporal_anchor` and `is_transient` fields to EventSchema, MemorySchema, MemoryUpdateSchema, and ScoringConfigSchema for extraction, storage, updates, and configuration.

**Common Pitfalls:**
- Use `z.string().nullable().optional().default(null)` chain for temporal_anchor to handle LLM inconsistency
- Add fields to ScoringConfigSchema for injection into scoring functions

- [ ] Step 1: Write the failing test

```javascript
// tests/store/schemas.test.js - add new test cases
import { describe, it, expect } from 'vitest';
import { EventSchema, MemorySchema, MemoryUpdateSchema, ScoringConfigSchema } from '../src/store/schemas.js';

describe('EventSchema', () => {
  it('should validate events with temporal_anchor and is_transient', () => {
    const validEvent = {
      summary: 'Test event',
      importance: 3,
      temporal_anchor: 'Friday, June 14, 3:40 PM',
      is_transient: true,
      characters_involved: [],
      entities: [],
      relationships: [],
      commitments: []
    };
    const result = EventSchema.safeParse(validEvent);
    expect(result.success).toBe(true);
    expect(result.data.temporal_anchor).toBe('Friday, June 14, 3:40 PM');
    expect(result.data.is_transient).toBe(true);
  });

  it('should default temporal_anchor to null when omitted', () => {
    const eventWithoutTime = {
      summary: 'Test event',
      importance: 3,
      characters_involved: [],
      entities: [],
      relationships: [],
      commitments: []
    };
    const result = EventSchema.safeParse(eventWithoutTime);
    expect(result.success).toBe(true);
    expect(result.data.temporal_anchor).toBeNull();
  });

  it('should default is_transient to false when omitted', () => {
    const eventWithoutTransient = {
      summary: 'Test event',
      importance: 3,
      characters_involved: [],
      entities: [],
      relationships: [],
      commitments: []
    };
    const result = EventSchema.safeParse(eventWithoutTransient);
    expect(result.success).toBe(true);
    expect(result.data.is_transient).toBe(false);
  });
});

describe('MemoryUpdateSchema', () => {
  it('should allow updating temporal_anchor and is_transient', () => {
    const validUpdate = {
      temporal_anchor: 'Saturday, June 15, 9:00 AM',
      is_transient: false
    };
    const result = MemoryUpdateSchema.safeParse(validUpdate);
    expect(result.success).toBe(true);
  });
});

describe('ScoringConfigSchema', () => {
  it('should include transientDecayMultiplier', () => {
    const validConfig = {
      baseLambda: 0.05,
      transientDecayMultiplier: 5.0
    };
    const result = ScoringConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
    expect(result.data.transientDecayMultiplier).toBe(5.0);
  });
});
```

- [ ] Step 2: Run test to verify it fails

Run: `npm test -- tests/store/schemas.test.js -v`
Expected: FAIL with schema validation errors or "transoral_anchor is not defined"

- [ ] Step 3: Write minimal implementation

```javascript
// In src/store/schemas.js, modify schemas:

// 1. Add to EventSchema (around where other event fields are defined)
export const EventSchema = z.object({
  // ... existing fields ...
  temporal_anchor: z.string().nullable().optional().default(null),
  is_transient: z.boolean().optional().default(false),
  // ... rest of fields ...
});

// 2. MemorySchema already extends EventSchema, so it inherits the fields
// No changes needed if MemorySchema uses EventSchema.merge()

// 3. Add to MemoryUpdateSchema
export const MemoryUpdateSchema = z.object({
  // ... existing fields ...
  temporal_anchor: z.string().nullable().optional(),
  is_transient: z.boolean().optional(),
});

// 4. Add to ScoringConfigSchema
export const ScoringConfigSchema = z.object({
  baseLambda: z.number().positive(),
  transientDecayMultiplier: z.number().positive().optional().default(5.0),
  // ... other scoring config fields ...
});
```

- [ ] Step 4: Run test to verify it passes

Run: `npm test -- tests/store/schemas.test.js -v`
Expected: PASS

- [ ] Step 5: Commit

```bash
git add -A && git commit -m "feat(schemas): add temporal_anchor and is_transient to EventSchema, MemorySchema, MemoryUpdateSchema, ScoringConfigSchema"
```

---

### Task 3: Allow Memory Updates for New Fields

**Files:**
- Modify: `src/store/chat-data.js`
- Test: `tests/store/chat-data.test.js`

**Purpose:** Enable users to manually update `temporal_anchor` and `is_transient` fields via the memory update API.

**Common Pitfalls:**
- Add fields to the `allowedFields` array in `updateMemory()` function
- Ensure the fields are included in the whitelist, not just passed through

- [ ] Step 1: Write the failing test

```javascript
// tests/store/chat-data.test.js - add new test
import { describe, it, expect } from 'vitest';
import { updateMemory } from '../src/store/chat-data.js';

describe('updateMemory', () => {
  it('should allow updating temporal_anchor field', () => {
    // Setup test memory
    const mockContext = {
      chatMetadata: {
        openvault: {
          memories: [
            { id: 'test-1', summary: 'Test', temporal_anchor: null, is_transient: false }
          ]
        }
      }
    };

    const result = updateMemory(mockContext, 'test-1', { temporal_anchor: 'Monday, Jan 1, 12:00 PM' });
    expect(result.temporal_anchor).toBe('Monday, Jan 1, 12:00 PM');
  });

  it('should allow updating is_transient field', () => {
    const mockContext = {
      chatMetadata: {
        openvault: {
          memories: [
            { id: 'test-1', summary: 'Test', temporal_anchor: null, is_transient: false }
          ]
        }
      }
    };

    const result = updateMemory(mockContext, 'test-1', { is_transient: true });
    expect(result.is_transient).toBe(true);
  });
});
```

- [ ] Step 2: Run test to verify it fails

Run: `npm test -- tests/store/chat-data.test.js::updateMemory -v`
Expected: FAIL with "Field temporal_anchor not allowed" or similar

- [ ] Step 3: Write minimal implementation

```javascript
// In src/store/chat-data.js, find updateMemory function and modify allowedFields:
export function updateMemory(context, memoryId, updates) {
  const allowedFields = [
    'summary',
    'importance',
    'is_secret',
    // ... existing fields ...
    'temporal_anchor',  // <-- ADD
    'is_transient',     // <-- ADD
  ];
  // ... rest of function ...
}
```

- [ ] Step 4: Run test to verify it passes

Run: `npm test -- tests/store/chat-data.test.js::updateMemory -v`
Expected: PASS

- [ ] Step 5: Commit

```bash
git add -A && git commit -m "feat(store): allow temporal_anchor and is_transient in memory updates"
```

---

### Task 4: Update Extraction Rules with Temporal Instructions

**Files:**
- Modify: `src/prompts/events/rules.js`
- Test: Manual verification (prompts are string templates)

**Purpose:** Add extraction instructions for `temporal_anchor` and `is_transient` fields to guide the LLM in identifying time data and transient states.

**Common Pitfalls:**
- Follow existing XML formatting conventions in the rules file
- Place instructions in the `<field_instructions>` section

- [ ] Step 1: Verify the current rules structure

Read the file to understand the existing `<field_instructions>` format:
```bash
head -50 src/prompts/events/rules.js
```

- [ ] Step 2: Write the implementation

```javascript
// In src/prompts/events/rules.js, add to <field_instructions> section:
// (Add after existing field instructions, before closing </field_instructions>)

temporal_anchor: Look for timestamp headers in messages (e.g., time/date markers). Extract ONLY the concise date and time as written by the user (e.g., "Friday, June 14, 3:40 PM" or "Wednesday, 30 October 2024. 4:43 PM"). Strip decorative elements like emojis, locations, and weather if present, but preserve the verbatim date/time format chosen by the user. If no time is stated, return null.

is_transient: Set to true ONLY for short-term intentions, temporary states, or immediate plans (e.g., "going to wash up", "waiting for 10 minutes", "be right back", "let's meet at 7 PM"). Set to false for permanent facts, completed actions, or durable relationship changes (e.g., "revealed a secret", "professed love", "moved to a new city").
```

- [ ] Step 3: Verify the rules file is syntactically valid

Run: `node --check src/prompts/events/rules.js`
Expected: No output (success) or syntax error if there's an issue

- [ ] Step 4: Commit

```bash
git add -A && git commit -m "feat(prompts): add temporal_anchor and is_transient extraction rules"
```

---

### Task 5: Update English Few-Shot Examples

**Files:**
- Modify: `src/prompts/events/en.js`
- Test: Manual verification (prompts are string templates)

**Purpose:** Update all few-shot examples in the English prompts to include `temporal_anchor` and `is_transient` fields so the LLM learns the new schema through demonstration.

**Common Pitfalls:**
- Update ALL examples in the file, not just a few
- Ensure valid JSON in the output strings
- Follow the same format: temporal_anchor after importance, is_transient after temporal_anchor

- [ ] Step 1: Count the number of examples to update

Run: `grep -c 'output:' src/prompts/events/en.js`
Note the count for verification after editing.

- [ ] Step 2: Update each example

For each example in `src/prompts/events/en.js`, add to the `output:` JSON:

```javascript
// Before:
output: `{
  "summary": "Character A suggested meeting at the library",
  "importance": 3,
  "characters_involved": [...],
  ...
}`

// After:
output: `{
  "summary": "Character A suggested meeting at the library",
  "importance": 3,
  "temporal_anchor": "Friday, June 14, 3:40 PM",
  "is_transient": true,
  "characters_involved": [...],
  ...
}`
```

For examples without explicit time context, use `null` for temporal_anchor and appropriate boolean for is_transient:

```javascript
output: `{
  "summary": "Character A revealed a long-held secret",
  "importance": 5,
  "temporal_anchor": null,
  "is_transient": false,
  "characters_involved": [...],
  ...
}`
```

- [ ] Step 3: Verify JSON validity in all examples

Run a quick syntax check:
```bash
node -e "import('./src/prompts/events/en.js').then(m => console.log('OK')).catch(e => console.error(e.message))"
```
Expected: "OK"

- [ ] Step 4: Commit

```bash
git add -A && git commit -m "feat(prompts): update English examples with temporal_anchor and is_transient fields"
```

---

### Task 6: Update Russian Few-Shot Examples

**Files:**
- Modify: `src/prompts/events/ru.js`
- Test: Manual verification (prompts are string templates)

**Purpose:** Update all few-shot examples in the Russian prompts to include `temporal_anchor` and `is_transient` fields.

**Common Pitfalls:**
- Same as Task 5 - update ALL examples
- Use Russian time formats in temporal_anchor for Russian examples (e.g., "пятница, 14 июня, 15:40")

- [ ] Step 1: Count the number of examples

Run: `grep -c 'output:' src/prompts/events/ru.js`

- [ ] Step 2: Update each example

Same pattern as Task 5, using Russian date/time formats where appropriate:

```javascript
output: `{
  "summary": "Персонаж А предложил встретиться в библиотеке",
  "importance": 3,
  "temporal_anchor": "пятница, 14 июня, 15:40",
  "is_transient": true,
  ...
}`
```

For non-time examples:
```javascript
output: `{
  "summary": "Персонаж А раскрыл давно хранимый секрет",
  "importance": 5,
  "temporal_anchor": null,
  "is_transient": false,
  ...
}`
```

- [ ] Step 3: Verify JSON validity

Run:
```bash
node -e "import('./src/prompts/events/ru.js').then(m => console.log('OK')).catch(e => console.error(e.message))"
```
Expected: "OK"

- [ ] Step 4: Commit

```bash
git add -A && git commit -m "feat(prompts): update Russian examples with temporal_anchor and is_transient fields"
```

---

### Task 7: Pass Transient Decay Multiplier to Scoring Config

**Files:**
- Modify: `src/retrieval/retrieve.js`
- Test: `tests/retrieval/retrieve.test.js`

**Purpose:** Wire the `transientDecayMultiplier` setting from constants/settings into the scoring configuration passed to scoring functions.

**Common Pitfalls:**
- Use `getSettings()` from `src/settings.js` to access settings, never direct access
- Ensure the multiplier is passed in the scoringConfig object

- [ ] Step 1: Write the failing test

```javascript
// tests/retrieval/retrieve.test.js - add test
import { describe, it, expect, vi } from 'vitest';
import { buildRetrievalContext } from '../src/retrieval/retrieve.js';

describe('buildRetrievalContext', () => {
  it('should include transientDecayMultiplier in scoringConfig', () => {
    const mockSettings = {
      baseLambda: 0.05,
      transientDecayMultiplier: 5.0,
      // ... other settings
    };

    const context = buildRetrievalContext(mockSettings);
    expect(context.scoringConfig.transientDecayMultiplier).toBe(5.0);
  });
});
```

- [ ] Step 2: Run test to verify it fails

Run: `npm test -- tests/retrieval/retrieve.test.js::buildRetrievalContext -v`
Expected: FAIL - transientDecayMultiplier not in scoringConfig

- [ ] Step 3: Write minimal implementation

```javascript
// In src/retrieval/retrieve.js, find buildRetrievalContext or similar function:
export function buildRetrievalContext(settings) {
  // ... existing code ...
  const scoringConfig = {
    baseLambda: settings.baseLambda || DEFAULT_BASE_LAMBDA,
    transientDecayMultiplier: settings.transientDecayMultiplier || 5.0,  // <-- ADD
    // ... other config ...
  };
  // ... rest of function ...
}
```

- [ ] Step 4: Run test to verify it passes

Run: `npm test -- tests/retrieval/retrieve.test.js::buildRetrievalContext -v`
Expected: PASS

- [ ] Step 5: Commit

```bash
git add -A && git commit -m "feat(retrieval): pass transientDecayMultiplier in scoring config"
```

---

### Task 8: Apply Transient Multiplier in Decay Math

**Files:**
- Modify: `src/retrieval/math.js`
- Test: `tests/retrieval/math.test.js`

**Purpose:** Modify the `calculateScore` function to apply the transient decay multiplier when `memory.is_transient` is true.

**Common Pitfalls:**
- Apply the multiplier to lambda AFTER hit damping calculation, not before
- Ensure the multiplier defaults to 5.0 if not provided in config
- The formula: `lambda *= multiplier` (multiply the decay rate)

- [ ] Step 1: Write the failing test

```javascript
// tests/retrieval/math.test.js - add tests
import { describe, it, expect } from 'vitest';
import { calculateScore } from '../src/retrieval/math.js';

describe('calculateScore', () => {
  it('should apply transient multiplier for transient memories', () => {
    const memory = {
      importance: 3,
      is_transient: true,
      retrieval_hits: 0
    };
    const config = {
      baseLambda: 0.05,
      transientDecayMultiplier: 5.0
    };

    const transientScore = calculateScore(memory, 50, config);

    // Same memory without is_transient should have higher score
    const normalMemory = { ...memory, is_transient: false };
    const normalScore = calculateScore(normalMemory, 50, config);

    expect(transientScore).toBeLessThan(normalScore);
  });

  it('should not apply multiplier for non-transient memories', () => {
    const memory = {
      importance: 3,
      is_transient: false,
      retrieval_hits: 0
    };
    const config = {
      baseLambda: 0.05,
      transientDecayMultiplier: 5.0
    };

    const score = calculateScore(memory, 50, config);
    // Score should be standard calculation without multiplier
    const expectedLambda = 0.05 / (3 * 3);  // baseLambda / importance^2
    const expectedScore = 3 * Math.exp(-expectedLambda * 50);

    expect(score).toBeCloseTo(expectedScore, 5);
  });

  it.each([
    { distance: 30, expectedNormal: 2.5, expectedTransient: 1.3 },
    { distance: 50, expectedNormal: 2.3, expectedTransient: 0.74 },
    { distance: 70, expectedNormal: 2.1, expectedTransient: 0.42 },
  ])('should correctly decay transient memories at distance $distance', ({ distance }) => {
    const config = {
      baseLambda: 0.05,
      transientDecayMultiplier: 5.0
    };

    const normalMemory = { importance: 3, is_transient: false, retrieval_hits: 0 };
    const transientMemory = { importance: 3, is_transient: true, retrieval_hits: 0 };

    const normalScore = calculateScore(normalMemory, distance, config);
    const transientScore = calculateScore(transientMemory, distance, config);

    expect(transientScore).toBeLessThan(normalScore);
    expect(transientScore).toBeGreaterThan(0);
  });
});
```

- [ ] Step 2: Run test to verify it fails

Run: `npm test -- tests/retrieval/math.test.js::calculateScore -v`
Expected: FAIL - transient memories not scoring differently from normal memories

- [ ] Step 3: Write minimal implementation

```javascript
// In src/retrieval/math.js, modify calculateScore function:
export function calculateScore(memory, distance, config) {
  const importance = memory.importance || 3;
  const baseLambda = config.baseLambda || 0.05;

  // Calculate hit damping (higher hits = slower decay)
  const hits = memory.retrieval_hits || 0;
  const hitDamping = Math.max(0.5, 1 / (1 + hits * 0.1));

  // Base lambda calculation
  let lambda = (baseLambda / (importance * importance)) * hitDamping;

  // Apply transient multiplier for short-term memories
  if (memory.is_transient) {
    const multiplier = config.transientDecayMultiplier || 5.0;
    lambda *= multiplier;
  }

  // Calculate final score: importance × e^(-λ × distance)
  return importance * Math.exp(-lambda * distance);
}
```

- [ ] Step 4: Run test to verify it passes

Run: `npm test -- tests/retrieval/math.test.js::calculateScore -v`
Expected: PASS

- [ ] Step 5: Commit

```bash
git add -A && git commit -m "feat(retrieval): apply transient decay multiplier in calculateScore"
```

---

### Task 9: Add Temporal Prefix to Memory Formatting

**Files:**
- Modify: `src/retrieval/formatting.js`
- Test: `tests/retrieval/formatting.test.js`

**Purpose:** Modify the `formatMemory` helper to prepend the temporal anchor (when present) to memory summaries.

**Common Pitfalls:**
- Only prepend if `temporal_anchor` is truthy (not null, not empty string)
- Follow existing format: `[${stars}] ${timePrefix}${prefix}${summary}`
- Maintain consistency with existing `[Known]` and star rating format

- [ ] Step 1: Write the failing test

```javascript
// tests/retrieval/formatting.test.js - add tests
import { describe, it, expect } from 'vitest';
import { formatMemory } from '../src/retrieval/formatting.js';

describe('formatMemory', () => {
  it('should prepend temporal anchor when present', () => {
    const memory = {
      summary: 'Character A suggested meeting at the library',
      importance: 3,
      temporal_anchor: 'Friday, June 14, 3:40 PM',
      is_secret: false
    };

    const formatted = formatMemory(memory);
    expect(formatted).toBe('[★★★] [Friday, June 14, 3:40 PM] Character A suggested meeting at the library');
  });

  it('should not add time prefix when temporal_anchor is null', () => {
    const memory = {
      summary: 'Character A suggested meeting at the library',
      importance: 3,
      temporal_anchor: null,
      is_secret: false
    };

    const formatted = formatMemory(memory);
    expect(formatted).toBe('[★★★] Character A suggested meeting at the library');
    expect(formatted).not.toContain('[null]');
  });

  it('should not add time prefix when temporal_anchor is undefined', () => {
    const memory = {
      summary: 'Character A suggested meeting at the library',
      importance: 3,
      is_secret: false
    };

    const formatted = formatMemory(memory);
    expect(formatted).toBe('[★★★] Character A suggested meeting at the library');
  });

  it('should combine temporal anchor with [Known] prefix', () => {
    const memory = {
      summary: 'Character A suggested meeting at the library',
      importance: 3,
      temporal_anchor: 'Friday, June 14, 3:40 PM',
      is_secret: false,
      witnesses: ['A', 'B', 'C']  // > 2 witnesses triggers [Known]
    };

    const formatted = formatMemory(memory);
    expect(formatted).toBe('[★★★] [Friday, June 14, 3:40 PM] [Known] Character A suggested meeting at the library');
  });
});
```

- [ ] Step 2: Run test to verify it fails

Run: `npm test -- tests/retrieval/formatting.test.js::formatMemory -v`
Expected: FAIL - temporal anchor not included in output

- [ ] Step 3: Write minimal implementation

```javascript
// In src/retrieval/formatting.js, modify formatMemory function:
export function formatMemory(memory) {
  const importance = memory.importance || 3;
  const stars = '★'.repeat(importance);

  // Determine [Known] prefix for non-secret memories with multiple witnesses
  const isKnown = !memory.is_secret && (memory.witnesses?.length || 0) > 2;
  const prefix = isKnown ? '[Known] ' : '';

  // NEW: Add temporal anchor if present
  const timePrefix = memory.temporal_anchor ? `[${memory.temporal_anchor}] ` : '';

  return `[${stars}] ${timePrefix}${prefix}${memory.summary}`;
}
```

- [ ] Step 4: Run test to verify it passes

Run: `npm test -- tests/retrieval/formatting.test.js::formatMemory -v`
Expected: PASS

- [ ] Step 5: Commit

```bash
git add -A && git commit -m "feat(retrieval): prepend temporal_anchor to formatted memory output"
```

---

### Task 10: Add UI Informational Hint

**Files:**
- Modify: `templates/settings_panel.html`
- Test: Manual verification (HTML template)

**Purpose:** Add an informational hint in the Extraction settings section educating users about the time awareness feature.

**Common Pitfalls:**
- Place the hint in the Extraction section, not a new section
- Keep it informational, not a toggle or checkbox
- Follow existing HTML structure and styling classes

- [ ] Step 1: Locate the Extraction section in settings panel

Run: `grep -n -A 5 -B 5 'Extraction' templates/settings_panel.html | head -50`
Identify the appropriate location for the hint.

- [ ] Step 2: Write the implementation

```html
<!-- In templates/settings_panel.html, add within the Extraction section -->
<!-- Place after existing extraction settings, before closing </div> -->

<div class="openvault-setting-hint">
    <strong>Time Awareness:</strong> Include timestamps in your messages (e.g., <code>[Friday, June 14, 3:40 PM]</code>) to enable temporal memory tracking. Short-term plans marked as transient will fade from context faster than permanent facts.
</div>
```

Adjust the HTML structure to match existing hint/info patterns in the file.

- [ ] Step 3: Verify HTML validity

Run: `node -e "require('fs').readFileSync('templates/settings_panel.html', 'utf8'); console.log('HTML file readable')"`
Expected: "HTML file readable"

- [ ] Step 4: Commit

```bash
git add -A && git commit -m "feat(ui): add time awareness informational hint to extraction settings"
```

---

### Task 11: Regenerate TypeScript Types

**Files:**
- Modify: `src/types.d.ts` (regenerated)
- Test: Verify file is updated

**Purpose:** Regenerate TypeScript declarations from the updated Zod schemas.

**Common Pitfalls:**
- Must run AFTER all schema changes are complete
- Ensure `npm run generate-types` script exists in package.json

- [ ] Step 1: Verify the generate-types script exists

Run: `grep 'generate-types' package.json`
Expected: Shows script definition

- [ ] Step 2: Run the type generation

Run: `npm run generate-types`
Expected: Success message, `src/types.d.ts` updated with new fields

- [ ] Step 3: Verify the new types are present

Run: `grep -c 'temporal_anchor' src/types.d.ts && grep -c 'is_transient' src/types.d.ts`
Expected: Non-zero counts for both fields

- [ ] Step 4: Commit

```bash
git add -A && git commit -m "chore(types): regenerate TypeScript declarations from updated schemas"
```

---

### Task 12: Run Full Test Suite

**Files:**
- All modified files

**Purpose:** Ensure all changes work together and no regressions were introduced.

- [ ] Step 1: Run the full test suite

Run: `npm test`
Expected: All tests pass

- [ ] Step 2: Run linting

Run: `npm run lint` or `npx biome check .`
Expected: No linting errors (Biome auto-formats on commit)

- [ ] Step 3: Verify no bare imports were introduced

Run: `grep -r "from 'zod'" src/ || echo "No bare zod imports found"`
Expected: No bare zod imports (should use CDN import pattern per CLAUDE.md)

- [ ] Step 4: Final commit if any fixes were needed

If any fixes were made:
```bash
git add -A && git commit -m "fix: address test suite and linting issues"
```

---

## Summary

This plan implements time awareness and transient memory decay across 12 tasks:

1. **Constants** - Add `transientDecayMultiplier` default (5.0)
2. **Schemas** - Extend EventSchema, MemorySchema, MemoryUpdateSchema, ScoringConfigSchema
3. **Store** - Allow updates to new fields via `updateMemory()`
4. **Rules** - Add extraction instructions for temporal fields
5. **EN Prompts** - Update English examples with new fields
6. **RU Prompts** - Update Russian examples with new fields
7. **Config** - Wire multiplier into scoring configuration
8. **Math** - Apply transient multiplier in decay calculation
9. **Formatting** - Prepend temporal anchor to memory output
10. **UI** - Add informational hint about time awareness
11. **Types** - Regenerate TypeScript declarations
12. **Verification** - Full test suite run

**Testing Strategy:**
- Unit tests for schema validation, score calculation, and memory formatting
- Manual verification for prompt templates and HTML
- Full test suite validation at the end

**Success Criteria:**
- All new tests pass
- Existing tests continue to pass
- Schema validation accepts temporal fields with proper defaults
- Transient memories decay ~5x faster than normal memories
- Temporal anchors appear in formatted memory output when present
