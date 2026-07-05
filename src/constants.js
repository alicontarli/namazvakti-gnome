export const PRAYERS = ['imsak', 'gunes', 'ogle', 'ikindi', 'aksam', 'yatsi'];

export function getPrayerLabels(_) {
    return {
        imsak: _('Imsak'),
        gunes: _('Sunrise'),
        ogle: _('Dhuhr'),
        ikindi: _('Asr'),
        aksam: _('Maghrib'),
        yatsi: _('Isha')
    };
}

export function getCalculationMethods(_) {
    return [
        { id: '13', name: _('Diyanet İşleri Başkanlığı (Turkey)') },
        { id: '3', name: _('Muslim World League') },
        { id: '2', name: _('ISNA') },
        { id: '5', name: _('Egyptian General Authority of Survey') },
        { id: '4', name: _('Umm al-Qura, Makkah') },
        { id: '99', name: _('Automatic / Default') }
    ];
}

export function getJurisprudenceSchools(_) {
    return [
        { id: '0', name: _('Standard (Shafi, Maliki, Hanbali)') },
        { id: '1', name: _('Hanafi') }
    ];
}

export function getViewModes(_) {
    return [
        { id: 'full', name: _('Icon + Prayer name + Remaining time') },
        { id: 'name-time', name: _('Prayer name + Remaining time') },
        { id: 'time-only', name: _('Only remaining time') },
        { id: 'icon-only', name: _('Only icon') }
    ];
}
