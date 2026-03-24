import { readdirSync, readFileSync, statSync } from 'fs';
import { extname, join } from 'path';

const _JSDOC_RE = /\/\*\*[\s\S]*?\*\//g;

function checkFile(filepath) {
    const src = readFileSync(filepath, 'utf8');
    const lines = src.split('\n');
    const issues = [];

    // Track brace depth to detect when we're inside a class
    let braceDepth = 0;
    const lineDepths = lines.map((line) => {
        const openBraces = (line.match(/\{/g) || []).length;
        const closeBraces = (line.match(/\}/g) || []).length;
        const depth = braceDepth;
        braceDepth += openBraces - closeBraces;
        return { depth, line };
    });

    // Find all /** */ block positions
    let match;
    const blocks = [];
    const re = /\/\*\*[\s\S]*?\*\//g;
    while ((match = re.exec(src)) !== null) {
        const startLine = src.slice(0, match.index).split('\n').length;
        const endLine = startLine + match[0].split('\n').length - 1;
        blocks.push({ start: startLine, end: endLine, text: match[0] });
    }

    for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];

        // Skip single-line JSDoc annotations (e.g., /** @type {Foo} */)
        if (b.start === b.end) continue;

        const nextLineIdx = b.end;
        const nextLine = (lines[nextLineIdx] || '').trim();

        // Check if we're inside a class body by looking at depth at block start
        // A class body typically has depth >= 1 (inside the class braces)
        const depthAtBlockStart = lineDepths[b.start - 1]?.depth || 0;
        const inClassBody = depthAtBlockStart >= 1;

        // Double JSDoc: two consecutive multi-line JSDoc blocks
        // Skip if inside class body (method docs are expected to be consecutive)
        // Also skip if the line between is a class declaration (class JSDoc + method JSDoc pattern)
        if (blocks[i + 1] && !inClassBody) {
            const nextBlock = blocks[i + 1];
            const isMultiLine = b.start !== b.end;
            const nextIsMultiLine = nextBlock.start !== nextBlock.end;
            if (isMultiLine && nextIsMultiLine && nextBlock.start <= b.end + 2) {
                // Check if the line between is a class declaration
                const lineBetween = (lines[b.end] || '').trim();
                const isClassDeclaration = /^class\s+\w+/.test(lineBetween);
                if (!isClassDeclaration) {
                    issues.push(`${filepath}:${b.start} — consecutive JSDoc blocks`);
                }
            }
        }

        // Orphaned JSDoc: not followed by a declaration
        const isDeclaration =
            // Export/async function/class/const/etc
            /^(export\s+)?(async\s+)?(function|class|const|let|var|type|interface|\*)/.test(nextLine) ||
            // Method declarations (async methodName, *generator, [computed], get/set getterSetter)
            /^(async\s+)?(\*\s*)?[[\w$]/.test(nextLine) ||
            // Arrow functions assigned to const/let/var (next line check won't catch this well, but try)
            /^(const|let|var)\s+\w+\s*=/.test(nextLine) ||
            // End of file - JSDoc at EOF is orphaned
            nextLine === '';

        if (!isDeclaration && !inClassBody) {
            issues.push(`${filepath}:${b.start} — JSDoc not followed by declaration (got: "${nextLine.slice(0, 60)}")`);
        }
    }

    return issues;
}

function walk(dir) {
    const results = [];
    for (const f of readdirSync(dir)) {
        const full = join(dir, f);
        if (statSync(full).isDirectory() && !f.startsWith('.') && f !== 'node_modules') {
            results.push(...walk(full));
        } else if (['.ts', '.tsx', '.js', '.jsx', '.mjs'].includes(extname(f))) {
            results.push(full);
        }
    }
    return results;
}

const files = walk('./src');
const all = files.flatMap(checkFile);
if (all.length) {
    console.error(all.join('\n'));
    process.exit(1);
}
console.log('JSDoc check passed.');
