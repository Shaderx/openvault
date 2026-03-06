import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetDeps, setDeps } from '../../src/deps.js';
import { escapeHtml, showToast } from '../../src/utils/dom.js';

describe('dom', () => {
    afterEach(() => resetDeps());

    describe('escapeHtml', () => {
        it('escapes HTML special characters', () => {
            expect(escapeHtml('<script>alert("xss")</script>')).toBe(
                '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
            );
        });

        it('escapes ampersands', () => {
            expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
        });

        it('escapes single quotes', () => {
            expect(escapeHtml("it's")).toBe('it&#039;s');
        });

        it('returns empty string for falsy input', () => {
            expect(escapeHtml(null)).toBe('');
            expect(escapeHtml(undefined)).toBe('');
            expect(escapeHtml('')).toBe('');
        });

        it('converts numbers to string', () => {
            expect(escapeHtml(123)).toBe('123');
        });
    });

    describe('showToast', () => {
        it('delegates to deps.showToast', () => {
            const mockShowToast = vi.fn();
            setDeps({ showToast: mockShowToast });

            showToast('success', 'Test message', 'Title', { timeout: 1000 });
            expect(mockShowToast).toHaveBeenCalledWith('success', 'Test message', 'Title', { timeout: 1000 });
        });
    });
});
