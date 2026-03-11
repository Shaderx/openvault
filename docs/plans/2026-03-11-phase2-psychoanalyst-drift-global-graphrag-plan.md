# Implementation Plan - Phase 2: Psychoanalyst Drift & Global GraphRAG

> **Reference:** `docs/designs/2026-03-11-phase2-psychoanalyst-drift-global-graphrag-design.md`
> **Execution:** Use `executing-plans` skill.

---

## Overview

This plan implements two features:
1. **Subconscious Drives (Issue A):** XML isolation for reflections to prevent therapist-speak in RP
2. **Global GraphRAG (Issue B):** Background pre-computation + keyword intent routing for macro queries

**Key Principle:** No changes to extraction prompts. Reflection examples remain clinical. Only formatting changes.

---

## Phase 1: Subconscious Drives Formatting

### Task 1: Separate Reflections from Events in Formatting

**Goal:** Modify `formatContextForInjection()` to route reflections to `<subconscious_drives>` tag.

**Step 1: Write the Failing Test**
- File: `tests/retrieval/formatting.test.js`
- Code:
```javascript
import { formatContextForInjection } from '../../src/retrieval/formatting.js';

describe('formatContextForInjection - Subconscious Drives', () => {
    it('should separate reflections from events into different XML blocks', () => {
        const memories = [
            { id: 'ev_1', type: 'event', summary: 'Event 1', importance: 3, sequence: 1000 },
            { id: 'ev_2', type: 'event', summary: 'Event 2', importance: 3, sequence: 2000 },
            { id: 'ref_1', type: 'reflection', summary: 'Insight about character', importance: 4, sequence: 1500 },
        ];
        const presentCharacters = ['CharacterA'];
        const emotionalInfo = null;
        const characterName = 'CharacterA';
        const tokenBudget = 1000;
        const chatLength = 100;

        const result = formatContextForInjection(
            memories, presentCharacters, emotionalInfo, characterName, tokenBudget, chatLength
        );

        // Should contain scene_memory with events only
        expect(result).toContain('<scene_memory>');
        expect(result).toContain('Event 1');
        expect(result).toContain('Event 2');

        // Should contain subconscious_drives with reflections only
        expect(result).toContain('<subconscious_drives>');
        expect(result).toContain('Insight about character');

        // Reflections should NOT be in scene_memory
        const sceneMemoryMatch = result.match(/<scene_memory>([\s\S]*?)<\/scene_memory>/);
        const sceneMemoryContent = sceneMemoryMatch ? sceneMemoryMatch[1] : '';
        expect(sceneMemoryContent).not.toContain('Insight about character');
    });

    it('should omit subconscious_drives block when no reflections exist', () => {
        const memories = [
            { id: 'ev_1', type: 'event', summary: 'Event 1', importance: 3, sequence: 1000 },
        ];
        const result = formatContextForInjection(
            memories, [], null, 'Char', 1000, 100
        );

        expect(result).toContain('<scene_memory>');
        expect(result).not.toContain('<subconscious_drives>');
    });
});
```

**Step 2: Run Test (Red)**
- Command: `npm test tests/retrieval/formatting.test.js`
- Expect: FAIL (reflections still mixed into scene_memory)

**Step 3: Implementation (Green)**
- File: `src/retrieval/formatting.js`
- Action: Modify `formatContextForInjection()` to:
  1. Filter memories into `events` and `reflections` arrays by `type` field
  2. Pass only `events` to `assignMemoriesToBuckets()`
  3. After rendering `</scene_memory>`, if `reflections.length > 0`:
     - Append `<subconscious_drives>` block
     - Include CRITICAL RULE text
     - List reflections with `‡insight‡` tag

- Guidance:
```javascript
// At the start of formatContextForInjection, after parameter destructuring:
const events = memories.filter(m => m.type === 'event');
const reflections = memories.filter(m => m.type === 'reflection');

// Replace: const buckets = assignMemoriesToBuckets(memories, chatLength);
const buckets = assignMemoriesToBuckets(events, chatLength);

// After lines.push('</scene_memory>'):
if (reflections.length > 0) {
    lines.push('');
    lines.push('<subconscious_drives>');
    lines.push('[CRITICAL RULE: The following are hidden psychological truths. The character is NOT consciously aware of these dynamics and would NEVER speak them aloud. Use this ONLY as subtext to influence their subtle actions and emotional reactions.]');
    lines.push('');
    for (const ref of reflections) {
        const importance = ref.importance || 3;
        const stars = '\u2605'.repeat(importance);
        lines.push(`[${stars}] ${ref.summary}`);
    }
    lines.push('');
    lines.push('</subconscious_drives>');
}
```

