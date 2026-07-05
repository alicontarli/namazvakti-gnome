import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { getNextPrayer, getAdjustedPrayerTimes } from './src/schedule.js';
import { formatRemainingTime, formatTooltip, formatTime, formatString } from './src/formatter.js';
import { getTimingsForDate } from './src/prayerTimesProvider.js';
import * as Cache from './src/cache.js';
import { PRAYERS, getPrayerLabels } from './src/constants.js';
import { getTranslator } from './src/l10n.js';

const PrayerRow = GObject.registerClass(
class PrayerRow extends PopupMenu.PopupBaseMenuItem {
    _init(key, name) {
        super._init({ reactive: false, activate: false });
        this.key = key;
        
        // Horizontal box to hold row elements
        const box = new St.BoxLayout({
            x_expand: true,
            style_class: 'vakit-menu-row'
        });
        
        this.nameLabel = new St.Label({
            text: name,
            style_class: 'vakit-menu-cell-name',
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });
        
        this.remainingLabel = new St.Label({
            style_class: 'vakit-menu-cell-remaining',
            y_align: Clutter.ActorAlign.CENTER
        });
        
        this.timeLabel = new St.Label({
            style_class: 'vakit-menu-cell-time',
            y_align: Clutter.ActorAlign.CENTER
        });
        
        box.add_child(this.nameLabel);
        box.add_child(this.remainingLabel);
        box.add_child(this.timeLabel);
        
        this.add_child(box);
    }
    
    update(timeStr, isActive, remainingStr) {
        this.timeLabel.text = timeStr;
        
        const box = this.get_first_child();
        if (isActive) {
            box.add_style_class_name('vakit-menu-row-active');
            this.remainingLabel.text = remainingStr ? `(${remainingStr}) ` : '';
            this.remainingLabel.show();
        } else {
            box.remove_style_class_name('vakit-menu-row-active');
            this.remainingLabel.text = '';
            this.remainingLabel.hide();
        }
    }
});

