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
const isEmpty = require('lodash.isempty');
const Proj4js = require('proj4').default;
const olProj4 = require('ol/proj/proj4');

const Localized = require('../components/I18N/Localized');
const StandardStore = require('../stores/StandardStore')
const PluginsContainer = require('./PluginsContainer');

const {changeBrowserProperties} = require('../actions/browser');
const {loadLocale} = require('../actions/locale');
const {localConfigLoaded} = require('../actions/localConfig');
const {restoreLayerState, replacePlaceholderLayer} = require('../actions/layers');
const {changeSearch} = require('../actions/search');
const {themesLoaded,setCurrentTheme} = require('../actions/theme');

const ConfigUtils = require('../utils/ConfigUtils');
const CoordinatesUtils = require('../utils/CoordinatesUtils');
const LocaleUtils = require('../utils/LocaleUtils');
const MapUtils = require('../utils/MapUtils');
const PluginsUtils = require('../utils/PluginsUtils');
const ServiceLayerUtils = require('../utils/ServiceLayerUtils');
const LayerUtils = require('../utils/LayerUtils');
const {UrlParams, resolvePermaLink} = require('../utils/PermaLinkUtils');
const ThemeUtils = require('../utils/ThemeUtils');

require('./style/App.css');


class AppInitComponent extends React.Component {
    static propTypes = {
        appConfig: PropTypes.object,
        initialParams: PropTypes.object,
        mapSize: PropTypes.object,
        themesLoaded: PropTypes.func,
        changeSearch: PropTypes.func,
        setCurrentTheme: PropTypes.func,
        restoreLayerState: PropTypes.func,
        replacePlaceholderLayer: PropTypes.func
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
                let visibleLayers = params.l ? params.l.split(",").filter(entry => entry) : null;
                let visibleBgLayer = params.bl || params.bl === '' ? params.bl : null;
                let initialView = null;
                if(params.c && params.s !== undefined) {
                    let coords = params.c.split(/[;,]/g).map(x => parseFloat(x));
                    let scales = theme.scales || themes.defaultScales;
                    let zoom = MapUtils.computeZoom(scales, params.s);
                    if(coords.length === 2) {
                        initialView = {
                            center: coords,
                            zoom: zoom,
                            crs: params.crs || theme.mapCrs};
                    }
                } else if(params.e) {
                    let bounds = params.e.split(/[;,]/g).map(x => parseFloat(x));
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
                UrlParams.updateParams({k: undefined, t: undefined, l: undefined, bl: '', c: undefined, s: undefined, e: undefined, crs: undefined, st: undefined, sp: undefined});
                // Restore map (invoking appConfig.layerRestorer to handle missing layers if necessary)
                if(visibleLayers && this.props.appConfig.themeLayerRestorer) {
                    let layerNames = [];
                    LayerUtils.collectWMSSublayerParams(theme, layerNames, [], []);
                    let visibleLayerNames = visibleLayers.map(entry => LayerUtils.splitLayerUrlParam(entry))
                                 .filter(entry => entry.type === 'theme')
                                 .map(entry => entry.name);
                    let missingLayers = visibleLayerNames.filter(entry => !layerNames.includes(entry));
                    if(!isEmpty(missingLayers)) {
                        this.props.appConfig.themeLayerRestorer(missingLayers, theme, (newThemeSublayers, newVisibleLayers) => {
                            let newTheme = LayerUtils.mergeSubLayers(theme, {sublayers: newThemeSublayers});
                            if(newVisibleLayers) {
                                visibleLayers = visibleLayers.reduce((res, layer) => {
                                    return layer in newVisibleLayers ? [...res, ...newVisibleLayers[layer]] : [...res, layer];
                                }, []);
                            }
                            this.restoreMap(newTheme, themes, initialView, visibleLayers, visibleBgLayer, state, searchText, searchProviders);
                        });
                    } else {
                        this.restoreMap(theme, themes, initialView, visibleLayers, visibleBgLayer, state, searchText, searchProviders);
                    }
                } else {
                    this.restoreMap(theme, themes, initialView, visibleLayers, visibleBgLayer, state, searchText, searchProviders);
                }
            });
        });
    }
    restoreMap = (theme, themes, initialView, visibleLayers, visibleBgLayer, state, searchText, searchProviders) => {
        // Restore search
        this.props.changeSearch(searchText, searchProviders);

        // Restore theme and layers
        try {
            this.props.setCurrentTheme(theme, themes, false, initialView, visibleLayers, visibleBgLayer, state.themesublayers);
        } catch(e) {
            console.log(e.stack);
        }

        // Restore layers from permalink state
        if(state.layers) {
            this.props.restoreLayerState(state.layers);
        }

        // Gather external layers to restore
        let externalLayers = {};
        for(let i = 0, n = (visibleLayers || []).length; i < n; ++i) {
            let layer = LayerUtils.splitLayerUrlParam(visibleLayers[i]);
            if(layer.type !== 'theme') {
                let key = layer.type + ":" + layer.url;
                (externalLayers[key] = externalLayers[key] || []).push({
                    name: layer.name,
                    opacity: layer.opacity
                });
            }
        }
        for(let key of Object.keys(externalLayers)) {
            let service = key.slice(0, 3);
            let serviceUrl = key.slice(4);
            ServiceLayerUtils.findLayers(service, serviceUrl, externalLayers[key], this.restoreExternalLayer);
        }


    }
    restoreExternalLayer = (source, layer) => {
        this.props.replacePlaceholderLayer(source, layer)
    }
    render() {
        return null;
    }
}

