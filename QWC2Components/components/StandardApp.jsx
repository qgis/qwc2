/**
 * Copyright 2016, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
const React = require('react');
const PropTypes = require('prop-types');
const {Provider} = require('react-redux');

// Needed for IE11 to avoid 'Promise not defined' error in axios
require("babel-polyfill");
// Avoid Intl is not defined (Intl needed by react-intl further on)
if (!global.Intl) {
   require('intl')
}

const axios = require('axios');
const assign = require('object-assign');

const Localized = require('../../MapStore2Components/components/I18N/Localized');
const StandardStore = require('../stores/StandardStore')
const PluginsContainer = require('./PluginsContainer');

const {changeBrowserProperties} = require('../../MapStore2Components/actions/browser');
const {loadLocale} = require('../../MapStore2Components/actions/locale');
const {localConfigLoaded} = require('../../MapStore2Components/actions/localConfig');
const {changeSearch} = require('../actions/search');
const {themesLoaded,setCurrentTheme} = require('../actions/theme');

const ConfigUtils = require('../../MapStore2Components/utils/ConfigUtils');
const LocaleUtils = require('../../MapStore2Components/utils/LocaleUtils');
const PluginsUtils = require('../../MapStore2Components/utils/PluginsUtils');
const {UrlParams, resolvePermaLink} = require('../utils/PermaLinkUtils');
const ThemeUtils = require('../utils/ThemeUtils');


class StandardApp extends React.Component {
    static propTypes = {
        appConfig: PropTypes.object
    }
    constructor(props) {
        super(props);
        this.store = StandardStore(this.props.appConfig.initialState || {}, this.props.appConfig.pluginsDef.plugins, {onPersist: this.init});
        this.init();
    }
    render() {
        let plugins = assign(PluginsUtils.getPlugins(this.props.appConfig.pluginsDef.plugins));
        return (
            <Provider store={this.store}>
                <Localized>
                    <PluginsContainer plugins={plugins} />
                </Localized>
            </Provider>
        );
    }
    init = () => {
        // Save initial params before they get overwritten
        let initialParams = UrlParams.getParams();

        // Detect browser properties
        this.store.dispatch(changeBrowserProperties(ConfigUtils.getBrowserProperties()));

        // Load locale
        LocaleUtils.setSupportedLocales(this.props.appConfig.supportedLocales);
        this.store.dispatch(loadLocale(null, LocaleUtils.getUserLocale()));

        // Load config.json
        ConfigUtils.loadConfiguration().then((config) => {
            this.store.dispatch(localConfigLoaded(config));

            // Load themes.json
            axios.get("themes.json").then(response => {
                this.store.dispatch(themesLoaded(response.data.themes || {}));

                // Resolve permalink and restore settings
                resolvePermaLink(initialParams, (params) => {
                    let themes = this.store.getState().theme.themes;
                    let themeId = params.t || themes.defaultTheme;
                    let theme = ThemeUtils.getThemeById(themes, themeId);
                    if(!theme) {
                        console.warn("No theme could be restored");
                        return;
                    }
                    let visibleLayers = params.l ? params.l.split(",") : null;
                    let visibleBgLayer = params.bl || null;
                    let initialView = null;
                    if(params.c && params.s !== undefined) {
                        let coords = params.c.split(";").map(x => parseFloat(x));
                        let scales = theme.scales || themes.defaultScales;
                        let closestVal = Math.abs(params.s - scales[0]);
                        let closestIdx = 0;
                        for(let i = 1; i < scales.length; ++i) {
                            let currVal = Math.abs(params.s - scales[i]);
                            if(currVal < closestVal) {
                                closestVal = currVal;
                                closestIdx = i;
                            }
                        }
                        if(coords.length === 2) {
                            initialView = {
                                center: {x: coords[0], y: coords[1]},
                                zoom: closestIdx,
                                crs: params.crs || theme.mapCrs};
                        }
                    } else if(params.e) {
                        let bounds = params.e.split(";").map(x => parseFloat(x));
                        if(bounds.length === 4) {
                            initialView = {
                                bounds: bounds,
                                crs: params.crs || theme.mapCrs
                            };
                        }
                    }

                    let searchText = params.st;
                    let searchProviders = params.sp ? params.sp.split(",") : null;

                    // Clear all params
                    UrlParams.updateParams({k: undefined, t: undefined, l: undefined, bl: undefined, c: undefined, s: undefined, e: undefined, crs: undefined, st: undefined, sp: undefined});

                    // Dispatch actions
                    this.store.dispatch(changeSearch(searchText, searchProviders));
                    this.store.dispatch(setCurrentTheme(theme, themes, false, initialView, visibleLayers, visibleBgLayer));
                });
            });
        });
    }
}

module.exports = StandardApp;
