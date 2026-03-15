import * as en from './en.js';
import * as ru from './ru.js';

const langs = { en, ru };

/**
 * Get examples for a specific sub-type and language.
 * @param {'COMMUNITIES'|'GLOBAL_SYNTHESIS'} type - Example sub-type
 * @param {'auto'|'en'|'ru'} [language='auto'] - Language filter
 * @returns {Array} Filtered examples
 */
export function getExamples(type, language = 'auto') {
    if (language !== 'auto') return langs[language]?.[type] || [];
    return [...(en[type] || []), ...(ru[type] || [])];
}
