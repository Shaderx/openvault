/**
 * OpenVault Unified Stopword Module
 *
 * Single source of truth for all stopword filtering.
 * Imports base stopwords from 'stopword' package (EN + RU).
 * Adds custom words for graph merging and query context.
 */

import { eng, rus } from 'https://esm.sh/stopword';

// Core stopwords from package (EN + RU)
const BASE_STOPWORDS = new Set([...eng, ...rus]);

// Graph entity merging - generic terms that shouldn't block merging
const GRAPH_CUSTOM = new Set([
    // Articles & determiners
    'the',
    'a',
    'an',
    'this',
    'that',
    'these',
    'those',
    // Colors
    'red',
    'blue',
    'green',
    'yellow',
    'black',
    'white',
    'burgundy',
    'dark',
    'light',
    // Sizes & generic descriptors
    'large',
    'small',
    'big',
    // Common adjectives
    'old',
    'new',
    'young',
    'first',
    'last',
    'other',
]);

// Query context - sentence starters and discourse markers
const QUERY_STARTERS = new Set([
    // Latin (English) starters
    'The',
    'This',
    'That',
    'Then',
    'There',
    'When',
    'Where',
    'What',
    'Which',
    'While',
    'Since',
    'Because',
    'Although',
    'However',
    'Therefore',
    'Moreover',
    'Furthermore',
    'These',
    'Those',
    'Who',
    'Why',
    'How',
    'Here',
    'Now',
    'Just',
    'But',
    'And',
    'Yet',
    'Still',
    'Also',
    'Only',
    'Even',
    'Well',
    'Much',
    'Very',
    'Some',
    // Cyrillic (Russian) starters
    'После',
    'Когда',
    'Потом',
    'Затем',
    'Тогда',
    'Здесь',
    'Там',
    'Это',
    'Эта',
    'Этот',
    'Эти',
    'Что',
    'Как',
    'Где',
    'Куда',
    'Почему',
    'Зачем',
    'Кто',
    'Чей',
    'Какой',
    'Какая',
    'Какое',
    'Пока',
    'Если',
    'Хотя',
    'Также',
    'Ещё',
    'Уже',
    'Вот',
    'Вон',
    // Interjections & filler words
    'Ага',
    'Угу',
    'Ого',
    'Ура',
    'Хм',
    'Ну',
    // Affirmations, negations, casual
    'Да',
    'Нет',
    'Ладно',
    'Хорошо',
    'Ок',
    // Expletives (common in RP)
    'Блин',
    'Блять',
    'Бля',
    // Discourse markers
    'Значит',
    'Типа',
    'Короче',
    'Просто',
    'Конечно',
    'Наверное',
    'Возможно',
    'Может',
    // Informal speech common in RP
    'Воны',
    'Чё',
    'Чо',
    'Ваще',
    'Щас',
]);

// Unified export - lowercase for case-insensitive matching
export const ALL_STOPWORDS = new Set([
    ...[...BASE_STOPWORDS].map((w) => w.toLowerCase()),
    ...[...GRAPH_CUSTOM].map((w) => w.toLowerCase()),
    ...[...QUERY_STARTERS].map((w) => w.toLowerCase()),
]);

// Re-export utility function from package
export { removeStopwords } from 'https://esm.sh/stopword';
