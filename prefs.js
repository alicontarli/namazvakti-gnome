import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import * as Provider from './src/prayerTimesProvider.js';
import { getCalculationMethods, getJurisprudenceSchools, getViewModes } from './src/constants.js';
import { getTranslator } from './src/l10n.js';

function setupComboRow(comboRow, settings, key, choicesGetter) {
    comboRow._choicesGetter = choicesGetter;
    comboRow._settings = settings;
    comboRow._key = key;
    comboRow._blocking = false;
    
    comboRow._refreshModel = (_) => {
        const choices = comboRow._choicesGetter(_);
        const stringList = Gtk.StringList.new(choices.map(c => c.name));
        
        const currentValue = settings.get_string(key);
        const initialIndex = choices.findIndex(c => c.id === currentValue);
        
        comboRow._blocking = true;
        comboRow.model = stringList;
        if (initialIndex !== -1) {
            comboRow.selected = initialIndex;
        }
        comboRow._blocking = false;
    };
    
    // Connect listener for UI updates
    comboRow.connect('notify::selected', () => {
        if (comboRow._blocking) return;
        const selectedIndex = comboRow.selected;
        const choices = comboRow._choicesGetter((str) => str);
        if (selectedIndex >= 0 && selectedIndex < choices.length) {
            settings.set_string(key, choices[selectedIndex].id);
        }
    });
    
    // Connect listener for Settings updates (sync back if changed elsewhere)
    settings.connect(`changed::${key}`, () => {
        if (comboRow._blocking) return;
        const val = settings.get_string(key);
        const choices = comboRow._choicesGetter((str) => str);
        const idx = choices.findIndex(c => c.id === val);
        if (idx !== -1 && comboRow.selected !== idx) {
            comboRow._blocking = true;
            comboRow.selected = idx;
            comboRow._blocking = false;
        }
    });
}

