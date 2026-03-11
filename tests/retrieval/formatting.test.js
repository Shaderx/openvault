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
