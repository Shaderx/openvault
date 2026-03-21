# ST Vectors Embedding Source Implementation Plan

**Goal:** Add `st-vectors` embedding source that piggybacks on ST's Vector Storage settings.
**Architecture:** New `STVectorsStrategy` class calls `/api/embeddings/generate` with source/model from `extension_settings.vectors`.
**Tech Stack:** JavaScript, Vitest, SillyTavern extension API

---

## File Structure

| File | Action |
|------|--------|
| `src/embeddings.js` | Modify - Add `STVectorsStrategy` class |
| `templates/settings_panel.html` | Modify - Add option and hint |
| `src/ui/settings.js` | Modify - Toggle hint/prefix visibility |
| `tests/embeddings.test.js` | Modify - Add STVectorsStrategy tests |

---

### Task 1: Add STVectorsStrategy isEnabled() and getStatus()

**Files:**
- Modify: `src/embeddings.js`
- Modify: `tests/embeddings.test.js`

**Purpose:** Create the strategy class with basic identity methods that read from ST's Vector Storage settings.

**Common Pitfalls:**
- Use `getDeps().getExtensionSettings()` to get `extension_settings`, not a global
- Access `vectors.source` and `vectors.openai_model` from the returned object
- ST stores OpenRouter model under `openai_model` key

- [ ] Step 1: Write the failing test

```js
// tests/embeddings.test.js - add after existing tests

describe('STVectorsStrategy', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('isEnabled', () => {
        it('returns true when extension_settings.vectors.source is set', async () => {
            const depsModule = await import('../src/deps.js');
            vi.spyOn(depsModule, 'getDeps').mockReturnValue({
                getExtensionSettings: vi.fn(() => ({
                    vectors: { source: 'openrouter', openai_model: 'text-embedding-3-small' },
                })),
            });

            const { getStrategy } = await import('../src/embeddings.js');
            const strategy = getStrategy('st-vectors');

            expect(strategy.isEnabled()).toBe(true);
        });

        it('returns false when extension_settings.vectors is missing', async () => {
            const depsModule = await import('../src/deps.js');
            vi.spyOn(depsModule, 'getDeps').mockReturnValue({
                getExtensionSettings: vi.fn(() => ({})),
            });

            const { getStrategy } = await import('../src/embeddings.js');
            const strategy = getStrategy('st-vectors');

            expect(strategy.isEnabled()).toBe(false);
        });

        it('returns false when vectors.source is empty', async () => {
            const depsModule = await import('../src/deps.js');
            vi.spyOn(depsModule, 'getDeps').mockReturnValue({
                getExtensionSettings: vi.fn(() => ({
                    vectors: { source: '', openai_model: 'text-embedding-3-small' },
                })),
            });

            const { getStrategy } = await import('../src/embeddings.js');
            const strategy = getStrategy('st-vectors');

            expect(strategy.isEnabled()).toBe(false);
        });
    });

    describe('getStatus', () => {
        it('shows provider and model when configured', async () => {
            const depsModule = await import('../src/deps.js');
            vi.spyOn(depsModule, 'getDeps').mockReturnValue({
                getExtensionSettings: vi.fn(() => ({
                    vectors: { source: 'openrouter', openai_model: 'text-embedding-3-small' },
                })),
            });

            const { getStrategy } = await import('../src/embeddings.js');
            const strategy = getStrategy('st-vectors');

            expect(strategy.getStatus()).toBe('ST: openrouter / text-embedding-3-small');
        });

        it('shows "default" when model is empty', async () => {
            const depsModule = await import('../src/deps.js');
            vi.spyOn(depsModule, 'getDeps').mockReturnValue({
                getExtensionSettings: vi.fn(() => ({
                    vectors: { source: 'openai', openai_model: '' },
                })),
            });

            const { getStrategy } = await import('../src/embeddings.js');
            const strategy = getStrategy('st-vectors');

            expect(strategy.getStatus()).toBe('ST: openai / default');
        });

        it('shows configure hint when not set up', async () => {
            const depsModule = await import('../src/deps.js');
            vi.spyOn(depsModule, 'getDeps').mockReturnValue({
                getExtensionSettings: vi.fn(() => ({})),
            });

            const { getStrategy } = await import('../src/embeddings.js');
            const strategy = getStrategy('st-vectors');

            expect(strategy.getStatus()).toBe('Configure in Vector Storage');
        });
    });
});
```