**Step 4: Verify (Green)**
- Command: `npm test tests/retrieval/formatting.test.js`
- Expect: PASS

**Step 5: Git Commit**
- Command: `git add . && git commit -m "feat: separate reflections into <subconscious_drives> block"`

---

## Phase 2: Global Synthesis Schema & Prompt

### Task 2: Add Global Synthesis Schema

**Goal:** Add Zod schema for global world state output.

**Step 1: Write the Failing Test**
- File: `tests/extraction/structured.test.js`
- Code:
```javascript
import { parseGlobalSynthesisResponse, GlobalSynthesisSchema } from '../../src/extraction/structured.js';

describe('Global Synthesis Schema', () => {
    it('should validate correct global synthesis response', () => {
        const input = '{"global_summary": "The story has evolved from initial meeting to deep conflict..."}';
        const result = parseGlobalSynthesisResponse(input);
        expect(result).toEqual({ global_summary: "The story has evolved from initial meeting to deep conflict..." });
    });

    it('should enforce min length constraint', () => {
        const tooShort = { global_summary: "Too short" };
        const result1 = GlobalSynthesisSchema.safeParse(tooShort);
        expect(result1.success).toBe(false);

        // Valid length
        const valid = { global_summary: "A".repeat(100) };
        const result2 = GlobalSynthesisSchema.safeParse(valid);
        expect(result2.success).toBe(true);
    });
});
```

**Step 2: Run Test (Red)**
- Command: `npm test tests/extraction/structured.test.js`
- Expect: "ReferenceError: GlobalSynthesisSchema is not defined"

**Step 3: Implementation (Green)**
- File: `src/extraction/structured.js`
- Action: Add `GlobalSynthesisSchema` and `parseGlobalSynthesisResponse` function.

- Guidance: Add after `CommunitySummarySchema` (around line 280):
```javascript
/**
 * Schema for global world state synthesis
 * Map-reduce output over all community summaries
 */
export const GlobalSynthesisSchema = z.object({
    global_summary: z.string()
        .min(50, 'Global summary must be substantive')
        .describe('Overarching summary of current story state, focusing on macro-relationships and trajectory (max ~300 tokens)'),
});

/**
 * Get jsonSchema for global synthesis
 * @returns {Object} ConnectionManager jsonSchema object
 */
export function getGlobalSynthesisJsonSchema() {
    return toJsonSchema(GlobalSynthesisSchema, 'GlobalSynthesis');
}

/**
 * Parse global synthesis response
 * @param {string} content - Raw LLM response
 * @returns {Object} Validated global synthesis with global_summary
 */
export function parseGlobalSynthesisResponse(content) {
    return parseStructuredResponse(content, GlobalSynthesisSchema);
}
```

**Step 4: Verify (Green)**
- Command: `npm test tests/extraction/structured.test.js`
- Expect: PASS

**Step 5: Git Commit**
- Command: `git add . && git commit -m "feat: add GlobalSynthesisSchema and parser"`

---

### Task 3: Create Global Synthesis Few-Shot Examples

**Goal:** Create bilingual examples for map-reduce over community summaries.

**Step 1: Write the Failing Test**
- File: `tests/prompts/examples/global-synthesis.test.js`
- Code:
```javascript
import { GLOBAL_SYNTHESIS_EXAMPLES } from '../../../src/prompts/examples/global-synthesis.js';

describe('GLOBAL_SYNTHESIS_EXAMPLES', () => {
    it('should have at least 4 examples (2 EN + 2 RU)', () => {
        expect(GLOBAL_SYNTHESIS_EXAMPLES.length).toBeGreaterThanOrEqual(4);
    });

    it('should have bilingual examples', () => {
        const hasEn = GLOBAL_SYNTHESIS_EXAMPLES.some(e => e.label.includes('EN'));
        const hasRu = GLOBAL_SYNTHESIS_EXAMPLES.some(e => e.label.includes('RU'));
        expect(hasEn).toBe(true);
        expect(hasRu).toBe(true);
    });

    it('should have required input/output fields', () => {
        GLOBAL_SYNTHESIS_EXAMPLES.forEach(example => {
            expect(example.input).toBeDefined();
            expect(example.output).toBeDefined();
            expect(example.label).toBeDefined();
        });
    });
});
```

**Step 2: Run Test (Red)**
- Command: `npm test tests/prompts/examples/global-synthesis.test.js`
- Expect: "Cannot find module '../../../src/prompts/examples/global-synthesis.js'"

**Step 3: Implementation (Green)**
- File: `src/prompts/examples/global-synthesis.js`
- Action: Create new file with 4 bilingual examples (2 EN + 2 RU).

