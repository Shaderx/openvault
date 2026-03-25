// @ts-check
import { describe, it, expect } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');

describe('generate-types script', () => {
    it('should generate a types.d.ts file', async () => {
        const typesPath = path.join(PROJECT_ROOT, 'src/types.d.ts');

        // Check file exists
        const stats = await fs.stat(typesPath).catch(() => null);
        expect(stats).toBeTruthy();
        expect(stats?.isFile()).toBe(true);
    });

    it('should contain generated type definitions', async () => {
        const typesPath = path.join(PROJECT_ROOT, 'src/types.d.ts');
        const content = await fs.readFile(typesPath, 'utf-8');

        // Check for auto-generated marker
        expect(content).toContain('AUTO-GENERATED');

        // Check for key types
        expect(content).toContain('export type Memory');
        expect(content).toContain('export type GraphNode');
        expect(content).toContain('export type GraphEdge');
        expect(content).toContain('export type Entity');
        expect(content).toContain('export type Relationship');
    });

    it('should NOT contain | "Unknown" unions from .catch() fallbacks', async () => {
        const typesPath = path.join(PROJECT_ROOT, 'src/types.d.ts');
        const content = await fs.readFile(typesPath, 'utf-8');

        // Entity type should have clean string type, not string | "Unknown"
        const entityMatch = content.match(/export type Entity[\s\S]*?^export type/m);
        if (entityMatch) {
            expect(entityMatch[0]).not.toContain('"Unknown"');
        }
    });
});