let AppInit = connect(state => ({
    mapSize: state.map.size,
    layers: state.layers.flat
}), {
    themesLoaded: themesLoaded,
    changeSearch: changeSearch,
    setCurrentTheme: setCurrentTheme,
    restoreLayerState: restoreLayerState,
    replacePlaceholderLayer: replacePlaceholderLayer
})(AppInitComponent);


class StandardApp extends React.Component {
    static propTypes = {
        appConfig: PropTypes.object
    }
    constructor(props) {
        super(props);
        this.store = StandardStore(this.props.appConfig.initialState || {}, this.props.appConfig.pluginsDef.plugins, {onPersist: this.init}, this.props.appConfig.actionLogger);
        this.init();
        // Save initial params before they get overwritten
        this.initialParams = UrlParams.getParams();
        this.touchY = null;
    }
    componentDidMount() {
        window.addEventListener('resize', this.computeVh);
        this.computeVh();
    }
    componentWillUnmount() {
        window.removeEventListener('resize', this.computeVh);
    }
    computeVh = () => {
        // https://css-tricks.com/the-trick-to-viewport-units-on-mobile/
        document.documentElement.style.setProperty('--vh', (window.innerHeight * 0.01 ) + 'px');
    }
    render() {
        let plugins = assign(PluginsUtils.getPlugins(this.props.appConfig.pluginsDef.plugins));
        return (
            <Provider store={this.store}>
                <div ref={this.setupTouchEvents}>
                    <AppInit initialParams={this.initialParams} appConfig={this.props.appConfig}/>
                    <Localized>
                        <PluginsContainer plugins={plugins} pluginsAppConfig={this.props.appConfig.pluginsDef.cfg || {}} />
                    </Localized>
                </div>
            </Provider>
        );
    }
    setupTouchEvents = (el) => {
        el.addEventListener('touchstart', ev => {
            this.touchY = ev.targetTouches[0].clientY;
        }, { passive: false })
        el.addEventListener('touchmove', this.preventOverscroll, { passive: false })
    }
    preventOverscroll = (ev) => {
        let scrollEvent = false;
        let element = ev.target;
        let direction = ev.targetTouches[0].clientY - this.touchY;
        this.touchY = ev.targetTouches[0].clientY;
        while(!scrollEvent && element) {
            let scrollable = element.scrollHeight > element.clientHeight;
            // Workaround for resizeable-window having scrollHeight > clientHeight even though it has no scrollbar
            if(element.classList.contains('resizeable-window')) {
                scrollable = false;
            }
            // If it is a range element, treat it as a scroll event
            if(element.type === "range") {
                scrollEvent = true;
            }
            // User scrolls down and element is not at end of scroll
            else if (scrollable && (element.scrollTop + element.clientHeight < element.scrollHeight) && direction < 0) {
                scrollEvent = true;
            }
            // User scrolls up and element is not at start of scroll
            else if (scrollable && element.scrollTop > 0 && direction > 0) {
                scrollEvent = true;
            }
            else {
                element = element.parentElement;
            }
        }
        if(!scrollEvent) {
            ev.preventDefault();
        }
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
            // Add projections from config
            for(let proj of config.projections || []) {
                if(Proj4js.defs(proj.code) === undefined) {
                    Proj4js.defs(proj.code, proj.proj);
                }
                CoordinatesUtils.setCrsLabels({[proj.code]: proj.label});
            }

            olProj4.register(Proj4js);
        });
    }
}

module.exports = StandardApp;
