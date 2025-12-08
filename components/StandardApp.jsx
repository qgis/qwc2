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
import {changeLocale} from '../actions/locale';
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
import PluginStore from '../utils/PluginStore';
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
        customPlugins: PropTypes.array,
        defaultUrlParams: PropTypes.string,
        haveMapSize: PropTypes.bool,
        localConfig: PropTypes.object,
        locale: PropTypes.string,
        setBottombarHeight: PropTypes.func,
        setCurrentTask: PropTypes.func,
        setCurrentTheme: PropTypes.func,
        setTopbarHeight: PropTypes.func,
        showNotification: PropTypes.func,
        startupConfig: PropTypes.object,
        themesLoaded: PropTypes.func
    };
    constructor(props) {
        super(props);
        this.themesLoaded = false;

        // Set initial bottom/topbar height to zero in case not topbar/bottombar is enabled
        // The components will set the proper height if and when initialized
        props.setTopbarHeight(0);
        props.setBottombarHeight(0);
    }
    componentDidMount() {
        this.componentDidUpdate({});
    }
    componentDidUpdate(prevProps) {
        // The map component needs to have finished loading before theme initialization can proceed
        if (this.props.haveMapSize && !this.themesLoaded) {
            this.loadThemes();
        }
    }
    loadThemes = () => {
        this.themesLoaded = true;
        const {state, permalinkInvalid} = this.props.startupConfig;
        const params = {...this.props.startupConfig.params}; // Clone as changed below

        // Warn if permalink key is invalid
        if (permalinkInvalid) {
            this.props.showNotification("missingtheme", LocaleUtils.tr("app.missingpermalink"), NotificationType.WARN, true);
        }

        // Load themes.json
        axios.get("themes.json", {params: {lang: this.props.locale}}).then(response => {
            const themes = ThemeUtils.applyTranslations(response.data.themes || {});
            this.props.appConfig.themePreprocessor?.(themes);
            this.props.themesLoaded(themes);

            let theme = ThemeUtils.getThemeById(themes,  params.t);
            if ((!theme || theme.restricted) && !ConfigUtils.getConfigProp("dontLoadDefaultTheme") && (params.t || !ConfigUtils.havePlugin("Portal"))) {
                if (params.t) {
                    this.props.showNotification("missingtheme", LocaleUtils.tr("app.missingtheme", params.t), NotificationType.WARN, true);
                    params.l = undefined;
                    params.bl = undefined;
                    params.c = undefined;
                    params.e = undefined;
                    params.s = undefined;
                }
                const userDefaultTheme = Object.fromEntries(this.props.defaultUrlParams.split("&").map(x => x.split("="))).t;
                const defaultTheme = themes.defaultTheme;
                if (userDefaultTheme) {
                    theme = ThemeUtils.getThemeById(themes, userDefaultTheme) ?? ThemeUtils.getThemeById(themes, defaultTheme);
                } else {
                    theme = ThemeUtils.getThemeById(themes, defaultTheme);
                }
            }

            if (theme) {
                // Compute initial view
                const initialView = params.v;
                let initialExtent = null;
                if (params.c && params.s !== undefined) {
                    const coords = params.c.split(/[;,]/g).map(x => parseFloat(x) || 0);
                    const scales = theme.scales || themes.defaultScales;
                    const zoom = MapUtils.computeZoom(scales, params.s);
                    if (coords.length === 2) {
                        const p = CoordinatesUtils.reproject(coords, params.crs || theme.mapCrs, theme.bbox.crs);
                        const bounds = theme.bbox.bounds;
                        // Only accept c if it is within the theme bounds
                        if (bounds[0] <= p[0] && p[0] <= bounds[2] && bounds[1] <= p[1] && p[1] <= bounds[3]) {
                            initialExtent = {
                                center: coords,
                                zoom: zoom,
                                crs: params.crs || theme.mapCrs
                            };
                        } else {
                            initialExtent = {
                                center: [0.5 * (bounds[0] + bounds[2]), 0.5 * (bounds[1] + bounds[3])],
                                zoom: zoom,
                                crs: theme.bbox.crs
                            };
                        }
                    }
                } else if (params.e) {
                    const bounds = params.e.split(/[;,]/g).map(x => parseFloat(x) || 0);
                    if (CoordinatesUtils.isValidExtent(bounds)) {
                        initialExtent = {
                            bounds: bounds,
                            crs: params.crs || theme.mapCrs
                        };
                    }
                }
                const layerParams = params.l !== undefined ? params.l.split(",").filter(entry => entry) : null;
                if (layerParams && ConfigUtils.getConfigProp("urlReverseLayerOrder")) {
                    layerParams.reverse();
                }
                this.props.setCurrentTheme(theme, themes, false, initialExtent, layerParams, params.bl ?? null, state.layers, this.props.appConfig.themeLayerRestorer, this.props.appConfig.externalLayerRestorer, initialView);
            } else if (!ConfigUtils.havePlugin("Portal")) {
                this.props.showNotification("missingdefaulttheme", LocaleUtils.tr("app.missingdefaulttheme", params.t), NotificationType.WARN, true);
            }

            const task = ConfigUtils.getConfigProp("startupTask");
            if (task && !theme?.config?.startupTask) {
                const mapClickAction = ConfigUtils.getPluginConfig(task.key).mapClickAction;
                this.props.setCurrentTask(task.key, task.mode, mapClickAction);
            }
        });
    };
    render() {
        const device = ConfigUtils.isMobile() ? 'mobile' : 'desktop';
        const pluginsConf = this.props.localConfig.plugins[device];
        return (
            <PluginsContainer pluginsConfig={pluginsConf} />
        );
    }
}