- Guidance:
```javascript
/**
 * Global synthesis few-shot examples.
 * 4 bilingual examples: 2 English + 2 Russian.
 * Demonstrates map-reduce over community summaries.
 */

export const GLOBAL_SYNTHESIS_EXAMPLES = [
    {
        label: 'Political intrigue (EN)',
        input: `Communities:
- Explorer Guild Flask Conflict: Kira has stolen two of Ashwood's preservation flasks and is secretly experimenting with a resurrection formula, deceiving Guild Master Aldric.
- Royal Court Politics: Queen Elena navigates treacherous court politics while hiding her alliance with the northern rebels.
- Merchant Trade Network: The eastern merchants have formed an embargo against the kingdom, threatening economic collapse.`,
        output: `{
  "global_summary": "The kingdom faces internal collapse on three fronts. Kira's theft of the resurrection flasks threatens the Explorer Guild's century-long mission and will likely trigger a leadership crisis when discovered. Queen Elena secretly supports northern rebels while maintaining court appearance, creating a powder keg if exposed. Simultaneously, the eastern merchant embargo has begun economic strangulation. These threads connect through the resurrection formula—Kira's goal likely involves reviving someone central to either the court intrigue or the rebellion, making her deception the linchpin holding the entire fragile state together."
}`,
    },
    {
        label: 'Social evolution (RU)',
        input: `Сообщества:
- Социальный круг Лены в общежитии: Лена переживает социальную изоляцию из-за сплетен соседок, единственная поддержка — Дима.
- Рабочая коллектива офиса: Дима работает в конкурентной среде, его успехи вызывают зависть коллег.
- Семья Лены: Родители Лены оказывают давление наchoice of partner, не одобряя Диму.`,
        output: `{
  "global_summary": "История разворачивается вокруг двух изолированных людей, находящих друг друга в враждебном окружении. Лена вытеснена в социальную изоляцию сплетнями соседок и давлением родителей, Дима — завистью коллег на работе. Их связь становится единственным якорем стабильности, что создаёт риск патологической созависимости. Внешнее давление (родители Лены, коллеги Дима, соседки) усиливается, превращая их отношения в осаждённую крепость. Конфликт приближается: либо внешние силы разрушат союз, либо пара изолируется от всех окружающих полностью."
}`,
    },
    {
        label: 'War narrative (EN)',
        input: `Communities:
- Mercenary Combat Party: Harlan, Lyra, and Thorne fight Shadowbeast Pack with defined roles but internal tension.
- Northern Rebellion: Rebels prepare to overthrow the monarchy, secretly allied with Queen Elena.
- Ancient Magic Order: Preserves knowledge of Ashwood's resurrection formula, seeking to prevent its misuse.`,
        output: `{
  "global_summary": "A kingdom on the brink of transformation through war and forbidden magic. The mercenary party serves as the ground-level lens, their survival against Shadowbeasts tied to the larger conflict. Above them, Queen Elena's secret alliance with rebels suggests the monarchy will fall from within, not from external attack. The Ancient Magic Order holds the true power—the resurrection formula—that both sides will likely seek. Harlan's mentorship of Lyra parallels the kingdom's generational transition, with both the party and the nation undergoing identity crises. The narrative trajectory points toward a revelation of the queen's betrayal, a scramble for the resurrection artifact, and the mercenaries caught in the center as survivors of a regime collapse."
}`,
    },
    {
        label: 'Romantic drama (RU)',
        input: `Сообщества:
- Романтический треугольник: Андрей колеблется между стабильными отношениями с Еленой и влечением к Марии.
- Семья Андрея: Родители оказывают pressure на settling down, не зная о конфликте.
- Друзья-общие знакомые: Компания вынуждена наблюдать напряжённость, стороны принимают позиции.`,
        output: `{
  "global_summary": "Классический предразводный сценарий с ускоряющимся коллапсом. Андрей находится в центре треугольника, его нерешительность — топливо для эскалации. Елена чувствует угрозу интуитивно и правота на её стороне усиливает напряжение. Мария ведёт себя провокационно, игнорируя границы. Семья и друзья превращаются в поле битвы: родители Андрея толкают к стабилизации (давление на Елену), общая компания раскалывается на лагеря. Траектория неизбежна: либо Андрей сделает выбор с максимальным ущербом для проигравшей стороны, либо ситуация взорвётся публичным разоблачением. Отсутствие honest conversation гарантирует, что разрешение будет травматическим для всех involved."
}`,
    },
];
```

**Step 4: Verify (Green)**
- Command: `npm test tests/prompts/examples/global-synthesis.test.js`
- Expect: PASS

**Step 5: Git Commit**
- Command: `git add . && git commit -m "feat: add global synthesis few-shot examples"`

---

### Task 4: Add Global Synthesis Prompt Builder

**Goal:** Create `buildGlobalSynthesisPrompt()` using `assembleSystemPrompt()`.

**Step 1: Write the Failing Test**
- File: `tests/prompts.test.js`
- Code:
```javascript
import { buildGlobalSynthesisPrompt } from '../../src/prompts/index.js';

