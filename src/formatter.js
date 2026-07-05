/**
 * Positional string formatter. Replaces %1$s, %2$s, etc. with arguments.
 * Also supports simple %s replacing chronologically.
 * @param {string} template 
 * @param {...any} args 
 * @returns {string} Formatted string
 */
export function formatString(template, ...args) {
    if (!template) return '';
    let usedArgs = [...args];
    
    // Replace %1$s, %2$d, etc.
    let result = template.replace(/%(\d+)\$[sd]/g, (match, index) => {
        const idx = parseInt(index, 10) - 1;
        return usedArgs[idx] !== undefined ? usedArgs[idx] : match;
    });

    // Replace basic %s or %d
    result = result.replace(/%[sd]/g, () => {
        return usedArgs.shift();
    });

    return result;
}

/**
 * Parses a HH:MM time string into total minutes from midnight.
 * @param {string} timeStr - Time string like "13:14"
 * @returns {number} Minutes from midnight
 */
export function parseTimeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    if (parts.length < 2) return 0;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return 0;
    return h * 60 + m;
}

/**
 * Formats total minutes from midnight back to HH:MM (24h or 12h)
 * @param {number} totalMinutes 
 * @param {boolean} use24h 
 * @returns {string} Formatted time string
 */
export function formatTime(totalMinutes, use24h = true) {
    let h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    const mStr = m.toString().padStart(2, '0');
    
    if (use24h) {
        return `${h.toString().padStart(2, '0')}:${mStr}`;
    } else {
        const ampm = h >= 12 ? 'PM' : 'AM';
        let h12 = h % 12;
        if (h12 === 0) h12 = 12;
        return `${h12.toString().padStart(2, '0')}:${mStr} ${ampm}`;
    }
}

/**
 * Formats remaining minutes into localized duration description.
 * @param {Function} _ - Gettext translation function
 * @param {number} totalMinutes 
 * @returns {string}
 */
export function formatDurationText(_, totalMinutes) {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    
    if (h > 0) {
        return formatString(_('%1$d hour(s) %2$d minute(s)'), h, m);
    }
    return formatString(_('%1$d minute(s)'), m);
}

/**
 * Formats the top-panel timer display.
 * @param {Function} _ - Gettext translation function
 * @param {number} remainingMinutes 
 * @param {boolean} showHhMm - If true: "HH:MM", else: "MM min"
 * @returns {string}
 */
export function formatRemainingTime(_, remainingMinutes, showHhMm = true) {
    if (remainingMinutes < 0) remainingMinutes = 0;
    
    if (showHhMm) {
        const h = Math.floor(remainingMinutes / 60);
        const m = remainingMinutes % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    } else {
        return formatString(_('%1$d min'), remainingMinutes);
    }
}

/**
 * Formats the tooltip text.
 * @param {Function} _ - Gettext translation function
 * @param {string} nextPrayerLabel - Localized prayer name
 * @param {number} remainingMinutes 
 * @param {string} targetTimeStr - e.g., '20:18'
 * @param {string} locationStr - e.g., 'İstanbul, Turkey'
 * @returns {string}
 */
export function formatTooltip(_, nextPrayerLabel, remainingMinutes, targetTimeStr, locationStr) {
    const durationText = formatDurationText(_, remainingMinutes);
    
    // Position 1: Duration, Position 2: Prayer Label
    const line1 = formatString(_('%1$s remaining until %2$s'), durationText, nextPrayerLabel);
    const line2 = formatString(_('%1$s: %2$s'), nextPrayerLabel, targetTimeStr);
    const line3 = formatString(_('Location: %1$s'), locationStr);
    
    return `${line1}\n${line2}\n${line3}`;
}
