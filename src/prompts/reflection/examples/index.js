import * as en from './en.js';
import * as ru from './ru.js';

/**
 * Get examples for a specific sub-type and language.
 * @param {'REFLECTIONS'} type - Example sub-type
 * @param {'auto'|'en'|'ru'} [language='auto'] - Language filter
 * @returns {Array} Filtered examples
 */
export function getExamples(type, language = 'auto') {
    if (language === 'en') return en.REFLECTIONS || [];
    if (language === 'ru') return ru.REFLECTIONS || [];
    // Auto: merge both languages
    return [...(en.REFLECTIONS || []), ...(ru.REFLECTIONS || [])];
}