describe('buildGlobalSynthesisPrompt', () => {
    it('should build prompt with system and user messages', () => {
        const communities = [
            { title: 'Community A', summary: 'Summary A', findings: ['f1'] },
            { title: 'Community B', summary: 'Summary B', findings: ['f2'] },
        ];
        const result = buildGlobalSynthesisPrompt(communities, 'auto', 'auto');

        expect(result).toHaveProperty('system');
        expect(result).toHaveProperty('user');
        expect(result.system).toContain('role');
        expect(result.user).toContain('Community A');
        expect(result.user).toContain('Community B');
    });

    it('should include language rules from assembleSystemPrompt', () => {
        const communities = [{ title: 'C1', summary: 'S1', findings: [] }];
        const result = buildGlobalSynthesisPrompt(communities, 'You are a narrative synthesist', 'auto');

        expect(result.system).toContain('<language_rules>');
    });
});
```

**Step 2: Run Test (Red)**
- Command: `npm test tests/prompts.test.js`
- Expect: "buildGlobalSynthesisPrompt is not a function"

**Step 3: Implementation (Green)**
- File: `src/prompts/index.js`
- Action: Add `buildGlobalSynthesisPrompt()` function and related constants.

- Guidance: Add before existing prompt builders (after line 140):

```javascript
// =============================================================================
// GLOBAL SYNTHESIS (New for Phase 2)
// =============================================================================

const GLOBAL_SYNTHESIS_SCHEMA = `You MUST respond with EXACTLY ONE JSON object. No other text, no markdown fences, no commentary.

The JSON object MUST have this EXACT structure:

{
  "global_summary": "A 300-token overarching summary of the current story state"
}

CRITICAL FORMAT RULES:
1. The top level MUST be a JSON object { }, NEVER a bare array [ ].
2. "global_summary" must be a single comprehensive string.
3. Do NOT wrap output in markdown code blocks.
4. Do NOT include ANY text outside the JSON object.`;

const GLOBAL_SYNTHESIS_ROLE = `You are a narrative synthesis expert. Your task is to weave multiple community summaries into a single, coherent global narrative that captures the current state of the story.

Focus on:
- Macro-level relationships and tensions between communities
- Overarching plot trajectory and unresolved conflicts
- Thematic connections across different story threads
- The "big picture" of what is happening in the world

Write in a storytelling style that emphasizes patterns, evolution, and cause-effect relationships across communities. Your summary should feel like a narrator stepping back to describe the forest rather than individual trees.`;

const GLOBAL_SYNTHESIS_RULES = `1. Synthesize ALL provided communities into a cohesive narrative.
2. Focus on connections between communities (shared characters, causal links, thematic parallels).
3. Capture the current trajectory: where is the story heading? What tensions are building?
4. Keep the summary under ~300 tokens (approximately 225 words).
5. Reference community titles to ground your synthesis in specific details.`;

import { GLOBAL_SYNTHESIS_EXAMPLES } from './examples/global-synthesis.js';
```

Then add the function (after `buildCommunitySummaryPrompt`, around line 450):

```javascript
/**
 * Build the global synthesis prompt for Map-Reduce over communities.
 * @param {Object[]} communities - Array of community objects with { title, summary, findings }
 * @param {string} preamble - System preamble (anti-refusal framing)
 * @param {string} outputLanguage - Output language setting ('auto'|'en'|'ru')
 * @returns {object} { system, user } prompt object
 */
