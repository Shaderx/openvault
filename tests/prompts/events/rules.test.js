import { describe, expect, it } from 'vitest';
import { EVENT_RULES } from '../../../src/prompts/events/rules.js';

describe('events/rules', () => {
    it('should include Commitments & Rules in precision section', () => {
        expect(EVENT_RULES).toContain('Commitments & Rules:');
        expect(EVENT_RULES).toContain('exact promise, schedule, boundary');
    });

    it('should include Preferences in precision section', () => {
        expect(EVENT_RULES).toContain('Preferences:');
        expect(EVENT_RULES).toContain('like, dislike, or require');
    });

    it('should include vagueness blacklist entries for commitments', () => {
        expect(EVENT_RULES).toContain('"they made a promise"');
        expect(EVENT_RULES).toContain('"rules were discussed"');
    });

    describe('importance scale', () => {
        it('should include durability-framed importance scale', () => {
            expect(EVENT_RULES).toContain('<importance_scale>');
            expect(EVENT_RULES).toContain('</importance_scale>');
            expect(EVENT_RULES).toContain('durable — they matter for future interactions');
        });

        it('should demote momentary actions in importance scale', () => {
            expect(EVENT_RULES).toContain('A goodbye kiss or a one-time compliment is 2');
            expect(EVENT_RULES).toContain('it matters now but not next week');
        });

        it('should explicitly name stated preferences at importance 3', () => {
            expect(EVENT_RULES).toContain('Stated preferences (likes/dislikes)');
            expect(EVENT_RULES).toContain('everyday promises');
        });

        it('should explicitly name boundaries at importance 4', () => {
            expect(EVENT_RULES).toContain('Hard boundaries established');
            expect(EVENT_RULES).toContain('strict ongoing rules agreed upon');
        });
    });

    describe('thinking process', () => {
        it('should include promises and preferences in thinking Step 1', () => {
            expect(EVENT_RULES).toContain('promises, stated preferences, or ongoing rules');
        });
    });
});
