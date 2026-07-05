import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const CACHE_DIR_NAME = 'namazvaktignome';

/**
 * Returns the Gio.File pointing to the cache directory and creates it if it doesn't exist.
 * @returns {Gio.File} Cache directory file object
 */
function getCacheDirectory() {
    const cacheDir = GLib.build_filenamev([GLib.get_user_cache_dir(), CACHE_DIR_NAME]);
    const dir = Gio.File.new_for_path(cacheDir);
    if (!dir.query_exists(null)) {
        try {
            dir.make_directory_with_parents(null);
        } catch (e) {
            console.error('Failed to create cache directory:', e);
        }
    }
    return dir;
}

/**
 * Compares cached settings with current settings to verify validity.
 * @param {object} cacheSettings 
 * @param {object} currentSettings 
 * @returns {boolean} True if they match
 */
function settingsMatch(cacheSettings, currentSettings) {
    if (!cacheSettings || !currentSettings) return false;
    if (cacheSettings.locationMode !== currentSettings.locationMode) return false;
    if (cacheSettings.method !== currentSettings.method) return false;
    if (cacheSettings.school !== currentSettings.school) return false;

    if (currentSettings.locationMode === 'city') {
        const cCity = (currentSettings.city || '').trim().toLowerCase();
        const cCountry = (currentSettings.country || '').trim().toLowerCase();
        const cacheCity = (cacheSettings.city || '').trim().toLowerCase();
        const cacheCountry = (cacheSettings.country || '').trim().toLowerCase();
        return cCity === cacheCity && cCountry === cacheCountry;
    } else {
        const diffLat = Math.abs(cacheSettings.latitude - currentSettings.latitude);
        const diffLng = Math.abs(cacheSettings.longitude - currentSettings.longitude);
        // Match within ~100 meters tolerance to avoid minor floating point representation differences
        return diffLat < 0.001 && diffLng < 0.001;
    }
}

/**
 * Saves monthly calendar data to cache file.
 * @param {number} year 
 * @param {number} month 
 * @param {object} settings 
 * @param {object} data 
 */
export function saveToCache(year, month, settings, data) {
    try {
        const dir = getCacheDirectory();
        const filename = `calendar_${year}_${month.toString().padStart(2, '0')}.json`;
        const file = dir.get_child(filename);
        
        const payload = {
            settings: {
                locationMode: settings.locationMode,
                city: settings.city,
                country: settings.country,
                latitude: settings.latitude,
                longitude: settings.longitude,
                method: settings.method,
                school: settings.school
            },
            data
        };

        const jsonString = JSON.stringify(payload, null, 2);
        
        // Write file synchronously using Gio
        const outputStream = file.replace(null, false, Gio.FileCreateFlags.NONE, null);
        outputStream.write_all(jsonString, null);
        outputStream.close(null);
    } catch (e) {
        console.error(`Failed to save cache for ${year}-${month}:`, e);
    }
}

/**
 * Loads cached monthly data if settings match and file exists.
 * @param {number} year 
 * @param {number} month 
 * @param {object} currentSettings 
 * @returns {object|null} The cached data array or null
 */
export function loadFromCache(year, month, currentSettings) {
    try {
        const dir = getCacheDirectory();
        const filename = `calendar_${year}_${month.toString().padStart(2, '0')}.json`;
        const file = dir.get_child(filename);
        
        if (!file.query_exists(null)) {
            return null;
        }

        const [success, contents] = file.load_contents(null);
        if (!success) {
            return null;
        }

        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(contents);
        const payload = JSON.parse(text);

        if (settingsMatch(payload.settings, currentSettings)) {
            return payload.data;
        } else {
            return null; // Cache invalidated due to settings mismatch
        }
    } catch (e) {
        console.error(`Failed to load cache for ${year}-${month}:`, e);
        return null;
    }
}

/**
 * Clears all cached files in the cache directory.
 */
export function clearAllCache() {
    try {
        const dir = getCacheDirectory();
        const enumerator = dir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
        let info;
        while ((info = enumerator.next_file(null)) !== null) {
            const child = dir.get_child(info.get_name());
            child.delete(null);
        }
    } catch (e) {
        console.error('Failed to clear cache:', e);
    }
}