export function buildGlobalSynthesisPrompt(communities, preamble, outputLanguage = 'auto') {
    const systemPrompt = assembleSystemPrompt({
        role: GLOBAL_SYNTHESIS_ROLE,
        schema: GLOBAL_SYNTHESIS_SCHEMA,
        rules: GLOBAL_SYNTHESIS_RULES,
        examples: GLOBAL_SYNTHESIS_EXAMPLES,
        outputLanguage,
    });

    const communityText = communities.map((c, i) =>
        `${i + 1}. ${c.title}\n${c.summary}${c.findings?.length ? '\nKey findings: ' + c.findings.join('; ') : ''}`
    ).join('\n\n');

    const languageInstruction = resolveLanguageInstruction(communityText, outputLanguage);
    const userPrompt = `<communities>
${communityText}
</communities>

${languageInstruction}
Synthesize these community summaries into a single global narrative (max ~300 tokens).
Focus on macro-relationships, overarching tensions, and plot trajectory.

Respond with a single JSON object containing "global_summary". No other text.`;

    return buildMessages(systemPrompt, userPrompt, '{', preamble);
}
```

Also export the examples (near top of file):
```javascript
import { GLOBAL_SYNTHESIS_EXAMPLES } from './examples/global-synthesis.js';
```

**Step 4: Verify (Green)**
- Command: `npm test tests/prompts.test.js`
- Expect: PASS

**Step 5: Git Commit**
- Command: `git add . && git commit -m "feat: add buildGlobalSynthesisPrompt function"`

---

## Phase 3: Global State Generation

### Task 5: Implement Global World State Generation

**Goal:** Add `generateGlobalWorldState()` in `src/graph/communities.js`.

**Step 1: Write the Failing Test**
- File: `tests/graph/communities.test.js`
- Code:
```javascript
import { generateGlobalWorldState } from '../../src/graph/communities.js';
import { buildGlobalSynthesisPrompt } from '../../src/prompts/index.js';
import { parseGlobalSynthesisResponse } from '../../src/extraction/structured.js';

describe('generateGlobalWorldState', () => {
    it('should call LLM with global synthesis prompt', async () => {
        const communities = {
            C0: { title: 'Community A', summary: 'Summary A', findings: ['f1'] },
            C1: { title: 'Community B', summary: 'Summary B', findings: ['f2'] },
        };

        const mockCallLLM = vi.fn().mockResolvedValue('{"global_summary": "Synthesized narrative..."}');
        // Note: You'll need to mock getDeps().callLLM

        const result = await generateGlobalWorldState(communities, 'auto', 'auto');

        expect(result.summary).toBe('Synthesized narrative...');
    });

    it('should return null when no communities exist', async () => {
        const result = await generateGlobalWorldState({}, 'auto', 'auto');
        expect(result).toBeNull();
    });
});
```

**Step 2: Run Test (Red)**
- Command: `npm test tests/graph/communities.test.js`
- Expect: "generateGlobalWorldState is not defined"

**Step 3: Implementation (Green)**
- File: `src/graph/communities.js`
- Action: Add `generateGlobalWorldState()` function.

- Guidance: Add after `updateCommunitySummaries` function:

```javascript
/**
 * Generate global world state from all community summaries.
 * Called after community updates, only if 1+ communities changed.
 *
 * @param {Object} communities - All community summaries
 * @param {string} preamble - Extraction preamble language
 * @param {string} outputLanguage - Output language setting
 * @returns {Promise<{ summary: string, last_updated: number, community_count: number } | null>}
 */
export async function generateGlobalWorldState(communities, preamble, outputLanguage) {
    const communityList = Object.values(communities || {});
    if (communityList.length === 0) {
        return null;
    }

    const t0 = performance.now();
    const deps = getDeps();

    try {
        const prompt = buildGlobalSynthesisPrompt(communityList, preamble, outputLanguage);
        const response = await callLLM(prompt, LLM_CONFIGS.community, { structured: true });
        const parsed = parseGlobalSynthesisResponse(response);

        const result = {
            summary: parsed.global_summary,
            last_updated: deps.Date.now(),
            community_count: communityList.length,
        };

        logDebug(`Global world state synthesized from ${communityList.length} communities`);
        record('global_synthesis', performance.now() - t0, `${communityList.length} communities`);
        return result;
    } catch (error) {
        logDebug(`Global world state synthesis failed: ${error.message}`);
        return null;
    }
}
```

**Step 4: Verify (Green)**
- Command: `npm test tests/graph/communities.test.js`
- Expect: PASS

**Step 5: Git Commit**
- Command: `git add . && git commit -m "feat: add generateGlobalWorldState function"`

---

### Task 6: Trigger Global Synthesis After Community Updates

**Goal:** Modify `updateCommunitySummaries()` to call global synthesis when communities change.

**Step 1: Write the Failing Test**
- File: `tests/graph/communities.test.js`
- Code:
```javascript
describe('updateCommunitySummaries with global synthesis', () => {
    it('should trigger global synthesis when communities are updated', async () => {
        // Setup: communities that will trigger updates
        const graphData = {
            nodes: { n1: { name: 'A', type: 'PERSON' }, n2: { name: 'B', type: 'PERSON' } },
            edges: {},
        };

        const existingCommunities = {}; // No existing communities, so all are new

        // Mock generateGlobalWorldState to track if it was called
        const mockGlobalState = { summary: 'Global state', last_updated: Date.now(), community_count: 1 };
        vi.mocked(generateGlobalWorldState).mockResolvedValue(mockGlobalState);

        const result = await updateCommunitySummaries(
            graphData,
            { '0': { nodeKeys: ['n1', 'n2'], nodeLines: [], edgeLines: [] } },
            existingCommunities,
            100,
            100,
            false
        );

        // Verify return structure has both communities and global_world_state
        expect(result).toHaveProperty('communities');
        expect(result).toHaveProperty('global_world_state');
        expect(result.global_world_state).toEqual(mockGlobalState);
        expect(generateGlobalWorldState).toHaveBeenCalled();
    });

    it('should skip global synthesis when no communities updated', async () => {
        // Test case where membership unchanged and not stale
        // generateGlobalWorldState should NOT be called
        // global_world_state should be null in return value
    });
});
```

**Step 2: Run Test (Red)**
- Command: `npm test tests/graph/communities.test.js`
- Expect: FAIL (global synthesis not triggered)

**Step 3: Implementation (Green)**
- File: `src/graph/communities.js`
- Action: Modify `updateCommunitySummaries()` to track update count and call global synthesis. Return object with both `communities` and optional `global_world_state`.

- Guidance: In `updateCommunitySummaries()`, before returning:

```javascript
// Track how many communities were actually updated
let updatedCount = 0;

