/**
 * Copyright 2016, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
const React = require('react');
const PropTypes = require('prop-types');
const {Provider, connect} = require('react-redux');

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
const {addLayer} = require('../actions/layers');
const {changeSearch} = require('../actions/search');
const {themesLoaded,setCurrentTheme} = require('../actions/theme');

const ConfigUtils = require('../../MapStore2Components/utils/ConfigUtils');
const LocaleUtils = require('../../MapStore2Components/utils/LocaleUtils');
const PluginsUtils = require('../../MapStore2Components/utils/PluginsUtils');
const {UrlParams, resolvePermaLink} = require('../utils/PermaLinkUtils');
const ThemeUtils = require('../utils/ThemeUtils');

require('./style/App.css');


class AppInitComponent extends React.Component {
    static propTypes = {
        initialParams: PropTypes.object,
        mapSize: PropTypes.object,
        themesLoaded: PropTypes.func,
        changeSearch: PropTypes.func,
        setCurrentTheme: PropTypes.func,
        addLayer: PropTypes.func
    }
    constructor(props) {
        super(props);
        this.initialized = false;
    }
    componentDidMount() {
        // The map component needs to have finished loading before theme initialization can proceed
        if(this.props.mapSize && !this.initialized) {
            this.init();
        }
    }
    componentWillReceiveProps(newProps) {
        // The map component needs to have finished loading before theme initialization can proceed
        if(newProps.mapSize && !this.initialized) {
            this.init();
        }
    }
    init = () => {
        this.initialized = true;

        // Load themes.json
        axios.get("themes.json").then(response => {
            let themes = response.data.themes || {};
            this.props.themesLoaded(themes);

            // Resolve permalink and restore settings
            resolvePermaLink(this.props.initialParams, (params, state) => {
                let themeId = params.t || themes.defaultTheme;
                let theme = ThemeUtils.getThemeById(themes, themeId);
                if(!theme) {
                    theme = ThemeUtils.getThemeById(themes, themes.defaultTheme);
                    params = {};
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
                            center: coords,
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
                this.props.changeSearch(searchText, searchProviders);
                this.props.setCurrentTheme(theme, themes, false, initialView, visibleLayers, visibleBgLayer);

                // Restore from permalink state
                if(state.layers) {
                    for(let layer of state.layers.slice(0).reverse()) {
                        this.props.addLayer(layer);
                    }
                }
            });
        });
    }
    render() {
        return null;
    }
}

let AppInit = connect(state => ({
    mapSize: state.map.size
}), {
    themesLoaded: themesLoaded,
    changeSearch: changeSearch,
    setCurrentTheme: setCurrentTheme,
    addLayer: addLayer
})(AppInitComponent);


class StandardApp extends React.Component {
    static propTypes = {
        appConfig: PropTypes.object
    }
    constructor(props) {
        super(props);
        this.store = StandardStore(this.props.appConfig.initialState || {}, this.props.appConfig.pluginsDef.plugins, {onPersist: this.init});
        this.init();
        // Save initial params before they get overwritten
        this.initialParams = UrlParams.getParams();
    }
    render() {
        let plugins = assign(PluginsUtils.getPlugins(this.props.appConfig.pluginsDef.plugins));
        return (
            <Provider store={this.store}>
                <div>
                    <AppInit initialParams={this.initialParams} />
                    <Localized>
                        <PluginsContainer plugins={plugins} />
                    </Localized>
                </div>
            </Provider>
        );
    }
    init = () => {
        // Detect browser properties
        this.store.dispatch(changeBrowserProperties(ConfigUtils.getBrowserProperties()));

        // Load locale
        LocaleUtils.setSupportedLocales(this.props.appConfig.supportedLocales);

        // Load config.json
        ConfigUtils.loadConfiguration().then((config) => {
            this.store.dispatch(localConfigLoaded(config));
            // Dispatch user locale
            this.store.dispatch(loadLocale(null, LocaleUtils.getUserLocale()));
        });
    }
}

module.exports = StandardApp;