const AppContainer = connect(state => ({
    locale: state.locale.current,
    haveMapSize: state.map.size !== null,
    defaultUrlParams: state.localConfig.user_infos?.default_url_params || "",
    localConfig: state.localConfig
}), {
    themesLoaded: themesLoaded,
    setCurrentTask: setCurrentTask,
    setCurrentTheme: setCurrentTheme,
    showNotification: showNotification,
    setTopbarHeight: setTopbarHeight,
    setBottombarHeight: setBottombarHeight
})(AppContainerComponent);


export default class StandardApp extends React.Component {
    static store = null;
    static propTypes = {
        appConfig: PropTypes.object
    };
    state = {
        startupConfig: null,
        haveConfig: false,
        haveLocale: false
    };
    constructor(props) {
        super(props);
        const initialState = this.props.appConfig.initialState || {};
        StandardApp.store = createStore(ReducerIndex.reducers, initialState, this.props.appConfig.actionLogger);
        this.init();
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
        if (!this.state.startupConfig || !this.state.haveConfig || !this.state.haveLocale) {
            return null;
        }
        return (
            <Provider store={StandardApp.store}>
                <AppContainer appConfig={this.props.appConfig} startupConfig={this.state.startupConfig}/>
            </Provider>
        );
    }
    init = () => {
        // Save initial params and clear URL
        const initialParams = UrlParams.getParams();
        UrlParams.clear();

        // Set builtin plugins
        PluginStore.setBuiltinPlugins(this.props.appConfig.pluginsDef.plugins);

        // Load config.json
        const configParams = Object.entries(initialParams).reduce((res, [key, value]) => {
            if (key.startsWith("config:")) {
                res[key.slice(7)] = value;
            }
            return res;
        }, {});
        ConfigUtils.loadConfiguration(configParams).then((config) => {
            // Merge common config into mobile/desktop config, merge config from appConfig
            const renameTaskButtons = (res, entry) => {
                const key = entry.name + (entry.name === "TaskButton" ? "#" + (entry.cfg?.task ?? "") : "");
                return {...res, [key]: entry};
            };
            const commonConfig = [
                ...(config.plugins.common || []), ...(window.QWC2PluginConfig?.common || [])
            ].reduce(renameTaskButtons, {});
            const desktopConfig = [
                ...(config.plugins.desktop || []), ...(window.QWC2PluginConfig?.desktop || [])
            ].reduce(renameTaskButtons, {});
            const mobileConfig = [
                ...(config.plugins.mobile || []), ...(window.QWC2PluginConfig?.mobile || [])
            ].reduce(renameTaskButtons, {});

            const completePluginConfig = (pluginConfig) => {
                return Object.entries(pluginConfig).map(([key, entry]) => {
                    const plugin = this.props.appConfig.pluginsDef.plugins[entry.name + "Plugin"];
                    const component = plugin?.WrappedComponent ?? plugin;
                    const availableIn3D = component?.availableIn3D ?? false;
                    return {
                        ...entry,
                        key,
                        availableIn3D,
                        cfg: {
                            ...entry.cfg,
                            ...this.props.appConfig.pluginsDef.cfg[entry.name + "Plugin"]
                        }
                    };
                });
            };
            config.plugins.desktop = completePluginConfig(deepmerge(commonConfig, desktopConfig));
            config.plugins.mobile = completePluginConfig(deepmerge(commonConfig, mobileConfig));
            delete config.plugins.common;

            // Add projections from config
            for (const proj of config.projections || []) {
                if (Proj4js.defs(proj.code) === undefined) {
                    Proj4js.defs(proj.code, proj.proj);
                }
                CoordinatesUtils.setCrsLabels({[proj.code]: proj.label});
            }
            olProj4Register(Proj4js);
            StandardApp.store.dispatch(localConfigLoaded(config));
            this.setState({haveConfig: true});

            // Load locale
            const lang = this.props.appConfig.getDefaultLocale?.() ?? initialParams.lang ?? navigator.language;
            LocaleUtils.loadLocale(lang, this.props.appConfig.defaultLocaleData).then(localeData => {
                StandardApp.store.dispatch(changeLocale(localeData, this.props.appConfig.defaultLocaleData));
                this.setState({haveLocale: true});
            });

            // Set color scheme
            const storedColorScheme = ConfigUtils.havePlugin("Settings") ? localStorage.getItem('qwc2-color-scheme') : null;
            const colorScheme = initialParams.style || storedColorScheme || ConfigUtils.getConfigProp("defaultColorScheme");
            StandardApp.store.dispatch(setColorScheme(colorScheme));

            // Resolve permalink and restore settings
            resolvePermaLink(initialParams, (params, state, success) => {
                StandardApp.store.dispatch(setStartupParameters(params, state));
                this.setState({startupConfig: {
                    params, state, permalinkInvalid: !success
                }});
            });
        });
    };
}
