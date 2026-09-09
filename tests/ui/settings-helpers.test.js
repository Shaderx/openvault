import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';

// Set up JSDOM
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;
global.window = dom.window;

// Mock console for logging
global.console = {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
};

// Mock jQuery
const mockJQuery = (selector) => {
    let element;
    if (typeof selector === 'string') {
        element = document.querySelector(selector);
    } else if (selector instanceof HTMLElement) {
        element = selector;
    } else {
        element = selector;
    }

    const $obj = {
        on: vi.fn(() => $obj),
        off: vi.fn(() => $obj),
        parent: vi.fn(() => $obj),
        appendTo: vi.fn((target) => {
            if (target === 'body' && element && !document.body.contains(element)) {
                document.body.appendChild(element);
            }
            return $obj;
        }),
        removeClass: vi.fn((cls) => {
            if (element) element.classList.remove(cls);
            return $obj;
        }),
        addClass: vi.fn((cls) => {
            if (element) element.classList.add(cls);
            return $obj;
        }),
        hasClass: vi.fn((cls) => element?.classList.contains(cls) || false),
    };

    return $obj;
};

mockJQuery.fn = {};
global.$ = mockJQuery;

describe('Emergency Cut Modal Helpers', () => {
    beforeEach(() => {
        // Reset body with modal elements
        document.body.innerHTML = `
            <div id="openvault_emergency_cut_modal" class="openvault-modal hidden">
                <div class="openvault-modal-content">
                    <button id="openvault_emergency_cancel">Cancel</button>
                </div>
            </div>
        `;
    });

    describe('showEmergencyCutModal', () => {
        it('appends modal to body and removes hidden class', async () => {
            const { showEmergencyCutModal } = await import('../../src/ui/settings.js');

            showEmergencyCutModal();

            // Verify modal is visible (hidden class removed)
            expect($('#openvault_emergency_cut_modal').hasClass('hidden')).toBe(false);

            // Verify modal is in body
            const modalElement = document.querySelector('#openvault_emergency_cut_modal');
            expect(document.body.contains(modalElement)).toBe(true);
        });
    });

    describe('hideEmergencyCutModal', () => {
        it('adds hidden class to modal', async () => {
            const { showEmergencyCutModal, hideEmergencyCutModal } = await import('../../src/ui/settings.js');

            showEmergencyCutModal();
            hideEmergencyCutModal();

            expect($('#openvault_emergency_cut_modal').hasClass('hidden')).toBe(true);
        });

        it('restores focus to the control that opened the modal', async () => {
            const { showEmergencyCutModal, hideEmergencyCutModal } = await import('../../src/ui/settings.js');
            const trigger = document.createElement('button');
            document.body.appendChild(trigger);
            trigger.focus();

            showEmergencyCutModal();
            hideEmergencyCutModal();

            expect(document.activeElement).toBe(trigger);
        });
    });
});

describe('compaction blocker messages', () => {
    it('identifies the first unprocessed message', async () => {
        const { formatCompactionBlockMessage } = await import('../../src/ui/settings.js');

        expect(formatCompactionBlockMessage({ blocked: 'unprocessed_source', message_index: 4 })).toContain(
            'Message 5'
        );
    });

    it('reports uncovered archive sources with their first position', async () => {
        const { formatCompactionBlockMessage } = await import('../../src/ui/settings.js');
        const message = formatCompactionBlockMessage({
            blocked: 'coverage_incomplete',
            uncovered_messages: 3,
            first_message_index: 7,
        });

        expect(message).toContain('3 message(s)');
        expect(message).toContain('message 8');
    });
});
