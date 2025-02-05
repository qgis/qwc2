/**
 * Copyright 2016 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React from 'react';
import {Provider, connect} from 'react-redux';

import axios from 'axios';
import deepmerge from 'deepmerge';
import {register as olProj4Register} from 'ol/proj/proj4';
import Proj4js from 'proj4';
import PropTypes from 'prop-types';

import {localConfigLoaded, setStartupParameters, setColorScheme} from '../actions/localConfig';
import {loadLocale} from '../actions/locale';
import {setCurrentTask} from '../actions/task';
import {themesLoaded, setCurrentTheme} from '../actions/theme';
import {NotificationType, showNotification, setBottombarHeight, setTopbarHeight} from '../actions/windows';
import ReducerIndex from '../reducers/index';
import {createStore} from '../stores/StandardStore';
import ConfigUtils from '../utils/ConfigUtils';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';
import MiscUtils from '../utils/MiscUtils';
import {UrlParams, resolvePermaLink} from '../utils/PermaLinkUtils';
import ThemeUtils from '../utils/ThemeUtils';
import PluginsContainer from './PluginsContainer';

import './style/App.css';
import './style/DefaultColorScheme.css';


const CSRF_TOKEN = MiscUtils.getCsrfToken();

if (CSRF_TOKEN) {
    axios.interceptors.request.use((config) => {
        if (["POST", "PUT", "PATCH", "DELETE"].includes(config.method.toUpperCase())) {
            config.headers["X-CSRF-TOKEN"] = CSRF_TOKEN;
        }
        return config;
    }, (error) => {
        return Promise.reject(error);
    });
}


class AppContainerComponent extends React.Component {
    static propTypes = {
        appConfig: PropTypes.object,
        defaultUrlParams: PropTypes.string,
        haveLocale: PropTypes.bool,
        haveMapSize: PropTypes.bool,
        initialParams: PropTypes.object,
        pluginsConfig: PropTypes.object,
        setBottombarHeight: PropTypes.func,
        setColorScheme: PropTypes.func,
        setCurrentTask: PropTypes.func,
        setCurrentTheme: PropTypes.func,
        setStartupParameters: PropTypes.func,
        setTopbarHeight: PropTypes.func,
        showNotification: PropTypes.func,
        themesLoaded: PropTypes.func
    };
    constructor(props) {
        super(props);
        this.initialized = false;

        // Set initial bottom/topbar height to zero in case not topbar/bottombar is enabled
        // The components will set the proper height if and when initialized
        props.setTopbarHeight(0);
        props.setBottombarHeight(0);
    }
    componentDidMount() {
        this.componentDidUpdate();

        window.addEventListener("QWC2ApiReady", () => {
            // Warn about non-existing plugins
            const plugins = {
                ...this.props.appConfig.pluginsDef.plugins,
                ...window.qwc2?.__customPlugins
            };
            const mode = ConfigUtils.isMobile() ? 'mobile' : 'desktop';
            this.props.pluginsConfig[mode].filter(entry => !plugins[entry.name + "Plugin"]).forEach(entry => {
                // eslint-disable-next-line
                console.warn("Non-existing plugin: " + entry.name);
            });
        });
    }
    componentDidUpdate() {
        // The map component needs to have finished loading before theme initialization can proceed
        if (this.props.haveMapSize && !this.initialized) {
            this.init();
        }
    }
    init = () => {
        this.initialized = true;

        // Set color scheme
        const storedColorScheme = ConfigUtils.havePlugin("Settings") ? localStorage.getItem('qwc2-color-scheme') : null;
        const colorScheme = this.props.initialParams.style || storedColorScheme || ConfigUtils.getConfigProp("defaultColorScheme");
        this.props.setColorScheme(colorScheme);

        // Load themes.json
        axios.get("themes.json").then(response => {
            const themes = response.data.themes || {};
            if (this.props.appConfig.themePreprocessor) {
                this.props.appConfig.themePreprocessor(themes);
            }
            this.props.themesLoaded(themes);

            // Resolve permalink and restore settings
            resolvePermaLink(this.props.initialParams, (params, state, success) => {
                if (!success) {
                    this.props.showNotification("missingtheme", LocaleUtils.tr("app.missingpermalink"), NotificationType.WARN, true);
                }
                let theme = ThemeUtils.getThemeById(themes,  params.t);
                if (!theme || theme.restricted) {
                    if (ConfigUtils.getConfigProp("dontLoadDefaultTheme")) {
                        return;
                    }
                    if (params.t) {
                        this.props.showNotification("missingtheme", LocaleUtils.tr("app.missingtheme", params.t), NotificationType.WARN, true);
                        params.l = undefined;
                    }
                    const defaultTheme = Object.fromEntries(this.props.defaultUrlParams.split("&").map(x => x.split("="))).t || themes.defaultTheme;
                    theme = ThemeUtils.getThemeById(themes, defaultTheme);
                    params.t = defaultTheme;
                }
                this.props.setStartupParameters({...params});
                const layerParams = params.l !== undefined ? params.l.split(",").filter(entry => entry) : null;
                if (layerParams && ConfigUtils.getConfigProp("urlReverseLayerOrder")) {
                    layerParams.reverse();
                }
                const visibleBgLayer = params.bl || params.bl === '' ? params.bl : null;
                let initialView = null;
                if (theme) {
                    if (params.c && params.s !== undefined) {
                        const coords = params.c.split(/[;,]/g).map(x => parseFloat(x) || 0);
                        const scales = theme.scales || themes.defaultScales;
                        const zoom = MapUtils.computeZoom(scales, params.s);
                        if (coords.length === 2) {
                            const p = CoordinatesUtils.reproject(coords, params.crs || theme.mapCrs, theme.bbox.crs);
                            const bounds = theme.bbox.bounds;
                            // Only accept c if it is within the theme bounds
                            if (bounds[0] <= p[0] && p[0] <= bounds[2] && bounds[1] <= p[1] && p[1] <= bounds[3]) {
                                initialView = {
                                    center: coords,
                                    zoom: zoom,
                                    crs: params.crs || theme.mapCrs
                                };
                            } else {
                                initialView = {
                                    center: [0.5 * (bounds[0] + bounds[2]), 0.5 * (bounds[1] + bounds[3])],
                                    zoom: zoom,
                                    crs: theme.bbox.crs
                                };
                            }
                        }
                    } else if (params.e) {
                        const bounds = params.e.split(/[;,]/g).map(x => parseFloat(x) || 0);
                        if (CoordinatesUtils.isValidExtent(bounds)) {
                            initialView = {
                                bounds: bounds,
                                crs: params.crs || theme.mapCrs
                            };
                        }
                    }
                }

                // Clear all params
                UrlParams.clear();

                // Restore theme and layers
                if (theme) {
                    try {
                        this.props.setCurrentTheme(theme, themes, false, initialView, layerParams, visibleBgLayer, state.layers, this.props.appConfig.themeLayerRestorer, this.props.appConfig.externalLayerRestorer);
                    } catch (e) {
                        // eslint-disable-next-line
                        console.log(e.stack);
                    }
                }
                const task = ConfigUtils.getConfigProp("startupTask");
                if (task && !theme.config?.startupTask) {
                    const mapClickAction = ConfigUtils.getPluginConfig(task.key).mapClickAction;
                    this.props.setCurrentTask(task.key, task.mode, mapClickAction);
                }
            });
        });
    };
    render() {
        // Ensure translations and config are loaded
        if (!this.props.haveLocale || !this.props.pluginsConfig) {
            return null;
        }
        const plugins = {
            ...this.props.appConfig.pluginsDef.plugins,
            ...window.qwc2?.__customPlugins
        };
        const pluginConfig = {...this.props.appConfig.pluginsDef.cfg};
        // Inject plugins available in 3d view to View3D plugin configuration
        pluginConfig.View3DPlugin = {
            ...pluginConfig.View3DPlugin,
            plugins: Object.entries(plugins).reduce((res, [key, plugin]) => {
                if (plugin.WrappedComponent?.availableIn3D || plugin.availableIn3D) {
                    return {...res, [key]: plugin};
                }
                return res;
            }, {})
        };
        return (
            <PluginsContainer plugins={plugins} pluginsAppConfig={pluginConfig} pluginsConfig={this.props.pluginsConfig} />
        );
    }
}

const AppContainer = connect(state => ({
    customPlugins: state.localConfig.customPlugins, // Unused, just to ensure component reacts when custom plugins change
    haveLocale: state.locale.current !== null,
    haveMapSize: state.map.size !== null,
    defaultUrlParams: state.localConfig.user_infos?.default_url_params || "",
    pluginsConfig: state.localConfig.plugins
}), {
    themesLoaded: themesLoaded,
    setCurrentTask: setCurrentTask,
    setColorScheme: setColorScheme,
    setCurrentTheme: setCurrentTheme,
    setStartupParameters: setStartupParameters,
    showNotification: showNotification,
    setTopbarHeight: setTopbarHeight,
    setBottombarHeight: setBottombarHeight
})(AppContainerComponent);


export default class StandardApp extends React.Component {
    static store = null;
    static propTypes = {
        appConfig: PropTypes.object
    };
    constructor(props) {
        super(props);
        const initialState = this.props.appConfig.initialState || {};
        StandardApp.store = createStore(ReducerIndex.reducers, initialState, this.props.appConfig.actionLogger);
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
    };
    render() {
        return (
            <Provider store={StandardApp.store}>
                <div ref={this.setupTouchEvents}>
                    <AppContainer appConfig={this.props.appConfig} initialParams={this.initialParams}/>
                </div>
            </Provider>
        );
    }
    setupTouchEvents = (el) => {
        el.addEventListener('touchstart', ev => {
            this.touchY = ev.targetTouches[0].clientY;
        }, { passive: false });
        el.addEventListener('touchmove', this.preventOverscroll, { passive: false });
    };
    preventOverscroll = (ev) => {
        if (ev.touches[0].touchType !== "direct") {
            // Don't do anything for stylus inputs
            return;
        }
        let scrollEvent = false;
        let element = ev.target;
        const direction = ev.targetTouches[0].clientY - this.touchY;
        this.touchY = ev.targetTouches[0].clientY;
        while (!scrollEvent && element) {
            let scrollable = element.scrollHeight > element.clientHeight;
            // Workaround for resizeable-window having scrollHeight > clientHeight even though it has no scrollbar
            if (element.classList.contains('resizeable-window')) {
                scrollable = false;
            }
            if (element.type === "range") {
                // If it is a range element, treat it as a scroll event
                scrollEvent = true;
            } else if (scrollable && (element.scrollTop + element.clientHeight < element.scrollHeight) && direction < 0) {
                // User scrolls down and element is not at end of scroll
                scrollEvent = true;
            } else if (scrollable && element.scrollTop > 0 && direction > 0) {
                // User scrolls up and element is not at start of scroll
                scrollEvent = true;
            } else {
                element = element.parentElement;
            }
        }
        if (!scrollEvent) {
            ev.preventDefault();
        }
    };
    init = () => {
        // Load config.json
        const urlParams = UrlParams.getParams();
        const configParams = Object.entries(urlParams).reduce((res, [key, value]) => {
            if (key.startsWith("config:")) {
                res[key.slice(7)] = value;
            }
            return res;
        }, {});
        ConfigUtils.loadConfiguration(configParams).then((config) => {
            // Merge common config into mobile/desktop config
            const commonConfig = (config.plugins.common || []).reduce((res, entry) => {
                const key = entry.name + (entry.name === "TaskButton" ? "#" + (entry.cfg || {}).task : "");
                return {...res, [key]: entry};
            }, {});
            config.plugins.desktop = Object.values(deepmerge(commonConfig, config.plugins.desktop.reduce((res, entry) => {
                const key = entry.name + (entry.name === "TaskButton" ? "#" + (entry.cfg || {}).task : "");
                return {...res, [key]: entry};
            }, {})));
            config.plugins.mobile = Object.values(deepmerge(commonConfig, config.plugins.mobile.reduce((res, entry) => {
                const key = entry.name + (entry.name === "TaskButton" ? "#" + (entry.cfg || {}).task : "");
                return {...res, [key]: entry};
            }, {})));
            delete config.plugins.common;
            // Store whether to show plugin in 2d/3d mode
            const plugins = this.props.appConfig.pluginsDef.plugins;
            config.plugins.mobile.forEach(entry => {
                const plugin = plugins[entry.name + "Plugin"];
                if (plugin) {
                    const component = plugin.WrappedComponent ?? plugin;
                    entry.availableIn3D = component.availableIn3D === true;
                    entry.availableIn2D = component.availableIn2D === true || component.availableIn2D === undefined;
                }
            });
            config.plugins.desktop.forEach(entry => {
                const plugin = plugins[entry.name + "Plugin"];
                if (plugin) {
                    const component = plugin.WrappedComponent ?? plugin;
                    entry.availableIn3D = component.availableIn3D === true;
                    entry.availableIn2D = component.availableIn2D === true || component.availableIn2D === undefined;
                }
            });
            StandardApp.store.dispatch(localConfigLoaded(config));
            // Load locale
            const defaultLocale = this.props.appConfig.getDefaultLocale ? this.props.appConfig.getDefaultLocale() : "";
            StandardApp.store.dispatch(loadLocale(this.props.appConfig.defaultLocaleData, defaultLocale));
            // Add projections from config
            for (const proj of config.projections || []) {
                if (Proj4js.defs(proj.code) === undefined) {
                    Proj4js.defs(proj.code, proj.proj);
                }
                CoordinatesUtils.setCrsLabels({[proj.code]: proj.label});
            }
            olProj4Register(Proj4js);
        });
    };
}