export default class NamazVaktiPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        
        // --- 1. GENERAL PAGE ---
        const page = new Adw.PreferencesPage({
            icon_name: 'preferences-system-symbolic'
        });
        window.add(page);

        // --- 0. LANGUAGE SETTINGS GROUP ---
        const langGroup = new Adw.PreferencesGroup();
        page.add(langGroup);

        const langRow = new Adw.ComboRow();
        langGroup.add(langRow);
        setupComboRow(langRow, settings, 'language', (_) => [
            { id: 'auto', name: _('System Default') },
            { id: 'en', name: 'English' },
            { id: 'tr', name: 'Türkçe' },
            { id: 'ar', name: 'العربية' },
            { id: 'bn', name: 'বাংলা (Bengali)' },
            { id: 'es', name: 'Español' },
            { id: 'fr', name: 'Français' },
            { id: 'de', name: 'Deutsch' },
            { id: 'ru', name: 'Русский' },
            { id: 'fa', name: 'فارسی' },
            { id: 'ur', name: 'اردو' },
            { id: 'id', name: 'Bahasa Indonesia' }
        ]);

        // --- 1. LOCATION SETTINGS GROUP ---
        const locationGroup = new Adw.PreferencesGroup();
        page.add(locationGroup);

        const modeRow = new Adw.ComboRow();
        locationGroup.add(modeRow);
        setupComboRow(modeRow, settings, 'location-mode', (_) => [
            { id: 'city', name: _('City and Country') },
            { id: 'coords', name: _('Geographic Coordinates (Latitude / Longitude)') }
        ]);

        const cityRow = new Adw.EntryRow({
            text: settings.get_string('city')
        });
        locationGroup.add(cityRow);
        settings.bind('city', cityRow, 'text', Gio.SettingsBindFlags.DEFAULT);

        const countryRow = new Adw.EntryRow({
            text: settings.get_string('country')
        });
        locationGroup.add(countryRow);
        settings.bind('country', countryRow, 'text', Gio.SettingsBindFlags.DEFAULT);

        const latRow = new Adw.SpinRow({
            adjustment: new Gtk.Adjustment({
                lower: -90.0,
                upper: 90.0,
                step_increment: 0.0001,
                page_increment: 1.0
            }),
            digits: 4
        });
        locationGroup.add(latRow);
        settings.bind('latitude', latRow, 'value', Gio.SettingsBindFlags.DEFAULT);

        const lngRow = new Adw.SpinRow({
            adjustment: new Gtk.Adjustment({
                lower: -180.0,
                upper: 180.0,
                step_increment: 0.0001,
                page_increment: 1.0
            }),
            digits: 4
        });
        locationGroup.add(lngRow);
        settings.bind('longitude', lngRow, 'value', Gio.SettingsBindFlags.DEFAULT);

        const updateLocationVisibility = () => {
            const isCity = settings.get_string('location-mode') === 'city';
            cityRow.visible = isCity;
            countryRow.visible = isCity;
            latRow.visible = !isCity;
            lngRow.visible = !isCity;
        };
        settings.connect('changed::location-mode', updateLocationVisibility);
        updateLocationVisibility();

        const testActionRow = new Adw.ActionRow();
        const testButton = new Gtk.Button({
            valign: Gtk.Align.CENTER
        });
        testActionRow.add_suffix(testButton);
        locationGroup.add(testActionRow);

        testButton.connect('clicked', async () => {
            const _ = getTranslator(settings);
            testButton.sensitive = false;
            testButton.label = _('Verifying...');
            try {
                const testSettings = {
                    locationMode: settings.get_string('location-mode'),
                    city: settings.get_string('city'),
                    country: settings.get_string('country'),
                    latitude: settings.get_double('latitude'),
                    longitude: settings.get_double('longitude'),
                    method: settings.get_string('calculation-method'),
                    school: settings.get_string('school')
                };
                const now = new Date();
                const timings = await Provider.fetchCalendar(now.getFullYear(), now.getMonth() + 1, testSettings);
                if (timings && timings.length > 0) {
                    testButton.label = _('Verified and Refreshed!');
                } else {
                    testButton.label = _('Verification Failed');
                }
            } catch (e) {
                testButton.label = _('Error: Connection Issue');
                console.error('Validation request failed:', e);
            } finally {
                GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 3, () => {
                    const currentTranslator = getTranslator(settings);
                    testButton.sensitive = true;
                    testButton.label = currentTranslator('Verify Location and Refresh');
                    return GLib.SOURCE_REMOVE;
                });
            }
        });

        // --- 2. CALCULATION SETTINGS GROUP ---
        const calcGroup = new Adw.PreferencesGroup();
        page.add(calcGroup);

        const methodRow = new Adw.ComboRow();
        calcGroup.add(methodRow);
        setupComboRow(methodRow, settings, 'calculation-method', getCalculationMethods);

        const schoolRow = new Adw.ComboRow();
        calcGroup.add(schoolRow);
        setupComboRow(schoolRow, settings, 'school', getJurisprudenceSchools);

        // --- 3. MINUTE ADJUSTMENTS GROUP ---
        const adjGroup = new Adw.PreferencesGroup();
        page.add(adjGroup);

        const adjustmentsList = [
            { key: 'imsak-adjustment', titleKey: 'Imsak Adjustment (Min)', row: null },
            { key: 'gunes-adjustment', titleKey: 'Sunrise Adjustment (Min)', row: null },
            { key: 'ogle-adjustment', titleKey: 'Dhuhr Adjustment (Min)', row: null },
            { key: 'ikindi-adjustment', titleKey: 'Asr Adjustment (Min)', row: null },
            { key: 'aksam-adjustment', titleKey: 'Maghrib Adjustment (Min)', row: null },
            { key: 'yatsi-adjustment', titleKey: 'Isha Adjustment (Min)', row: null }
        ];

        for (const adj of adjustmentsList) {
            const spinRow = new Adw.SpinRow({
                adjustment: new Gtk.Adjustment({
                    lower: -30,
                    upper: 30,
                    step_increment: 1,
                    page_increment: 5
                })
            });
            adjGroup.add(spinRow);
            settings.bind(adj.key, spinRow, 'value', Gio.SettingsBindFlags.DEFAULT);
            adj.row = spinRow;
        }

        // --- 4. APPEARANCE SETTINGS GROUP ---
        const viewGroup = new Adw.PreferencesGroup();
        page.add(viewGroup);

        const viewModeRow = new Adw.ComboRow();
        viewGroup.add(viewModeRow);
        setupComboRow(viewModeRow, settings, 'view-mode', getViewModes);

        const showGunesRow = new Adw.SwitchRow();
        viewGroup.add(showGunesRow);
        settings.bind('show-gunes', showGunesRow, 'active', Gio.SettingsBindFlags.DEFAULT);

        const showImsakRow = new Adw.SwitchRow();
        viewGroup.add(showImsakRow);
        settings.bind('show-imsak', showImsakRow, 'active', Gio.SettingsBindFlags.DEFAULT);

        const use24hRow = new Adw.SwitchRow();
        viewGroup.add(use24hRow);
        settings.bind('use-24h', use24hRow, 'active', Gio.SettingsBindFlags.DEFAULT);

        const showTooltipRow = new Adw.SwitchRow();
        viewGroup.add(showTooltipRow);
        settings.bind('show-tooltip', showTooltipRow, 'active', Gio.SettingsBindFlags.DEFAULT);

        const showHhMmRow = new Adw.SwitchRow();
        viewGroup.add(showHhMmRow);
        settings.bind('show-hh-mm', showHhMmRow, 'active', Gio.SettingsBindFlags.DEFAULT);

        // --- 5. NOTIFICATION SETTINGS GROUP ---
        const notifyGroup = new Adw.PreferencesGroup();
        page.add(notifyGroup);

        const notifyRow = new Adw.SwitchRow();
        notifyGroup.add(notifyRow);
        settings.bind('notify-on-time', notifyRow, 'active', Gio.SettingsBindFlags.DEFAULT);

        const notifyBeforeRow = new Adw.SpinRow({
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 15,
                step_increment: 1,
                page_increment: 5
            })
        });
        notifyGroup.add(notifyBeforeRow);
        settings.bind('notify-before-minutes', notifyBeforeRow, 'value', Gio.SettingsBindFlags.DEFAULT);

        // --- DYNAMIC TRANSLATION UPDATER ---
        const updatePrefTranslations = () => {
            const _ = getTranslator(settings);
            
            // Page & Groups
            page.title = _('General');
            langGroup.title = _('Language Settings');
            locationGroup.title = _('Location Settings');
            locationGroup.description = _('Select the location method and enter your details for calculating prayer times.');
            calcGroup.title = _('Calculation Settings');
            adjGroup.title = _('Minute Adjustments');
            adjGroup.description = _('Prayer times are calculated based on the selected method. If there are discrepancies with your local mosque timetable, you can make minute-by-minute adjustments.');
            viewGroup.title = _('Appearance Settings');
            notifyGroup.title = _('Notification Settings');
            
            // Rows
            langRow.title = _('Language');
            modeRow.title = _('Location Determination Method');
            cityRow.title = _('City');
            countryRow.title = _('Country');
            latRow.title = _('Latitude');
            lngRow.title = _('Longitude');
            testActionRow.title = _('Location Test');
            testActionRow.subtitle = _('Performs a connection test to the AlAdhan API server using chosen settings');
            testButton.label = _('Verify Location and Refresh');
            
            methodRow.title = _('Calculation Method');
            schoolRow.title = _('Asr Calculation School');
            
            showGunesRow.title = _('Show Sunrise Time in Panel');
            showImsakRow.title = _('Show Imsak Time in Panel');
            use24hRow.title = _('Use 24-Hour Format');
            showTooltipRow.title = _('Show Tooltip (When hovering over panel)');
            showHhMmRow.title = _('Show Remaining Time in HH:MM Format');
            
            notifyRow.title = _('Send Notification at Prayer Time');
            notifyBeforeRow.title = _('Warn N Minutes Before Prayer Time (0 = Disabled)');
            
            // Adjustments titles
            for (const adj of adjustmentsList) {
                adj.row.title = _(adj.titleKey);
            }
            
            // Re-render and populate combo rows with selected language translation
            langRow._refreshModel(_);
            modeRow._refreshModel(_);
            methodRow._refreshModel(_);
            schoolRow._refreshModel(_);
            viewModeRow._refreshModel(_);
        };

        // Initialize translations
        updatePrefTranslations();

        // Listen for language setting changes to dynamically redraw the UI in the new language
        settings.connect('changed::language', () => {
            updatePrefTranslations();
        });
    }
}
