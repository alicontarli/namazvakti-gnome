import { parseTimeToMinutes } from './formatter.js';
import { PRAYERS } from './constants.js';

// API keys to internal prayer keys mapping
export const API_MAP = {
    imsak: 'Fajr',
    gunes: 'Sunrise',
    ogle: 'Dhuhr',
    ikindi: 'Asr',
    aksam: 'Maghrib',
    yatsi: 'Isha'
};

/**
 * Gets adjusted prayer times in minutes from midnight.
 * @param {object} timings - Raw API timings object, e.g. { Fajr: "03:32", ... }
 * @param {object} adjustments - Map of offsets in minutes, e.g. { imsak: 0, ... }
 * @returns {object} Map of internal prayer keys to adjusted minutes
 */
export function getAdjustedPrayerTimes(timings, adjustments = {}) {
    const result = {};
    for (const key of PRAYERS) {
        const apiKey = API_MAP[key];
        const timeStr = timings[apiKey];
        const baseMinutes = parseTimeToMinutes(timeStr);
        const offset = adjustments[`${key}-adjustment`] || 0;
        // Apply adjustment and ensure it wraps around 24 hours
        result[key] = (baseMinutes + offset + 1440) % 1440;
    }
    return result;
}

/**
 * Calculates the next prayer and remaining time in minutes.
 * @param {Date} nowDate - Current local time
 * @param {object} todayTimings - Today's raw timings
 * @param {object} tomorrowTimings - Tomorrow's raw timings (required for after-Yatsi calculation)
 * @param {object} adjustments - Minute adjustments
 * @param {boolean} showImsak - Whether Imsak is counted as a next prayer candidate
 * @param {boolean} showGunes - Whether Gunes is counted as a next prayer candidate
 * @returns {object} { key, remainingMinutes, targetMinutes, isTomorrow }
 */
export function getNextPrayer(nowDate, todayTimings, tomorrowTimings, adjustments = {}, showImsak = true, showGunes = true) {
    if (!todayTimings) return null;

    const todayAdjusted = getAdjustedPrayerTimes(todayTimings, adjustments);
    const tomorrowAdjusted = tomorrowTimings ? getAdjustedPrayerTimes(tomorrowTimings, adjustments) : null;

    const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
    
    // Create candidate lists
    const candidates = [];

    // Helper to add candidates for a specific base offset (0 for today, 1440 for tomorrow)
    const addCandidates = (adjustedTimes, baseOffset, isTomorrowVal) => {
        for (const key of PRAYERS) {
            if (key === 'imsak' && !showImsak) continue;
            if (key === 'gunes' && !showGunes) continue;
            
            candidates.push({
                key,
                absoluteMinutes: baseOffset + adjustedTimes[key],
                targetMinutes: adjustedTimes[key],
                isTomorrow: isTomorrowVal
            });
        }
    };

    // Add today's candidates
    addCandidates(todayAdjusted, 0, false);

    // Add tomorrow's candidates
    if (tomorrowAdjusted) {
        addCandidates(tomorrowAdjusted, 1440, true);
    }

    // Sort candidates chronologically
    candidates.sort((a, b) => a.absoluteMinutes - b.absoluteMinutes);

    // Find the first candidate that is in the future
    for (const candidate of candidates) {
        if (candidate.absoluteMinutes > nowMinutes) {
            return {
                key: candidate.key,
                remainingMinutes: candidate.absoluteMinutes - nowMinutes,
                targetMinutes: candidate.targetMinutes,
                isTomorrow: candidate.isTomorrow
            };
        }
    }

    // Fallback: If no candidate found (e.g. tomorrowTimings wasn't loaded yet),
    // wrap around to the first candidate of today (acting as if it is tomorrow)
    if (candidates.length > 0) {
        const first = candidates[0];
        return {
            key: first.key,
            remainingMinutes: (1440 - nowMinutes) + first.targetMinutes,
            targetMinutes: first.targetMinutes,
            isTomorrow: true
        };
    }

    return null;
}
