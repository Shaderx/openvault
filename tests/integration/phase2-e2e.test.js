import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDeps } from '../../src/deps.js';
import { generateGlobalWorldState } from '../../src/graph/communities.js';
import { retrieveWorldContext } from '../../src/retrieval/world-context.js';

const mockCallLLM = vi.fn();
vi.mock('../../src/llm.js', () => ({
    callLLM: (...args) => mockCallLLM(...args),
    LLM_CONFIGS: {
        community: { profileSettingKey: 'extractionProfile' },
    },
}));

describe('Phase 2 integration', () => {
    beforeEach(() => {
        setupTestContext({
            deps: { Date: { now: () => 2000000 } },
        });
        mockCallLLM.mockReset();
    });

    afterEach(() => {
        resetDeps();
        vi.clearAllMocks();
    });

    it('connects global-state generation to macro-intent retrieval', async () => {
        const communities = [
            {
                title: 'The Love Triangle',
                status: 'active',
                summary: 'Alice betrayed Bob while secretly loving Charlie.',
                findings: ['Alice is torn', 'Bob suspects nothing'],
            },
        ];

        mockCallLLM.mockResolvedValue(
            JSON.stringify({
                global_summary:
                    'A love triangle with betrayal at its core. Alice betrayed Bob while loving Charlie, creating emotional tension that will inevitably explode.',
            })
        );

        const globalState = await generateGlobalWorldState(communities, 'auto', 'auto', '{');
        const worldContext = retrieveWorldContext(
            {},
            globalState,
            'What is the story so far?',
            new Float32Array([0.1]),
            2000
        );

        expect(worldContext.text).toContain('<world_context>');
        expect(worldContext.text).toContain('love triangle');
    });
});
