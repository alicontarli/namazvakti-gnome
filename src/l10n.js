import GLib from 'gi://GLib';
import { LOCALES } from './locales.js';

/**
 * Creates a translator function `_` that supports user overrides and system detection.
 * @param {Gio.Settings|string|null} settingsOrLang - GSettings instance or language code
 * @returns {Function} Translator function (msgid -> msgstr)
 */
export function getTranslator(settingsOrLang) {
    let lang = 'auto';
    
    if (typeof settingsOrLang === 'string') {
        lang = settingsOrLang;
    } else if (settingsOrLang && typeof settingsOrLang.get_string === 'function') {
        try {
            lang = settingsOrLang.get_string('language');
        } catch (e) {
            lang = 'auto';
        }
    }
    
    if (lang === 'auto') {
        try {
            // GLib.get_language_names() returns list of user locales in priority order
            const systemLocales = GLib.get_language_names();
            for (const loc of systemLocales) {
                const shortLang = loc.split('_')[0].split('.')[0].toLowerCase();
                if (LOCALES[shortLang]) {
                    lang = shortLang;
                    break;
                }
            }
        } catch (e) {
            // Fallback for standalone GJS testing environments
            lang = 'en';
        }
        
        if (lang === 'auto') {
            lang = 'en';
        }
    }
    
    const catalog = LOCALES[lang] || {};
    
    return (str) => {
        return catalog[str] !== undefined ? catalog[str] : str;
    };
}