for (const [communityId, group] of Object.entries(communityGroups)) {
    // ... existing logic ...

    // Inside the "generate new summary" try block, after success:
    updatedCount++;
}

// After the for loop, before return:
let globalState = null;
if (updatedCount > 0) {
    globalState = await generateGlobalWorldState(updatedCommunities, preamble, outputLanguage);
}

// Return object with communities and optional global state
return {
    communities: updatedCommunities,
    global_world_state: globalState,
};
```

**Note:** This changes the return type from `{ [id]: community }` to `{ communities: {...}, global_world_state?: {...} }`. Caller in `src/extraction/extract.js` (line ~616) will need to be updated to destructure the return value.

**Step 4: Verify (Green)**
- Command: `npm test tests/graph/communities.test.js`
- Expect: PASS

**Step 5: Git Commit**
- Command: `git add . && git commit -m "feat: trigger global synthesis after community updates"`

---

## Phase 4: Intent Detection & Routing

### Task 7: Add Macro Intent Detection

**Goal:** Implement `detectMacroIntent()` with multilingual regex.

**Step 1: Write the Failing Test**
- File: `tests/retrieval/world-context.test.js`
- Code:
```javascript
import { detectMacroIntent } from '../../src/retrieval/world-context.js';

describe('detectMacroIntent', () => {
    it('should detect English macro intent keywords', () => {
        expect(detectMacroIntent('Can you summarize what happened so far?')).toBe(true);
        expect(detectMacroIntent('Give me a recap of the story')).toBe(true);
        expect(detectMacroIntent('What is the overall dynamic?')).toBe(true);
        expect(detectMacroIntent('Tell me about what has happened lately')).toBe(true);
    });

    it('should detect Russian macro intent keywords', () => {
        expect(detectMacroIntent('Расскажи вкратце, что было')).toBe(true);
        expect(detectMacroIntent('Какой итог нашей истории?')).toBe(true);
        expect(detectMacroIntent('Наполни контекст о происходящем')).toBe(true);
        expect(detectMacroIntent('Напомни, как всё началось')).toBe(true);
    });

    it('should return false for local queries', () => {
        expect(detectMacroIntent('Let\'s go to the kitchen')).toBe(false);
        expect(detectMacroIntent('I kiss her gently')).toBe(false);
        expect(detectMacroIntent('Пойдём в спальню')).toBe(false);
    });

    it('should handle empty input gracefully', () => {
        expect(detectMacroIntent('')).toBe(false);
        expect(detectMacroIntent(null)).toBe(false);
        expect(detectMacroIntent(undefined)).toBe(false);
    });
});
```

**Step 2: Run Test (Red)**
- Command: `npm test tests/retrieval/world-context.test.js`
- Expect: "detectMacroIntent is not defined"

**Step 3: Implementation (Green)**
- File: `src/retrieval/world-context.js`
- Action: Add `detectMacroIntent()` function.

- Guidance: Add at the top of the file (after imports):

```javascript
/**
 * Multilingual regex for macro-intent detection.
 * Matches keywords that indicate user wants a global summary rather than local context.
 * English + Russian triggers as per Phase 2 design.
 */
const MACRO_INTENT_REGEX = /(summarize|recap|story so far|overall|time skip|what has happened|lately|dynamic|вкратце|что было|расскажи|итог|наполни|напомни)/i;

/**
 * Detect if user message indicates macro-intent (global summary needed).
 * @param {string|null|undefined} userMessagesString - Concatenated user messages
 * @returns {boolean} True if macro intent detected
 */
