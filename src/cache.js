import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

/**
 * Returns the Gio.File cache directory for saving daily prayer timings.
 * @returns {Gio.File}
 */
function getCacheDirectory() {
    const cacheDir = GLib.get_user_cache_dir();
    const dir = Gio.File.new_for_path(GLib.build_filenamev([cacheDir, 'namaz-vakti-gnome']));
    if (!dir.query_exists(null)) {
        try {
            dir.make_directory_with_parents(null);
        } catch (e) {
            console.error('Failed to create cache directory:', e.message);
        }
    }
    return dir;
}

/**
 * Checks if the cached settings match the current extension settings.
 * @param {object} cacheSettings 
 * @param {object} currentSettings 
 * @returns {boolean}
 */
function settingsMatch(cacheSettings, currentSettings) {
    if (!cacheSettings || !currentSettings) return false;
    
    // Core parameters must match
    if (cacheSettings.locationMode !== currentSettings.locationMode ||
        cacheSettings.method !== currentSettings.method ||
        cacheSettings.school !== currentSettings.school) {
        return false;
    }
    
    if (cacheSettings.locationMode === 'city') {
        const cCity = (currentSettings.city || '').trim().toLowerCase();
        const cCountry = (currentSettings.country || '').trim().toLowerCase();
        const cacheCity = (cacheSettings.city || '').trim().toLowerCase();
        const cacheCountry = (cacheSettings.country || '').trim().toLowerCase();
        return cCity === cacheCity && cCountry === cacheCountry;
    } else {
        const diffLat = Math.abs(cacheSettings.latitude - currentSettings.latitude);
        const diffLng = Math.abs(cacheSettings.longitude - currentSettings.longitude);
        // Match within ~100 meters tolerance
        return diffLat < 0.001 && diffLng < 0.001;
    }
}

/**
 * Saves monthly calendar data to cache file asynchronously.
 * @param {number} year 
 * @param {number} month 
 * @param {object} settings 
 * @param {object} data 
 * @returns {Promise<void>}
 */
export function saveToCache(year, month, settings, data) {
    return new Promise((resolve) => {
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
            const encoder = new TextEncoder();
            const bytes = encoder.encode(jsonString);
            const gBytes = GLib.Bytes.new(bytes);

            file.replace_contents_async(
                gBytes,
                null,
                false,
                Gio.FileCreateFlags.NONE,
                null,
                (fileObj, res) => {
                    try {
                        fileObj.replace_contents_finish(res);
                    } catch (e) {
                        console.error('Failed to finish cache writing:', e.message);
                    }
                    resolve();
                }
            );
        } catch (e) {
            console.error('Failed to start cache writing:', e.message);
            resolve();
        }
    });
}

/**
 * Loads cached monthly data asynchronously if settings match and file exists.
 * @param {number} year 
 * @param {number} month 
 * @param {object} currentSettings 
 * @returns {Promise<object|null>}
 */
export function loadFromCache(year, month, currentSettings) {
    return new Promise((resolve) => {
        try {
            const dir = getCacheDirectory();
            const filename = `calendar_${year}_${month.toString().padStart(2, '0')}.json`;
            const file = dir.get_child(filename);

            // Read asynchronously (handles file not found or reading failures as exceptions)
            file.load_contents_async(null, (fileObj, res) => {
                try {
                    const [success, contents] = fileObj.load_contents_finish(res);
                    if (!success) {
                        resolve(null);
                        return;
                    }
                    const decoder = new TextDecoder('utf-8');
                    const text = decoder.decode(contents);
                    const payload = JSON.parse(text);
                    
                    if (settingsMatch(payload.settings, currentSettings)) {
                        resolve(payload.data);
                    } else {
                        resolve(null);
                    }
                } catch (e) {
                    // Resolve null on any errors (e.g. file does not exist, parse errors)
                    resolve(null);
                }
            });
        } catch (e) {
            resolve(null);
        }
    });
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
        console.error('Failed to clear cache directory:', e.message);
    }
}
