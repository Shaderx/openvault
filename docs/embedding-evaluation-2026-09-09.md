# WebGPU identity operating-point check — 2026-09-09

The isolated browser harness at `tests/manual/embedding-evaluation.html` ran the centrally pinned Transformers.js 4.0.1 on the Codex in-app browser WebGPU adapter. Qwen3 q8 produced normalized 1024-dimensional last-token vectors; EmbeddingGemma q4 produced normalized 768-dimensional mean-pooled vectors. All recorded norms differed from 1 by less than 0.000001.

Reproduce from the repository root with `node scripts/serve-embedding-evaluation.mjs`, open `http://localhost:8791/tests/manual/embedding-evaluation.html`, and select a model. This localhost-only server exposes the evaluation page and its two source dependencies. Models download only after a button is selected; no chat data or configured provider credentials are used.

The nine synthetic pairs include four established-identity positives and five hard negatives. Production-shaped input is `PERSON: name - A resident involved in the current story.` with the matching task prefix. Exact cosine observations and model configuration are in `tests/fixtures/identity-webgpu.json`.

| Model | Positive cosine range | Negative cosine range | Selected threshold | Raw positive recall | Raw false-positive rate |
| --- | --- | --- | --- | --- | --- |
| Qwen3 q8 | 0.7973–0.9044 | 0.8094–0.8753 | 0.88 | 1/4 | 0/5 |
| EmbeddingGemma q4 | 0.9129–0.9649 | 0.8954–0.9340 | 0.94 | 2/4 | 0/5 |

These are conservative operating points on a small synthetic set, not general accuracy certification. The raw scores deliberately demonstrate that descriptions and cosine cannot establish identity by themselves. Persisted aliases and cross-script/name signals remain necessary: known Red/Reddington, title/full-name and learned misspelling aliases resolve without requiring cosine. Unknown aliases may remain separate until identity is established; false-positive person merges are more costly than those false negatives.

`tests/graph/identity-calibration.test.js` replays the measured hard-negative scores through the actual merge guard and verifies deterministic known-alias resolution. Existing graph tests cover cross-script and name-signal behavior. The independent model card specifies Qwen3 last-token pooling and normalized output: https://huggingface.co/onnx-community/Qwen3-Embedding-0.6B-ONNX .

A name-only exploratory run also showed overlapping positive/negative distributions; it is not used for the production-shaped operating-point selection. Full SillyTavern host interaction was not run because the configured localhost:8000 server was unavailable. The hardware/model check is isolated from host integration tests.