- [ ] Step 2: Run tests to verify they fail

Run: `npx vitest run tests/embeddings.test.js -t "STVectorsStrategy"`
Expected: FAIL - `getStrategy('st-vectors')` returns undefined or strategy has no `isEnabled`

- [ ] Step 3: Add STVectorsStrategy class

In `src/embeddings.js`, add after the `OllamaStrategy` class (around line 200):

```js
// =============================================================================
// ST Vectors Strategy (Vector Storage extension)
// =============================================================================

class STVectorsStrategy extends EmbeddingStrategy {
    getId() {
        return 'st-vectors';
    }

    #getVectorSettings() {
        const extensionSettings = getDeps().getExtensionSettings();
        return extensionSettings?.vectors || null;
    }

    isEnabled() {
        const vectorSettings = this.#getVectorSettings();
        return !!(vectorSettings?.source);
    }

    getStatus() {
        const vectorSettings = this.#getVectorSettings();
        if (!vectorSettings?.source) {
            return 'Configure in Vector Storage';
        }
        const source = vectorSettings.source;
        const model = vectorSettings.openai_model || 'default';
        return `ST: ${source} / ${model}`;
    }

    async getEmbedding(text, { signal } = {}) {
        const vectorSettings = this.#getVectorSettings();
        if (!vectorSettings?.source) {
            return null;
        }

        if (!text || text.trim().length === 0) {
            return null;
        }

        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        try {
            const response = await getDeps().fetch('/api/embeddings/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source: vectorSettings.source,
                    items: [text.trim()],
                    model: vectorSettings.openai_model || undefined,
                }),
                signal,
            });

            if (!response.ok) {
                logDebug(`ST Vectors embedding request failed: ${response.status}`);
                return null;
            }

            const data = await response.json();
            return data.embeddings?.[0] ? new Float32Array(data.embeddings[0]) : null;
        } catch (error) {
            if (error.name === 'AbortError') throw error;
            logError('ST Vectors embedding failed', error, {
                source: vectorSettings?.source,
                textSnippet: text?.slice(0, 100),
            });
            return null;
        }
    }

    async getQueryEmbedding(text, options = {}) {
        return this.getEmbedding(text, options);
    }

    async getDocumentEmbedding(text, options = {}) {
        return this.getEmbedding(text, options);
    }
}
```

- [ ] Step 4: Register the strategy

In `src/embeddings.js`, update the `strategies` object (around line 250):

```js
const strategies = {
    'multilingual-e5-small': new TransformersStrategy(),
    'bge-small-en-v1.5': new TransformersStrategy(),
    'embeddinggemma-300m': new TransformersStrategy(),
    'ollama': new OllamaStrategy(),
    'st-vectors': new STVectorsStrategy(),
};
```

- [ ] Step 5: Run tests to verify they pass

Run: `npx vitest run tests/embeddings.test.js -t "STVectorsStrategy"`
Expected: PASS - all isEnabled and getStatus tests pass

- [ ] Step 6: Commit

```bash
git add -A && git commit -m "feat(embeddings): add STVectorsStrategy isEnabled and getStatus"
```

---

### Task 2: Add getEmbedding with fetch to ST endpoint

**Files:**
- Modify: `src/embeddings.js`
- Modify: `tests/embeddings.test.js`

**Purpose:** Implement the core embedding generation that calls ST's `/api/embeddings/generate` endpoint.

- [ ] Step 1: Write the failing test