const NamazVaktiButton = GObject.registerClass(
class NamazVaktiButton extends PanelMenu.Button {
    _init(extension) {
        this.extension = extension;
        this.settings = extension.getSettings();
        const _ = getTranslator(this.settings);
        
        super._init(0.5, 'namazvakti-gnome', false);
        this.add_style_class_name('namaz-vakti-button');
        
        this._enabled = true;
        this.todayTimings = null;
        this.tomorrowTimings = null;
        this.lastSuccessfulUpdate = null;
        this.isOffline = false;
        this._lastNotificationKey = '';

        this.label = new St.Label({
            text: _('Loading...'),
            y_align: Clutter.ActorAlign.CENTER
        });
        
        this.add_child(this.label);

        // Build Popup Menu
        this.buildMenu();

        // Listen for setting changes
        this.setupSettingsListeners();

        // Load initial data and start loop
        this.updateData(false);
        this.startUpdateLoop();
        
        // Update menu details whenever it is opened
        this.menu.connect('open-state-changed', (menu, open) => {
            if (open) {
                this.updateUI();
            }
        });
    }

    buildMenu() {
        const _ = getTranslator(this.settings);
        const menuBox = new St.BoxLayout({
            vertical: true,
            style_class: 'vakit-menu-box'
        });

        // Header containing Location & Date
        this.titleLabel = new St.Label({
            style_class: 'vakit-menu-title',
            text: _('Loading Location...')
        });
        this.subtitleLabel = new St.Label({
            style_class: 'vakit-menu-subtitle',
            text: ''
        });

        menuBox.add_child(this.titleLabel);
        menuBox.add_child(this.subtitleLabel);
        
        // Add headers to menu box
        this.menu.box.add_child(menuBox);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Prayer list
        this.prayerRows = {};
        const prayerLabels = getPrayerLabels(_);
        for (const key of PRAYERS) {
            const row = new PrayerRow(key, prayerLabels[key]);
            this.menu.addMenuItem(row);
            this.prayerRows[key] = row;
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Action Buttons
        this.refreshItem = new PopupMenu.PopupImageMenuItem(_('Refresh now'), 'view-refresh-symbolic');
        this.refreshItem.connect('activate', () => {
            this.updateData(true);
        });
        this.menu.addMenuItem(this.refreshItem);

        this.settingsItem = new PopupMenu.PopupImageMenuItem(_('Settings'), 'preferences-system-symbolic');
        this.settingsItem.connect('activate', () => {
            this.extension.openPreferences();
        });
        this.menu.addMenuItem(this.settingsItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Status Label (at the bottom)
        this.statusLabel = new St.Label({
            style_class: 'vakit-status-label',
            text: _('Loading...')
        });
        this.menu.box.add_child(this.statusLabel);
    }

    setupSettingsListeners() {
        const settingKeys = [
            'location-mode', 'city', 'country', 'latitude', 'longitude',
            'calculation-method', 'school', 'imsak-adjustment', 'gunes-adjustment',
            'ogle-adjustment', 'ikindi-adjustment', 'aksam-adjustment', 'yatsi-adjustment',
            'view-mode', 'show-gunes', 'show-imsak', 'use-24h', 'show-tooltip', 'show-hh-mm',
            'notify-on-time', 'notify-before-minutes', 'language'
        ];

        this._settingsConnections = [];
        for (const key of settingKeys) {
            const id = this.settings.connect(`changed::${key}`, () => {
                if (!this._enabled) return;
                const isDataKey = ['location-mode', 'city', 'country', 'latitude', 'longitude', 'calculation-method', 'school'].includes(key);
                if (isDataKey) {
                    this.updateData(true);
                } else {
                    this.updateUI();
                }
            });
            this._settingsConnections.push(id);
        }
    }

    getSettingsObj() {
        return {
            locationMode: this.settings.get_string('location-mode'),
            city: this.settings.get_string('city'),
            country: this.settings.get_string('country'),
            latitude: this.settings.get_double('latitude'),
            longitude: this.settings.get_double('longitude'),
            method: this.settings.get_string('calculation-method'),
            school: this.settings.get_string('school'),
            'imsak-adjustment': this.settings.get_int('imsak-adjustment'),
            'gunes-adjustment': this.settings.get_int('gunes-adjustment'),
            'ogle-adjustment': this.settings.get_int('ogle-adjustment'),
            'ikindi-adjustment': this.settings.get_int('ikindi-adjustment'),
            'aksam-adjustment': this.settings.get_int('aksam-adjustment'),
            'yatsi-adjustment': this.settings.get_int('yatsi-adjustment')
        };
    }

    async updateData(forceRefresh = false) {
        if (!this._enabled) return;
        
        try {
            const now = new Date();
            const settings = this.getSettingsObj();

            // Fetch today's timings
            const todayTimings = await getTimingsForDate(now, settings, forceRefresh);
            
            // Fetch tomorrow's timings (for wrap-around countdowns after Yatsı)
            const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            let tomorrowTimings = null;
            try {
                tomorrowTimings = await getTimingsForDate(tomorrow, settings, forceRefresh);
            } catch (e) {
                console.warn('Failed to pre-fetch tomorrow timings:', e.message);
            }

            if (!this._enabled) return;

            this.todayTimings = todayTimings;
            this.tomorrowTimings = tomorrowTimings;
            this.lastSuccessfulUpdate = new Date();
            this.isOffline = false;

            this.updateUI();
        } catch (e) {
            console.error('Failed to update prayer times data:', e.message);
            if (!this._enabled) return;
            
            this.isOffline = true;
            this.fallbackToCachedData();
            this.updateUI();
        }
    }

    fallbackToCachedData() {
        try {
            const now = new Date();
            const settings = this.getSettingsObj();
            
            this.todayTimings = Cache.loadFromCache(now.getFullYear(), now.getMonth() + 1, settings);
            
            const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            this.tomorrowTimings = Cache.loadFromCache(tomorrow.getFullYear(), tomorrow.getMonth() + 1, settings);
        } catch (e) {
            console.error('Failed loading fallback cache:', e.message);
        }
    }

    startUpdateLoop() {
        this._updateLoop();
    }

    _updateLoop() {
        if (!this._enabled) return;
        
        this.updateUI();

        // Align the timer with system clock minute turns
        const now = new Date();
        const millisToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
        
        this._timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, millisToNextMinute + 100, () => {
            this._timeoutId = null;
            this._updateLoop();
            return GLib.SOURCE_REMOVE;
        });
    }

    updateUI() {
        if (!this._enabled) return;

        const now = new Date();
        const settings = this.getSettingsObj();
        const _ = getTranslator(this.settings);

        // Update menu action labels dynamically
        if (this.refreshItem) {
            this.refreshItem.label.text = _('Refresh now');
        }
        if (this.settingsItem) {
            this.settingsItem.label.text = _('Settings');
        }
        
        // Display header location details
        if (settings.locationMode === 'city') {
            this.titleLabel.text = `${settings.city}, ${settings.country}`;
        } else {
            this.titleLabel.text = `${settings.latitude.toFixed(4)}, ${settings.longitude.toFixed(4)}`;
        }

        // Subtitle Date matching user selected locale
        let localeCode = undefined;
        const langSetting = this.settings.get_string('language');
        if (langSetting !== 'auto') {
            const langLocales = {
                en: 'en-US', tr: 'tr-TR', ar: 'ar-SA', es: 'es-ES',
                fr: 'fr-FR', de: 'de-DE', ru: 'ru-RU', fa: 'fa-IR',
                ur: 'ur-PK', id: 'id-ID', bn: 'bn-BD'
            };
            localeCode = langLocales[langSetting];
        }
        const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        this.subtitleLabel.text = now.toLocaleDateString(localeCode, dateOptions);

        const use24h = this.settings.get_boolean('use-24h');
        const showImsak = this.settings.get_boolean('show-imsak');
        const showGunes = this.settings.get_boolean('show-gunes');
        const showHhMm = this.settings.get_boolean('show-hh-mm');
        const viewMode = this.settings.get_string('view-mode');
        const showTooltip = this.settings.get_boolean('show-tooltip');

        if (!this.todayTimings) {
            this.label.text = _('Offline');
            this.statusLabel.text = _('Error - Failed to load data');
            return;
        }

        // 1. Calculate schedule
        const result = getNextPrayer(now, this.todayTimings, this.tomorrowTimings, settings, showImsak, showGunes);
        
        if (result) {
            const nextPrayerKey = result.key;
            const remaining = result.remainingMinutes;
            const isTomorrow = result.isTomorrow;
            const remainingStr = formatRemainingTime(_, remaining, showHhMm);
            const prayerLabels = getPrayerLabels(_);
            const prayerLabel = prayerLabels[nextPrayerKey];

            // Update Panel Display mode
            if (viewMode === 'time-only' || viewMode === 'icon-only') {
                this.label.text = remainingStr;
            } else {
                this.label.text = `${prayerLabel} · ${remainingStr}`;
            }

            // Update Panel Tooltip
            if (showTooltip) {
                const targetTimeStr = formatTime(result.targetMinutes, use24h);
                const locationName = settings.locationMode === 'city' 
                    ? `${settings.city}, ${settings.country}`
                    : `${settings.latitude.toFixed(4)}, ${settings.longitude.toFixed(4)}`;
                this.tooltip_text = formatTooltip(_, prayerLabel, remaining, targetTimeStr, locationName);
            } else {
                this.tooltip_text = null;
            }

            // Update Dropdown List Row Details
            const adjustedTimes = getAdjustedPrayerTimes(this.todayTimings, settings);
            for (const key of PRAYERS) {
                const timeMinutes = adjustedTimes[key];
                const timeStr = formatTime(timeMinutes, use24h);
                const isActive = (key === nextPrayerKey && !isTomorrow);
                
                this.prayerRows[key].nameLabel.text = prayerLabels[key];
                this.prayerRows[key].update(timeStr, isActive, remainingStr);
            }

            // Handle notifications logic
            this.checkNotifications(nextPrayerKey, remaining);
        } else {
            this.label.text = _('Error');
        }

        // Update bottom status string
        if (this.isOffline) {
            this.statusLabel.text = _('Offline — using cached timings');
        } else if (this.lastSuccessfulUpdate) {
            const updateTimeStr = formatTime(this.lastSuccessfulUpdate.getHours() * 60 + this.lastSuccessfulUpdate.getMinutes(), use24h);
            this.statusLabel.text = formatString(_('Last update: %1$s'), updateTimeStr);
        }
    }

    checkNotifications(prayerKey, remaining) {
        if (!this.settings.get_boolean('notify-on-time')) return;

        const beforeMinutes = this.settings.get_int('notify-before-minutes');
        
        // Exact on-time notification
        if (remaining === 0) {
            const cacheKey = `${prayerKey}_0`;
            if (this._lastNotificationKey !== cacheKey) {
                this.sendNotification(prayerKey, 0);
                this._lastNotificationKey = cacheKey;
            }
        } 
        // Warning minutes before notification
        else if (beforeMinutes > 0 && remaining === beforeMinutes) {
            const cacheKey = `${prayerKey}_${beforeMinutes}`;
            if (this._lastNotificationKey !== cacheKey) {
                this.sendNotification(prayerKey, beforeMinutes);
                this._lastNotificationKey = cacheKey;
            }
        }
    }

    sendNotification(prayerKey, minutes) {
        const _ = getTranslator(this.settings);
        const prayerLabels = getPrayerLabels(_);
        const label = prayerLabels[prayerKey] || prayerKey;
        let body;
        if (minutes === 0) {
            body = formatString(_('%1$s time has entered.'), label);
        } else {
            body = formatString(_('%2$d minute(s) remaining for %1$s'), label, minutes);
        }
        Main.notify('namazvakti-gnome', body);
    }

    destroy() {
        this._enabled = false;
        
        // Clean up GLib timeout
        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = null;
        }

        // Clean up GSettings listeners
        if (this._settingsConnections) {
            for (const id of this._settingsConnections) {
                this.settings.disconnect(id);
            }
            this._settingsConnections = [];
        }

        super.destroy();
    }
});

export default class NamazVaktiExtension extends Extension {
    enable() {
        this._indicator = new NamazVaktiButton(this);
        Main.panel.addToStatusArea('namaz-vakti-gnome', this._indicator);
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}
