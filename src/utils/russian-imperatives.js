/**
 * Russian Imperative Verb Detection
 *
 * Prevents imperative verbs (capitalized at sentence start) from being
 * extracted as entities in Cyrillic text. Two-layer approach:
 *   1. Known imperatives set — O(1) lookup for common verbs
 *   2. Suffix heuristic — catches unlisted imperatives by morphology
 */

// Common Russian imperative verbs (2nd person singular/plural, perfective/imperfective)
export const RUSSIAN_IMPERATIVES = new Set([
    'Давай',
    'Слушай',
    'Посмотри',
    'Скажи',
    'Запомни',
    'Держись',
    'Покажи',
    'Расскажи',
    'Подожди',
    'Смотри',
    'Иди',
    'Стой',
    'Помоги',
    'Объясни',
    'Дай',
    'Сделай',
    'Найди',
    'Открой',
    'Закрой',
    'Подойди',
    'Возьми',
    'Брось',
    'Остановись',
    'Успокойся',
    'Послушай',
    'Отойди',
    'Отпусти',
    'Ответь',
    'Подними',
    'Опусти',
]);

// Productive imperative suffixes (ordered longest-first for correct matching)
const IMPERATIVE_SUFFIXES = ['айте', 'яйте', 'ейте', 'ойте', 'ите', 'ись', 'ай', 'яй', 'ей', 'ой'];

/**
 * Check if a Cyrillic word is likely an imperative verb.
 * @param {string} word - Original-case word (e.g. "Запомни")
 * @returns {boolean}
 */
export function isLikelyImperative(word) {
    if (RUSSIAN_IMPERATIVES.has(word)) return true;
    const lower = word.toLowerCase();
    // Only short conversational words — long words are more likely nouns/proper names
    if (lower.length > 10) return false;
    return IMPERATIVE_SUFFIXES.some((s) => lower.endsWith(s));
}