```js
// tests/embeddings.test.js - add inside STVectorsStrategy describe block

describe('getEmbedding', () => {
    it('calls /api/embeddings/generate with correct payload', async () => {
        const fetchSpy = vi.fn(async () => ({
            ok: true,
            json: async () => ({ embeddings: [[0.1, 0.2, 0.3]] }),
        }));

        const depsModule = await import('../src/deps.js');
        vi.spyOn(depsModule, 'getDeps').mockReturnValue({
            getExtensionSettings: vi.fn(() => ({
                vectors: { source: 'openrouter', openai_model: 'text-embedding-3-small' },
            })),
            fetch: fetchSpy,
        });

        const { getStrategy } = await import('../src/embeddings.js');
        const strategy = getStrategy('st-vectors');
        const result = await strategy.getEmbedding('test text');

        expect(fetchSpy).toHaveBeenCalledWith(
            '/api/embeddings/generate',
            expect.objectContaining({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source: 'openrouter',
                    items: ['test text'],
                    model: 'text-embedding-3-small',
                }),
                signal: undefined,
            })
        );
        expect(result).toBeInstanceOf(Float32Array);
        expect(result[0]).toBeCloseTo(0.1, 5);
    });

    it('returns null when vector settings not configured', async () => {
        const depsModule = await import('../src/deps.js');
        vi.spyOn(depsModule, 'getDeps').mockReturnValue({
            getExtensionSettings: vi.fn(() => ({})),
            fetch: vi.fn(),
        });

        const { getStrategy } = await import('../src/embeddings.js');
        const strategy = getStrategy('st-vectors');
        const result = await strategy.getEmbedding('test text');

        expect(result).toBeNull();
    });

    it('returns null when text is empty', async () => {
        const depsModule = await import('../src/deps.js');
        vi.spyOn(depsModule, 'getDeps').mockReturnValue({
            getExtensionSettings: vi.fn(() => ({
                vectors: { source: 'openrouter', openai_model: 'text-embedding-3-small' },
            })),
            fetch: vi.fn(),
        });

        const { getStrategy } = await import('../src/embeddings.js');
        const strategy = getStrategy('st-vectors');
        const result = await strategy.getEmbedding('');

        expect(result).toBeNull();
    });

    it('throws AbortError when signal is pre-aborted', async () => {
        const depsModule = await import('../src/deps.js');
        vi.spyOn(depsModule, 'getDeps').mockReturnValue({
            getExtensionSettings: vi.fn(() => ({
                vectors: { source: 'openrouter', openai_model: 'text-embedding-3-small' },
            })),
            fetch: vi.fn(),
        });

        const { getStrategy } = await import('../src/embeddings.js');
        const strategy = getStrategy('st-vectors');
        const ctrl = new AbortController();
        ctrl.abort();

        await expect(strategy.getEmbedding('test', { signal: ctrl.signal })).rejects.toThrow(
            expect.objectContaining({ name: 'AbortError' })
        );
    });

    it('passes signal to fetch', async () => {
        const fetchSpy = vi.fn(async () => ({
            ok: true,
            json: async () => ({ embeddings: [[0.1]] }),
        }));

        const depsModule = await import('../src/deps.js');
        vi.spyOn(depsModule, 'getDeps').mockReturnValue({
            getExtensionSettings: vi.fn(() => ({
                vectors: { source: 'openrouter', openai_model: 'text-embedding-3-small' },
            })),
            fetch: fetchSpy,
        });

        const { getStrategy } = await import('../src/embeddings.js');
        const strategy = getStrategy('st-vectors');
        const ctrl = new AbortController();
        await strategy.getEmbedding('test', { signal: ctrl.signal });

        expect(fetchSpy).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ signal: ctrl.signal })
        );
    });
});
```

- [ ] Step 2: Run tests to verify they fail

Run: `npx vitest run tests/embeddings.test.js -t "getEmbedding"`
Expected: Some tests pass (code from Task 1), but fetch-related tests may fail

- [ ] Step 3: Verify implementation from Task 1 covers this

The `getEmbedding` method was already implemented in Task 1. Verify tests pass.

- [ ] Step 4: Run tests to verify they pass

Run: `npx vitest run tests/embeddings.test.js -t "STVectorsStrategy"`
Expected: PASS - all STVectorsStrategy tests pass

- [ ] Step 5: Commit

```bash
git add -A && git commit -m "test(embeddings): add STVectorsStrategy getEmbedding tests"
```

---

### Task 3: Add st-vectors option to UI dropdown

**Files:**
- Modify: `templates/settings_panel.html`

**Purpose:** Add the `st-vectors` option to the embedding source dropdown with a configuration hint.

- [ ] Step 1: Add option to dropdown

In `templates/settings_panel.html`, find the embedding source select (around line 182) and add the option:

```html
<optgroup label="External">
    <option value="ollama">Ollama (Custom server)</option>
    <option value="st-vectors">ST Vector Storage (OpenRouter, OpenAI, Cohere, etc.)</option>
</optgroup>
```

- [ ] Step 2: Add configuration hint below the dropdown

After the `</select>` tag for embedding source, add:

```html
<!-- ST Vectors Configuration Hint -->
<div id="openvault_st_vectors_hint" style="display: none; margin-top: 8px;">
    <small class="openvault-hint">
        <i class="fa-solid fa-info-circle"></i>
        Configure provider and model in <strong>SillyTavern Settings → Vector Storage</strong>
    </small>
</div>
```

