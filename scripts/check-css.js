/**
 * Dead-CSS checker — reports CSS classes not referenced in JS/HTML.
 * Zero dependencies. Exit 1 if unused classes found.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const CSS_DIR = join(ROOT, 'css');

// ── Collect all source text (JS + HTML) ──────────────────
function collectSourceText() {
    const chunks = [];

    // index.js
    chunks.push(readFileSync(join(ROOT, 'index.js'), 'utf8'));

    // src/**/*.js (recursive)
    const walkJs = (dir) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const full = join(dir, entry.name);
            if (entry.isDirectory()) walkJs(full);
            else if (entry.name.endsWith('.js')) chunks.push(readFileSync(full, 'utf8'));
        }
    };
    walkJs(join(ROOT, 'src'));

    // templates/**/*.html (recursive)
    const walkHtml = (dir) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const full = join(dir, entry.name);
            if (entry.isDirectory()) walkHtml(full);
            else if (entry.name.endsWith('.html')) chunks.push(readFileSync(full, 'utf8'));
        }
    };
    walkHtml(join(ROOT, 'templates'));

    return chunks.join('\n');
}

// ── Extract class selectors from CSS files ───────────────
function extractCssClasses() {
    const classes = new Set();
    const classRe = /\.([a-zA-Z_][a-zA-Z0-9_-]*)/g;

    // Selectors to skip (framework/theme classes, not ours to track)
    const skip = new Set([
        'active',
        'open',
        'selected',
        'success',
        'error',
        'ready',
        'extracting',
        'retrieving',
        'loading',
        'webgpu',
        'wasm',
        'working',
        'action',
        'revelation',
        'emotion_shift',
        'relationship_change',
        'person',
        'place',
        'organization',
        'object',
        'concept',
        'importance',
        'witness',
        'location',
        'reflection',
        'evidence',
        'stat-icon',
        'stat-value',
        'stat-label',
        'text_pole',
        'checkbox_label',
        'menu_button',
        'inline-drawer-header',
    ]);

    for (const file of readdirSync(CSS_DIR)) {
        if (!file.endsWith('.css')) continue;
        const css = readFileSync(join(CSS_DIR, file), 'utf8');
        let m;
        while ((m = classRe.exec(css)) !== null) {
            const cls = m[1];
            if (!skip.has(cls)) classes.add(cls);
        }
    }
    return classes;
}

// ── Main ─────────────────────────────────────────────────
const source = collectSourceText();
const classes = extractCssClasses();
const unused = [];

for (const cls of classes) {
    if (!source.includes(cls)) {
        unused.push(cls);
    }
}

if (unused.length > 0) {
    console.error(`Dead CSS: ${unused.length} class(es) not referenced in JS/HTML:`);
    for (const cls of unused.sort()) {
        console.error(`  .${cls}`);
    }
    process.exit(1);
} else {
    console.log(`CSS check passed: all ${classes.size} tracked classes are referenced.`);
}
