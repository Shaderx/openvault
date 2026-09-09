import { afterEach, describe, expect, it } from 'vitest';
import {
    _setCdnWarningLogger,
    _setTestImporter,
    _setTestOverride,
    cdnImport,
    getCdnUrls,
    resolveVersion,
} from '../../src/utils/cdn.js';

afterEach(() => {
    _setTestImporter(null);
    _setCdnWarningLogger(null);
});

describe('cdnImport package pinning', () => {
    it.each([
        ['zod', 'zod@4.3.6'],
        ['gpt-tokenizer/encoding/o200k_base', 'gpt-tokenizer@3.4.0/encoding/o200k_base'],
        ['@huggingface/transformers', '@huggingface/transformers@4.0.1'],
        ['@huggingface/transformers/tokenizers', '@huggingface/transformers@4.0.1/tokenizers'],
    ])('resolves %s to %s', (packageSpec, expected) => {
        expect(resolveVersion(packageSpec)).toBe(expected);
    });

    it('keeps scoped bare-spec overrides network-free', async () => {
        const module = { pipeline: 'test-pipeline' };
        _setTestOverride('@huggingface/transformers', module);
        await expect(cdnImport('@huggingface/transformers')).resolves.toBe(module);
    });

    it('requests the scoped transformer pin on every mirror without network access', async () => {
        const attemptedUrls = [];
        _setCdnWarningLogger(() => {});
        _setTestImporter(async (url) => {
            attemptedUrls.push(url);
            throw new Error('offline test importer');
        });

        await expect(cdnImport('@huggingface/transformers/tokenizers')).rejects.toThrow('after 2 rounds');

        expect(attemptedUrls).toHaveLength(8);
        expect(attemptedUrls).toEqual(
            getCdnUrls('@huggingface/transformers/tokenizers').concat(
                getCdnUrls('@huggingface/transformers/tokenizers')
            )
        );
        expect(attemptedUrls.every((url) => url.includes('@huggingface/transformers@4.0.1/tokenizers'))).toBe(true);
    });
});