export function detectMacroIntent(userMessagesString) {
    if (!userMessagesString || typeof userMessagesString !== 'string') {
        return false;
    }
    return MACRO_INTENT_REGEX.test(userMessagesString);
}
```

**Step 4: Verify (Green)**
- Command: `npm test tests/retrieval/world-context.test.js`
- Expect: PASS

**Step 5: Git Commit**
- Command: `git add . && git commit -m "feat: add multilingual macro intent detection"`

---

### Task 8: Modify retrieveWorldContext for Intent Routing

**Goal:** Update `retrieveWorldContext()` to accept `globalState` and route based on intent.

**Step 1: Write the Failing Test**
- File: `tests/retrieval/world-context.test.js`
- Code:
```javascript
import { retrieveWorldContext } from '../../src/retrieval/world-context.js';
import { getEmbedding } from '../../src/utils/embedding-codec.js';

describe('retrieveWorldContext with intent routing', () => {
    it('should return global state when macro intent detected and state exists', () => {
        const globalState = { summary: 'Global narrative...' };
        const communities = {};
        const queryEmbedding = new Float32Array([0.1, 0.2]);
        const userMessages = 'Please summarize the story so far';

        const result = retrieveWorldContext(communities, globalState, userMessages, queryEmbedding, 2000);

        expect(result.text).toContain('<world_context>');
        expect(result.text).toContain('Global narrative...');
        expect(result.communityIds).toEqual([]);
    });

    it('should fall back to vector search when no macro intent', () => {
        const globalState = { summary: 'Global...' };
        const communities = {
            C0: { title: 'Community A', summary: 'Summary A', _embedding: 'base64...' }
        };
        const queryEmbedding = new Float32Array([0.1, 0.2]);
        const userMessages = 'Let\'s go to the kitchen';

        const result = retrieveWorldContext(communities, globalState, userMessages, queryEmbedding, 2000);

        // Should run vector search, not use global state
        expect(result.text).not.toContain('Global...');
        // communities with embeddings would be scored
    });

    it('should fall back to vector search when global state is null', () => {
        const userMessages = 'Summarize everything'; // has macro intent
        const globalState = null;

        const result = retrieveWorldContext({}, globalState, userMessages, new Float32Array([0.1]), 2000);

        // No global state available, fall back to vector search (returns empty if no communities)
        expect(result.text).toBe('');
    });
});
```

**Step 2: Run Test (Red)**
- Command: `npm test tests/retrieval/world-context.test.js`
- Expect: FAIL (signature mismatch or routing not implemented)

**Step 3: Implementation (Green)**
- File: `src/retrieval/world-context.js`
- Action: Modify `retrieveWorldContext()` function signature and add routing logic.

- Guidance: Replace existing function signature and add intent check at start:

```javascript
/**
 * Retrieve the most relevant community summaries for the current context.
 * Now supports intent-based routing: macro queries use global state, local queries use vector search.
 *
 * @param {Object} communities - Community data from state
 * @param {Object|null} globalState - Pre-computed global world state
 * @param {string} userMessagesString - Concatenated user messages for intent detection
 * @param {Float32Array} queryEmbedding - Embedding of current context
 * @param {number} tokenBudget - Max tokens for world context (default: 2000)
 * @returns {{ text: string, communityIds: string[] }}
 */
export function retrieveWorldContext(communities, globalState, userMessagesString, queryEmbedding, tokenBudget = 2000) {
    // Intent-based routing: check for macro intent first
    if (detectMacroIntent(userMessagesString) && globalState?.summary) {
        return {
            text: `<world_context>\n${globalState.summary}\n</world_context>`,
            communityIds: [],
        };
    }

    // Fall back to existing vector search logic
    if (!communities || !queryEmbedding) {
        return { text: '', communityIds: [] };
    }

    // ... rest of existing function unchanged ...
}
```

**Step 4: Verify (Green)**
- Command: `npm test tests/retrieval/world-context.test.js`
- Expect: PASS

**Step 5: Git Commit**
- Command: `git add . && git commit -m "feat: add intent routing to retrieveWorldContext"`

---

### Task 9: Update Caller to Pass New Parameters

**Goal:** Update `retrieveAndInjectContext()` to pass `globalState` and `userMessagesString`.

**Step 1: Write the Failing Test**
- File: `tests/retrieval/retrieve.test.js` (integration test)
- Code:
```javascript
describe('retrieveAndInjectContext with global state', () => {
    it('should pass global state and user messages to retrieveWorldContext', async () => {
        // Setup mock state with global_world_state
        const mockState = {
            chatMetadata: {
                openvault: {
                    global_world_state: {
                        summary: 'Test global state',
                        last_updated: Date.now(),
                        community_count: 2,
                    },
                    communities: { /* ... */ },
                    memories: [],
                },
            },
        };

        // Mock retrieveWorldContext to track received parameters
        const originalRetrieveWorldContext = await import('../../src/retrieval/world-context.js');
        let receivedGlobalState = null;
        let receivedUserMessages = null;

        // Run retrieval with macro-intent message
        await retrieveAndInjectContext('What is the story so far?', mockState);

        // Verify retrieveWorldContext was called with global state
        expect(receivedGlobalState).not.toBeNull();
        expect(receivedUserMessages).toContain('story so far');
    });
});
```

**Step 2: Run Test (Red)**
- Command: `npm test tests/retrieval/retrieve.test.js`
- Expect: FAIL (parameters not passed)

**Step 3: Implementation (Green)**
- File: `src/retrieval/retrieve.js`
- Action: Find the call to `retrieveWorldContext()` and add new parameters.

- Guidance: Find where `retrieveWorldContext` is called and update:

```javascript
// Find this line (approximately):
const worldContext = retrieveWorldContext(
    data.communities,
    queryEmbedding,
    settings.worldContextTokens || 2000
);

