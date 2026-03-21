# Design: ST Vectors Embedding Source

**Date:** 2026-03-21
**Status:** Draft

## Summary

Add a new embedding source `st-vectors` that piggybacks on SillyTavern's Vector Storage extension settings. This allows OpenVault to use any embedding provider the user has already configured in ST (OpenRouter, OpenAI, Cohere, etc.) without requiring separate configuration.

## Problem

OpenVault currently supports:
- **Local browser models** (multilingual-e5-small, bge-small-en-v1.5, embeddinggemma-300m) via Transformers.js
- **Ollama** (custom local server)

Users who want cloud embeddings (OpenRouter, OpenAI, Cohere) must:
1. Configure their API key in ST's Vector Storage extension
2. Configure the same key again in OpenVault (not currently supported)

This is redundant and error-prone.

## Solution

Add `st-vectors` as a new embedding source that calls ST's internal `/api/embeddings/generate` endpoint. This endpoint:
1. Reads `extension_settings.vectors.source` to determine the provider (openrouter, openai, cohere, etc.)
2. Reads `extension_settings.vectors.openai_model` for the model name
3. Resolves the API key from `secrets.json` server-side (key never exposed to client)

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        OpenVault Settings                        │
│  embeddingSource: "st-vectors"                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STVectorsStrategy                             │
│  - isEnabled(): check extension_settings.vectors.source         │
│  - getQueryEmbedding(text) → /api/embeddings/generate           │
│  - getDocumentEmbedding(text) → /api/embeddings/generate        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              ST Server: /api/embeddings/generate                 │
│  - Reads source from request body                                │
│  - Reads model from extension_settings.vectors.openai_model     │
│  - Reads API key from secrets.json (server-side only)           │
│  - Routes to appropriate provider (OpenRouter, OpenAI, etc.)    │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Details

### 1. New Strategy Class: `STVectorsStrategy`

Location: `src/embeddings.js`

```js
class STVectorsStrategy extends EmbeddingStrategy {
    getId() {
        return 'st-vectors';
    }

    isEnabled() {
        // Check if user has configured Vector Storage
        const vectorSettings = extension_settings?.vectors;
        return !!(vectorSettings?.source);
    }

    getStatus() {
        const vectorSettings = extension_settings?.vectors;
        if (!vectorSettings?.source) {
            return 'Configure in Vector Storage';
        }
        const source = vectorSettings.source;
        // Map source to its corresponding model field
        const sourceToModelField = {
            openai: 'openai_model',
            openrouter: 'openrouter_model',
            cohere: 'cohere_model',
            ollama: 'ollama_model',
            vllm: 'vllm_model',
            google: 'google_model',
            togetherai: 'togetherai_model',
            electronhub: 'electronhub_model',
            chutes: 'chutes_model',
            nanogpt: 'nanogpt_model',
        };
        const modelField = sourceToModelField[source];
        const model = (modelField && vectorSettings[modelField]) || 'default';
        return `ST: ${source} / ${model}`;
    }

    async getEmbedding(text, { signal } = {}) {
        const vectorSettings = extension_settings?.vectors;
        if (!vectorSettings?.source) {
            return null;
        }

        // Map source to its corresponding model field
        const sourceToModelField = {
            openai: 'openai_model',
            openrouter: 'openrouter_model',
            cohere: 'cohere_model',
            ollama: 'ollama_model',
            vllm: 'vllm_model',
            google: 'google_model',
            togetherai: 'togetherai_model',
            electronhub: 'electronhub_model',
            chutes: 'chutes_model',
            nanogpt: 'nanogpt_model',
        };
        const modelField = sourceToModelField[vectorSettings.source];
        const model = modelField && vectorSettings[modelField];

        const response = await fetch('/api/embeddings/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source: vectorSettings.source,
                items: [text],
                model: model || undefined,
            }),
            signal,
        });

        if (!response.ok) return null;
        const data = await response.json();
        return data.embeddings?.[0] ? new Float32Array(data.embeddings[0]) : null;
    }

    async getQueryEmbedding(text, options = {}) {
        return this.getEmbedding(text, options);
    }

    async getDocumentEmbedding(text, options = {}) {
        return this.getEmbedding(text, options);
    }
}
```

### 2. Register Strategy

