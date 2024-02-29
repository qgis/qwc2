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

import {changeBrowserProperties} from '../actions/browser';
import {addLayer} from '../actions/layers';
import {localConfigLoaded, setStartupParameters, setColorScheme} from '../actions/localConfig';
import {loadLocale} from '../actions/locale';
import {changeSearch} from '../actions/search';
import {setCurrentTask} from '../actions/task';
import {themesLoaded, setCurrentTheme} from '../actions/theme';
import {NotificationType, showNotification} from '../actions/windows';
import StandardStore from '../stores/StandardStore';
import ConfigUtils from '../utils/ConfigUtils';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';
import MiscUtils from '../utils/MiscUtils';
import {UrlParams, resolvePermaLink} from '../utils/PermaLinkUtils';
import ThemeUtils from '../utils/ThemeUtils';
import Localized from './Localized';
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


class AppInitComponent extends React.Component {
    static propTypes = {
        addLayer: PropTypes.func,
        appConfig: PropTypes.object,
        changeSearch: PropTypes.func,
        initialParams: PropTypes.object,
        mapSize: PropTypes.object,
        setColorScheme: PropTypes.func,
        setCurrentTask: PropTypes.func,
        setCurrentTheme: PropTypes.func,
        setStartupParameters: PropTypes.func,
        showNotification: PropTypes.func,
        themesLoaded: PropTypes.func
    };
    constructor(props) {
        super(props);
        this.initialized = false;
    }
    componentDidMount() {
        this.componentDidUpdate();
    }
    componentDidUpdate() {
        // The map component needs to have finished loading before theme initialization can proceed
        if (this.props.mapSize && !this.initialized) {
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
                this.props.setStartupParameters({...params});
                let theme = ThemeUtils.getThemeById(themes,  params.t);
                if (!theme || theme.restricted) {
                    if (ConfigUtils.getConfigProp("dontLoadDefaultTheme")) {
                        return;
                    }
                    if (params.t) {
                        this.props.showNotification("missingtheme", LocaleUtils.tr("app.missingtheme", params.t), NotificationType.WARN, true);
                        params.l = undefined;
                    }
                    theme = ThemeUtils.getThemeById(themes, themes.defaultTheme);
                }
                const layerParams = params.l !== undefined ? params.l.split(",").filter(entry => entry) : null;
                if (layerParams && ConfigUtils.getConfigProp("urlReverseLayerOrder")) {
                    layerParams.reverse();
                }
                const visibleBgLayer = params.bl || params.bl === '' ? params.bl : null;
                let initialView = null;
                if (theme) {
                    if (params.c && params.s !== undefined) {
                        const coords = params.c.split(/[;,]/g).map(x => parseFloat(x));
                        const scales = theme.scales || themes.defaultScales;
                        const zoom = MapUtils.computeZoom(scales, params.s);
                        if (coords.length === 2) {
                            initialView = {
                                center: coords,
                                zoom: zoom,
                                crs: params.crs || theme.mapCrs};
                        }
                    } else if (params.e) {
                        const bounds = params.e.split(/[;,]/g).map(x => parseFloat(x));
                        if (bounds.length === 4) {
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
        return null;
    }
}

const AppInit = connect(state => ({
    mapSize: state.map.size,
    layers: state.layers.flat,
    currentTask: state.task.id
}), {
    themesLoaded: themesLoaded,
    setCurrentTask: setCurrentTask,
    changeSearch: changeSearch,
    setColorScheme: setColorScheme,
    setCurrentTheme: setCurrentTheme,
    setStartupParameters: setStartupParameters,
    addLayer: addLayer,
    showNotification: showNotification
})(AppInitComponent);


export default class StandardApp extends React.Component {
    static propTypes = {
        appConfig: PropTypes.object
    };
    constructor(props) {
        super(props);
        StandardStore.init(this.props.appConfig.initialState || {}, this.props.appConfig.actionLogger);
        this.store = StandardStore.get();
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
        const plugins = this.props.appConfig.pluginsDef.plugins;
        return (
            <Provider store={this.store}>
                <div ref={this.setupTouchEvents}>
                    <AppInit appConfig={this.props.appConfig} initialParams={this.initialParams}/>
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
        // Detect browser properties
        this.store.dispatch(changeBrowserProperties(ConfigUtils.getBrowserProperties()));

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
            this.store.dispatch(localConfigLoaded(config));
            const defaultLocale = this.props.appConfig.getDefaultLocale ? this.props.appConfig.getDefaultLocale() : "";
            // Dispatch user locale
            this.store.dispatch(loadLocale(this.props.appConfig.defaultLocaleData, defaultLocale));
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