- [ ] Step 3: Verify HTML structure

The section should now look like:

```html
<select id="openvault_embedding_source" class="text_pole">
    <optgroup label="Multilingual">
        <option value="multilingual-e5-small">multilingual-e5-small - 384d · 118M · 100+ langs · MTEB: 55.8</option>
        <option value="embeddinggemma-300m">embeddinggemma-300m - 768d · 300M · 100+ langs · MTEB: 61.2 (WebGPU)</option>
    </optgroup>
    <optgroup label="English Only">
        <option value="bge-small-en-v1.5">bge-small-en-v1.5 - 384d · 133MB · MTEB: 62.17 · SOTA RAG</option>
    </optgroup>
    <optgroup label="External">
        <option value="ollama">Ollama (Custom server)</option>
        <option value="st-vectors">ST Vector Storage (OpenRouter, OpenAI, Cohere, etc.)</option>
    </optgroup>
</select>

<!-- ST Vectors Configuration Hint -->
<div id="openvault_st_vectors_hint" style="display: none; margin-top: 8px;">
    <small class="openvault-hint">
        <i class="fa-solid fa-info-circle"></i>
        Configure provider and model in <strong>SillyTavern Settings → Vector Storage</strong>
    </small>
</div>

<!-- Embedding Prefixes -->
<label for="openvault_embedding_query_prefix">Query Prefix</label>
```

- [ ] Step 4: Commit

```bash
git add -A && git commit -m "feat(ui): add st-vectors option to embedding dropdown"
```

---

### Task 4: Add UI logic to toggle hint and prefix fields

**Files:**
- Modify: `src/ui/settings.js`
- Modify: `tests/unit/settings-ui.test.js` (or create if needed)

**Purpose:** Show configuration hint and hide prefix fields when `st-vectors` is selected.

- [ ] Step 1: Write the failing test

```js
// tests/unit/settings-ui.test.js - add or create

import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('ST Vectors UI visibility', () => {
    beforeEach(() => {
        // Set up minimal DOM
        document.body.innerHTML = `
            <select id="openvault_embedding_source">
                <option value="multilingual-e5-small">e5-small</option>
                <option value="ollama">Ollama</option>
                <option value="st-vectors">ST Vectors</option>
            </select>
            <div id="openvault_st_vectors_hint" style="display: none;"></div>
            <div id="openvault_ollama_settings" style="display: none;"></div>
            <input id="openvault_embedding_query_prefix" />
            <input id="openvault_embedding_doc_prefix" />
        `;
    });

    it('shows st-vectors hint when st-vectors is selected', () => {
        const $ = (sel) => document.querySelector(sel);
        const hint = $('#openvault_st_vectors_hint');
        const select = $('#openvault_embedding_source');

        // Simulate selection
        select.value = 'st-vectors';
        select.dispatchEvent(new Event('change'));

        // This will fail until we add the toggle logic
        expect(hint.style.display).not.toBe('none');
    });

    it('hides st-vectors hint when other source is selected', () => {
        const $ = (sel) => document.querySelector(sel);
        const hint = $('#openvault_st_vectors_hint');
        hint.style.display = 'block'; // Start visible

        const select = $('#openvault_embedding_source');
        select.value = 'multilingual-e5-small';
        select.dispatchEvent(new Event('change'));

        expect(hint.style.display).toBe('none');
    });
});
```

- [ ] Step 2: Run test to verify it fails

Run: `npx vitest run tests/unit/settings-ui.test.js -t "ST Vectors UI"`
Expected: FAIL - hint visibility not toggled

- [ ] Step 3: Add toggle logic to settings.js

In `src/ui/settings.js`, find the `$('#openvault_embedding_source').on('change', ...)` handler (around line 150) and add the hint toggle:

Find this block:
```js
$('#openvault_embedding_source').on('change', async function () {
    const value = $(this).val();
    // ... existing code ...
    $('#openvault_ollama_settings').toggle(value === 'ollama');
    updateEmbeddingStatusDisplay(getEmbeddingStatus());
});
```

