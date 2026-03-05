TL;DR: Use **[`stopword`](pplx://action/navigate/93b78ad9d5a455e6)** — it covers 62 languages including EN and RU, works in Node and browser, zero hardcoding needed.

## Recommended: `stopword`

```bash
npm install stopword
```

It exports per-language arrays via ISO 639-3 codes. For your EN+RU case:[1]

```js
import { removeStopwords, eng, rus } from 'stopword'

// Combined EN+RU filtering (spread syntax merges lists)
const combined = [...eng, ...rus]

function filterTokens(tokens) {
  return removeStopwords(tokens, combined)
}
```

This handles mixed-language text naturally since the combined list covers both alphabets.[2]

## Alternatives

| Package | Languages | Notes |
|---|---|---|
| [`stopword`](pplx://action/navigate/93b78ad9d5a455e6) | 62 | Node + browser, ESM/CJS, actively maintained [1] |
| [`stopwords-iso`](pplx://action/navigate/4a0c0543c34437a3) | 50+ | JSON format, good for custom pipelines [3] |
| [`stopwords-json`](pplx://action/navigate/a67406a24278acb3) | 50 | Static JSON, no utility functions [4] |

## Integration Note for Your BM25 Pipeline

Since your retrieval stack already uses BM25 scoring, plug `stopword` at tokenization time — before computing term frequencies. Pass `[...eng, ...rus]` as the combined list. If your graph surfaces domain-specific noise tokens (e.g. character names, shop department names from the logs), append a `customStopwords` array via the same spread pattern  — no hardcoding required, just a config array.[2]

---

import { removeStopwords, eng, rus } from 'https://esm.sh/stopword';
