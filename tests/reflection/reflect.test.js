import { describe, it, expect, beforeEach } from 'vitest';
import { accumulateImportance, shouldReflect } from '../../src/reflection/reflect.js';

describe('accumulateImportance', () => {
    let reflectionState;

    beforeEach(() => {
        reflectionState = {};
    });

    it('accumulates importance from event characters_involved', () => {
        const events = [
            { importance: 4, characters_involved: ['Alice', 'Bob'], witnesses: [] },
            { importance: 2, characters_involved: ['Alice'], witnesses: [] },
        ];
        accumulateImportance(reflectionState, events);
        expect(reflectionState['Alice'].importance_sum).toBe(6);
        expect(reflectionState['Bob'].importance_sum).toBe(4);
    });

    it('accumulates importance from witnesses too', () => {
        const events = [
            { importance: 3, characters_involved: ['Alice'], witnesses: ['Charlie'] },
        ];
        accumulateImportance(reflectionState, events);
        expect(reflectionState['Charlie'].importance_sum).toBe(3);
    });

    it('adds to existing importance_sum', () => {
        reflectionState['Alice'] = { importance_sum: 10 };
        const events = [
            { importance: 5, characters_involved: ['Alice'], witnesses: [] },
        ];
        accumulateImportance(reflectionState, events);
        expect(reflectionState['Alice'].importance_sum).toBe(15);
    });
});

describe('shouldReflect', () => {
    it('returns true when importance_sum >= 30', () => {
        const state = { 'Alice': { importance_sum: 30 } };
        expect(shouldReflect(state, 'Alice')).toBe(true);
    });

    it('returns true when importance_sum > 30', () => {
        const state = { 'Alice': { importance_sum: 45 } };
        expect(shouldReflect(state, 'Alice')).toBe(true);
    });

    it('returns false when importance_sum < 30', () => {
        const state = { 'Alice': { importance_sum: 29 } };
        expect(shouldReflect(state, 'Alice')).toBe(false);
    });

    it('returns false when character not in state', () => {
        expect(shouldReflect({}, 'Unknown')).toBe(false);
    });
});