Replace with:
```js
$('#openvault_embedding_source').on('change', async function () {
    const value = $(this).val();

    // Reset old strategy before switching to prevent VRAM leak
    try {
        const currentSettings = getDeps().getExtensionSettings();
        const oldSource = currentSettings?.[extensionName]?.embeddingSource;

        if (oldSource && oldSource !== value) {
            const oldStrategy = getStrategy(oldSource);
            if (oldStrategy && typeof oldStrategy.reset === 'function') {
                await oldStrategy.reset();
            }
        }
    } catch (err) {
        logWarn('Failed to reset old embedding strategy: ' + err.message);
    }

    // Persist the model selection
    setSetting('embeddingSource', value);

    // Auto-populate prefix fields from model defaults (skip for st-vectors)
    if (value !== 'st-vectors') {
        const prefixes = embeddingModelPrefixes[value] || embeddingModelPrefixes._default;
        setSetting('embeddingQueryPrefix', prefixes.queryPrefix);
        setSetting('embeddingDocPrefix', prefixes.docPrefix);
        $('#openvault_embedding_query_prefix').val(prefixes.queryPrefix);
        $('#openvault_embedding_doc_prefix').val(prefixes.docPrefix);
    }

    // Invalidate stale embeddings if model changed
    const data = getOpenVaultData();
    if (data) {
        const { invalidateStaleEmbeddings, saveOpenVaultData } = await import('../utils/data.js');
        const wiped = invalidateStaleEmbeddings(data, value);
        if (wiped > 0) {
            await saveOpenVaultData();
            showToast('info', `Embedding model changed. Re-embedding ${wiped} vectors in background.`);
            // Auto-trigger comprehensive re-embedding in background
            import('../embeddings.js').then(({ backfillAllEmbeddings }) => {
                backfillAllEmbeddings({ silent: true })
                    .then(() => refreshAllUI())
                    .catch(() => {});
            });
            refreshAllUI();
        }
    }

    // Toggle visibility for external providers
    $('#openvault_ollama_settings').toggle(value === 'ollama');
    $('#openvault_st_vectors_hint').toggle(value === 'st-vectors');

    updateEmbeddingStatusDisplay(getEmbeddingStatus());
});
```

- [ ] Step 4: Run tests to verify they pass

Run: `npx vitest run tests/unit/settings-ui.test.js -t "ST Vectors UI"`
Expected: PASS

- [ ] Step 5: Commit

```bash
git add -A && git commit -m "feat(ui): toggle st-vectors hint on source change"
```

---

### Task 5: Update updateUI() to sync st-vectors state

**Files:**
- Modify: `src/ui/settings.js`

**Purpose:** Ensure the hint visibility is correct when settings load.

- [ ] Step 1: Update updateUI() function

In `src/ui/settings.js`, find the `updateUI()` function and add the hint toggle:

Find this block (around line 350):
```js
// Embedding settings
$('#openvault_embedding_source').val(settings.embeddingSource);
$('#openvault_ollama_settings').toggle(settings.embeddingSource === 'ollama');
```

Replace with:
```js
// Embedding settings
$('#openvault_embedding_source').val(settings.embeddingSource);
$('#openvault_ollama_settings').toggle(settings.embeddingSource === 'ollama');
$('#openvault_st_vectors_hint').toggle(settings.embeddingSource === 'st-vectors');
```

- [ ] Step 2: Verify all existing tests pass

Run: `npx vitest run`
Expected: PASS - all tests pass

- [ ] Step 3: Commit

```bash
git add -A && git commit -m "feat(ui): sync st-vectors hint visibility on load"
```

---

### Task 6: Final verification

**Files:**
- None (verification only)

- [ ] Step 1: Run full test suite

Run: `npx vitest run`
Expected: All tests pass

- [ ] Step 2: Verify design requirements met

- [ ] `st-vectors` option appears in External dropdown
- [ ] Hint shows when `st-vectors` selected
- [ ] Hint hides when other source selected
- [ ] Strategy calls `/api/embeddings/generate` with correct payload
- [ ] Strategy reads source/model from `extension_settings.vectors`

- [ ] Step 3: Final commit

```bash
git add -A && git commit -m "feat: complete st-vectors embedding source"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add STVectorsStrategy class | `src/embeddings.js`, `tests/embeddings.test.js` |
| 2 | Test getEmbedding method | `tests/embeddings.test.js` |
| 3 | Add UI dropdown option | `templates/settings_panel.html` |
| 4 | Toggle hint visibility | `src/ui/settings.js`, `tests/unit/settings-ui.test.js` |
| 5 | Sync UI on load | `src/ui/settings.js` |
| 6 | Final verification | - |