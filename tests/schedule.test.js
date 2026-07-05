import { getNextPrayer, getAdjustedPrayerTimes } from '../src/schedule.js';
import { formatRemainingTime, formatString, formatDurationText, formatTooltip } from '../src/formatter.js';
import { getTranslator } from '../src/l10n.js';

const todayTimings = {
    Fajr: "04:00",
    Sunrise: "05:30",
    Dhuhr: "13:00",
    Asr: "17:00",
    Maghrib: "20:00",
    Isha: "21:30"
};

const tomorrowTimings = {
    Fajr: "04:02",
    Sunrise: "05:31",
    Dhuhr: "13:01",
    Asr: "17:01",
    Maghrib: "20:01",
    Isha: "21:31"
};

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`[PASS] ${message}`);
        passCount++;
    } else {
        console.error(`[FAIL] ${message}`);
        failCount++;
    }
}

function runTests() {
    console.log('--- Running Schedule, Formatter and L10n Tests ---');

    // Test 1: Early morning before Imsak (Sabah)
    {
        const nowDate = new Date(2026, 6, 5, 2, 0); // 02:00 AM
        const result = getNextPrayer(nowDate, todayTimings, tomorrowTimings);
        assert(result !== null, 'Should find next prayer at 02:00');
        assert(result.key === 'imsak', `Next prayer should be imsak, got ${result?.key}`);
        assert(result.remainingMinutes === 120, `Remaining minutes should be 120, got ${result?.remainingMinutes}`);
        assert(result.isTomorrow === false, 'Should be today');
    }

    // Test 2: In between prayers (Öğle)
    {
        const nowDate = new Date(2026, 6, 5, 12, 0); // 12:00 PM
        const result = getNextPrayer(nowDate, todayTimings, tomorrowTimings);
        assert(result !== null, 'Should find next prayer at 12:00');
        assert(result.key === 'ogle', `Next prayer should be ogle, got ${result?.key}`);
        assert(result.remainingMinutes === 60, `Remaining minutes should be 60, got ${result?.remainingMinutes}`);
    }

    // Test 3: Late night after Yatsı -> Tomorrow's Imsak
    {
        const nowDate = new Date(2026, 6, 5, 22, 30); // 10:30 PM
        const result = getNextPrayer(nowDate, todayTimings, tomorrowTimings);
        assert(result !== null, 'Should find next prayer at 22:30');
        assert(result.key === 'imsak', `Next prayer should be imsak, got ${result?.key}`);
        assert(result.remainingMinutes === 332, `Remaining minutes should be 332, got ${result?.remainingMinutes}`);
        assert(result.isTomorrow === true, 'Next prayer should be tomorrow');
    }

    // Test 4: Formatter HH:MM output
    {
        assert(formatRemainingTime(null, 163, true) === '02:43', '163 mins should format to 02:43');
        assert(formatRemainingTime(null, 43, true) === '00:43', '43 mins should format to 00:43');
        assert(formatRemainingTime(null, 8, true) === '00:08', '8 mins should format to 00:08');
        assert(formatRemainingTime(null, 485, true) === '08:05', '485 mins should format to 08:05');
    }

    // Test 5: Positional string formatting (L10n Helper)
    {
        const trTemplate = "%2$s vaktine %1$s kaldı";
        const enTemplate = "%1$s remaining until %2$s";
        
        const duration = "2 saat 43 dakika";
        const durationEn = "2 hours 43 minutes";
        const prayer = "Akşam";
        const prayerEn = "Maghrib";

        const formattedTr = formatString(trTemplate, duration, prayer);
        const formattedEn = formatString(enTemplate, durationEn, prayerEn);

        assert(formattedTr === "Akşam vaktine 2 saat 43 dakika kaldı", `TR formatted: "${formattedTr}"`);
        assert(formattedEn === "2 hours 43 minutes remaining until Maghrib", `EN formatted: "${formattedEn}"`);
    }

    // Test 6: formatDurationText with mocked gettext
    {
        const mockTrGettext = (str) => {
            if (str === '%1$d hour(s) %2$d minute(s)') return '%1$d saat %2$d dakika';
            if (str === '%1$d minute(s)') return '%1$d dakika';
            return str;
        };

        const mockEnGettext = (str) => {
            if (str === '%1$d hour(s) %2$d minute(s)') return '%1$d hour(s) %2$d minute(s)';
            if (str === '%1$d minute(s)') return '%1$d minute(s)';
            return str;
        };

        const durationTr = formatDurationText(mockTrGettext, 163);
        const durationEn = formatDurationText(mockEnGettext, 163);

        assert(durationTr === "2 saat 43 dakika", `TR duration: "${durationTr}"`);
        assert(durationEn === "2 hour(s) 43 minute(s)", `EN duration: "${durationEn}"`);
    }

    // Test 7: formatTooltip with mocked gettext
    {
        const mockTrGettext = (str) => {
            if (str === '%1$s remaining until %2$s') return '%2$s vaktine %1$s kaldı';
            if (str === '%1$s: %2$s') return '%1$s: %2$s';
            if (str === 'Location: %1$s') return 'Konum: %1$s';
            if (str === '%1$d hour(s) %2$d minute(s)') return '%1$d saat %2$d dakika';
            return str;
        };

        const tooltip = formatTooltip(mockTrGettext, "Akşam", 163, "20:30", "İstanbul");
        const lines = tooltip.split('\n');
        
        assert(lines[0] === "Akşam vaktine 2 saat 43 dakika kaldı", `Line 1: "${lines[0]}"`);
        assert(lines[1] === "Akşam: 20:30", `Line 2: "${lines[1]}"`);
        assert(lines[2] === "Konum: İstanbul", `Line 3: "${lines[2]}"`);
    }

    // Test 8: getTranslator custom language overrides
    {
        const trTranslator = getTranslator('tr');
        const arTranslator = getTranslator('ar');
        const bnTranslator = getTranslator('bn');
        const enTranslator = getTranslator('en');
        const autoTranslator = getTranslator('auto');

        assert(trTranslator('Imsak') === 'İmsak', 'TR: Imsak -> İmsak');
        assert(arTranslator('Imsak') === 'الفجر', 'AR: Imsak -> الفجر');
        assert(bnTranslator('Imsak') === 'ইমসাক', 'BN: Imsak -> ইমসাক');
        assert(enTranslator('Imsak') === 'Imsak', 'EN: Imsak -> Imsak');
        assert(autoTranslator('Imsak') !== undefined, 'AUTO load successful');
    }

    console.log(`\n--- Test Summary: ${passCount} passed, ${failCount} failed ---`);
    if (failCount > 0) {
        throw new Error('Some tests failed');
    }
}

try {
    runTests();
} catch (e) {
    console.error(e);
    imports.system.exit(1);
}