// Replace with:
const userMessagesString = messages; // or whatever variable holds the concatenated user messages
const globalState = data.global_world_state || null;

const worldContext = retrieveWorldContext(
    data.communities,
    globalState,
    userMessagesString,
    queryEmbedding,
    settings.worldContextTokens || 2000
);
```

**Note:** You may need to trace back to find where `messages` is available. The design specifies using the existing `userMessages` string that's already concatenated for embedding query.

**Step 4: Verify (Green)**
- Command: `npm test tests/retrieval/retrieve.test.js`
- Expect: PASS

**Step 5: Git Commit**
- Command: `git add . && git commit -m "feat: pass global state to world context retrieval"`

---

## Phase 5: Integration & Storage

### Task 10: Persist Global State to chatMetadata

**Goal:** Update caller in `src/extraction/extract.js` to handle new return structure from `updateCommunitySummaries()`.

**Step 1: Locate Caller**
- File: `src/extraction/extract.js`, line ~616, under `// Stage 4.7: Community detection`

**Step 2: Update Caller to Destructure Return Value**
- Current code:
```javascript
data.communities = await updateCommunitySummaries(
    data.graph,
    groups,
    data.communities || {},
    currCount,
    settings.communityStalenessThreshold || 100,
    isSingleCommunity
);
```

- Replace with:
```javascript
const communityUpdateResult = await updateCommunitySummaries(
    data.graph,
    groups,
    data.communities || {},
    currCount,
    settings.communityStalenessThreshold || 100,
    isSingleCommunity
);
data.communities = communityUpdateResult.communities;
if (communityUpdateResult.global_world_state) {
    data.global_world_state = communityUpdateResult.global_world_state;
}
```

**Step 3: Git Commit**
- Command: `git add . && git commit -m "feat: persist global world state to chat metadata"`

---

## Phase 6: End-to-End Testing

### Task 11: End-to-End Integration Test

**Goal:** Verify full pipeline works.

**Step 1: Create Integration Test**
- File: `tests/integration/phase2-e2e.test.js`
- Code:
```javascript
describe('Phase 2 End-to-End', () => {
    it('should complete full cycle: extraction → communities → global state → retrieval', async () => {
        // 1. Simulate chat growth to trigger community detection
        // 2. Verify global_world_state is generated
        // 3. Send macro-intent message
        // 4. Verify global state is injected
        // 5. Verify <subconscious_drives> appears in formatted output
    });
});
```

**Step 2: Manual Verification**
- Load existing chat
- Check that `<subconscious_drives>` appears when reflections exist
- Check that macro queries return global context
- Check backward compatibility (chats without global_state work)

**Step 3: Git Commit**
- Command: `git add . && git commit -m "test: add Phase 2 end-to-end integration test"`

---

## Summary

**Total Tasks:** 11
**Estimated Time:** 2-3 hours

**Order of Execution:**
1. Tasks 1 (Subconscious Drives formatting) — Independent
2. Tasks 2-4 (Schema, Examples, Prompt) — Sequential
3. Tasks 5-6 (Generation) — Sequential, depend on 2-4
4. Tasks 7-9 (Intent & Routing) — Sequential
5. Task 10 (Storage) — After 6
6. Task 11 (E2E) — After all above

**Parallelization Opportunities:**
- Task 1 can run in parallel with Tasks 2-4
- Tasks 7-9 can only start after Task 1 (due to testing bandwidth)