```js
const strategies = {
    'multilingual-e5-small': new TransformersStrategy(),
    'bge-small-en-v1.5': new TransformersStrategy(),
    'embeddinggemma-300m': new TransformersStrategy(),
    'ollama': new OllamaStrategy(),
    'st-vectors': new STVectorsStrategy(),  // NEW
};
```

### 3. UI Changes

**Embedding Model Dropdown** (`templates/settings_panel.html`):

Add `st-vectors` to the "External" group:

```html
<optgroup label="External">
    <option value="ollama">Ollama (Custom server)</option>
    <option value="st-vectors">ST Vector Storage (OpenRouter, OpenAI, Cohere, etc.)</option>
</optgroup>
```

**Configuration Hint**:

When `st-vectors` is selected, show a hint directing users to ST's Vector Storage settings:

```html
<div id="openvault_st_vectors_hint" style="display: none;">
    <small class="openvault-hint">
        <i class="fa-solid fa-info-circle"></i>
        Configure provider and model in <strong>SillyTavern Settings → Vector Storage</strong>
    </small>
</div>
```

**JavaScript** (`src/ui/settings.js`):

```js
$('#openvault_embedding_source').on('change', async function () {
    const value = $(this).val();
    // ... existing code ...

    // Show/hide ST Vectors hint
    $('#openvault_st_vectors_hint').toggle(value === 'st-vectors');

    // Show/hide Ollama settings
    $('#openvault_ollama_settings').toggle(value === 'ollama');

    // Hide prefix fields for st-vectors (prefixes handled by ST)
    $('#openvault_embedding_prefix_fields').toggle(value !== 'st-vectors');
});
```

### 4. Prefix Handling

ST's `/api/embeddings/generate` endpoint handles prefixes internally based on the provider. OpenVault should **not** apply its own query/doc prefixes when using `st-vectors`:

```js
async getEmbedding(text, { signal } = {}) {
    // ... fetch logic ...
    // Note: Do NOT apply embeddingQueryPrefix/embeddingDocPrefix
    // ST's endpoint handles provider-specific formatting
}
```

### 5. Error Messages

| Condition | Status Display | User Action |
|-----------|---------------|-------------|
| No Vector Storage configured | `Configure in Vector Storage` | Open ST Settings → Vector Storage |
| Missing API key | `Missing API key` | Add key in ST secrets |
| Provider error | `Error: {message}` | Check provider status |

## User Experience

### Before
User wants OpenRouter embeddings for OpenVault:
1. Must set up OpenRouter key in ST secrets
2. Configure Vector Storage to use OpenRouter
3. OpenVault cannot use this configuration → must fall back to local models

### After
User wants OpenRouter embeddings for OpenVault:
1. Set up OpenRouter key in ST secrets
2. Configure Vector Storage to use OpenRouter
3. Select `st-vectors` in OpenVault → done

### Configuration Location Hint

The UI clearly shows where to configure:

```
Embedding Model: [ST Vector Storage (OpenRouter, OpenAI, Cohere, etc.) ▼]

ℹ️ Configure provider and model in SillyTavern Settings → Vector Storage

Status: ST: openrouter / text-embedding-3-small ✓
```

## Testing

1. **Unit tests** for `STVectorsStrategy`:
   - `isEnabled()` returns true when `extension_settings.vectors.source` is set
   - `getStatus()` shows provider and model name
   - `getEmbedding()` calls `/api/embeddings/generate` with correct payload

2. **Integration tests**:
   - Selecting `st-vectors` shows configuration hint
   - Embedding generation works with mock ST endpoint
   - Fallback to local models when ST Vector Storage not configured

## Files Changed

| File | Change |
|------|--------|
| `src/embeddings.js` | Add `STVectorsStrategy` class |
| `templates/settings_panel.html` | Add `st-vectors` option and hint |
| `src/ui/settings.js` | Toggle hint visibility on source change |

## Risks

1. **ST API changes**: `/api/embeddings/generate` is internal and may change. Mitigation: Document the dependency, monitor ST releases.

2. **Provider-specific behavior**: Different providers may handle prefixes differently. Mitigation: ST's endpoint abstracts this; we trust it to return normalized embeddings.

## Questions Resolved

- **Name**: `st-vectors` (short, matches `extension_settings.vectors`)
- **Model selection**: Auto-read from `extension_settings.vectors.openai_model`
- **Prefixes**: ST handles internally; OpenVault should not apply its own
- **Configuration hint**: Direct users to ST Settings → Vector Storage