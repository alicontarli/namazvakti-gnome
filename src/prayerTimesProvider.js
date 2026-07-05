import Soup from 'gi://Soup';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { loadFromCache, saveToCache } from './cache.js';

const session = new Soup.Session();
session.timeout = 10; // 10 seconds timeout

/**
 * Direct API fetch helper for monthly calendar.
 * @param {number} year 
 * @param {number} month 
 * @param {object} settings 
 * @returns {Promise<object[]>} Resolves to the calendar data array
 */
export function fetchCalendar(year, month, settings) {
    return new Promise((resolve, reject) => {
        let url;
        const method = settings.method || '13';
        const school = settings.school || '1';
        
        if (settings.locationMode === 'coords') {
            const lat = settings.latitude;
            const lng = settings.longitude;
            url = `https://api.aladhan.com/v1/calendar/${year}/${month}?latitude=${lat}&longitude=${lng}&method=${method}&school=${school}`;
        } else {
            const city = encodeURIComponent(settings.city || 'İstanbul');
            const country = encodeURIComponent(settings.country || 'Turkey');
            url = `https://api.aladhan.com/v1/calendarByCity/${year}/${month}?city=${city}&country=${country}&method=${method}&school=${school}`;
        }

        const message = Soup.Message.new('GET', url);
        if (!message) {
            reject(new Error('Failed to create Soup message'));
            return;
        }

        session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
            try {
                const bytes = session.send_and_read_finish(result);
                if (message.status_code !== 200) {
                    reject(new Error(`API responded with status code ${message.status_code}`));
                    return;
                }
                const decoder = new TextDecoder('utf-8');
                const text = decoder.decode(bytes.toArray());
                const response = JSON.parse(text);
                if (response && response.code === 200 && response.data) {
                    resolve(response.data);
                } else {
                    reject(new Error('Invalid API response structure'));
                }
            } catch (e) {
                reject(e);
            }
        });
    });
}

/**
 * Returns prayer times for a given date, prioritizing cache, otherwise fetching from API.
 * @param {Date} date 
 * @param {object} settings 
 * @param {boolean} forceRefresh - If true, bypass cache and fetch from API
 * @returns {Promise<object>} Resolves to timings object (e.g. { Fajr: "03:32", ... })
 */
export async function getTimingsForDate(date, settings, forceRefresh = false) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // 1-indexed
    const day = date.getDate();

    let monthData = null;

    if (!forceRefresh) {
        monthData = await loadFromCache(year, month, settings);
    }

    if (!monthData) {
        console.log(`Cache miss/refresh for ${year}-${month}. Fetching from AlAdhan API...`);
        monthData = await fetchCalendar(year, month, settings);
        await saveToCache(year, month, settings, monthData);
    }

    if (monthData && monthData.length >= day) {
        const dayEntry = monthData[day - 1];
        if (dayEntry && parseInt(dayEntry.date.gregorian.day, 10) === day) {
            return dayEntry.timings;
        }
        // Fallback search if calendar array indices don't match for some reason
        const found = monthData.find(d => parseInt(d.date.gregorian.day, 10) === day);
        if (found) return found.timings;
    }

    throw new Error(`Timings for day ${day} not found in month data for ${year}-${month}`);
}
