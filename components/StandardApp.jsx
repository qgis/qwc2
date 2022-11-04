/**
 * Copyright 2016 GeoSolutions Sas
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {Provider, useSelector, useDispatch} from 'react-redux';

// Needed for IE11 to avoid 'Promise not defined' error in axios
import "core-js/stable";
import "regenerator-runtime/runtime";


import axios from 'axios';
import Proj4js from 'proj4';
import {register as olProj4Register} from 'ol/proj/proj4';

import Localized from './Localized';
import StandardStore from '../stores/StandardStore';
import PluginsContainer from './PluginsContainer';

import {changeBrowserProperties} from '../actions/browser';
import {loadLocale} from '../actions/locale';
import {localConfigLoaded, setStartupParameters} from '../actions/localConfig';
import {themesLoaded, setCurrentTheme} from '../actions/theme';
import {setCurrentTask} from '../actions/task';

import ConfigUtils from '../utils/ConfigUtils';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import MapUtils from '../utils/MapUtils';
import MiscUtils from '../utils/MiscUtils';
import {UrlParams, resolvePermaLink} from '../utils/PermaLinkUtils';
import ThemeUtils from '../utils/ThemeUtils';

import './style/App.css';

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

const AppInitComponent = ({ appConfig, initialParams }) => {
    const { mapSize, layers } = useSelector((state) => ({
        mapSize: state.map.size,
        layers: state.layers.flat
    }));
    const dispatch = useDispatch();
    const initializedRef = useRef(false);

    const init = () => {
        initializedRef.current = true;

        // Load themes.json
        axios.get("themes.json").then(response => {
            const themes = response.data.themes || {};
            if (appConfig.themePreprocessor) {
                appConfig.themePreprocessor(themes);
            }
            dispatch(themesLoaded(themes));

            // Resolve permalink and restore settings
            resolvePermaLink(initialParams, (params) => {
                dispatch(setStartupParameters(params));
                let theme = ThemeUtils.getThemeById(themes,  params.t);
                if (!theme || theme.restricted) {
                    if (ConfigUtils.getConfigProp("dontLoadDefaultTheme")) {
                        return;
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
                        dispatch(
                            setCurrentTheme(
                                theme,
                                themes,
                                false,
                                initialView,
                                layerParams,
                                visibleBgLayer,
                                layers,
                                appConfig.themeLayerRestorer,
                                appConfig.externalLayerRestorer
                            )
                        );
                    } catch (e) {
                        console.log(e.stack);
                    }
                }
            });
        });
        const task = ConfigUtils.getConfigProp("startupTask");
        if (task) {
            dispatch(setCurrentTask(task.key, task.mode, task.mapClickAction));
        }
    };

    useEffect(() => {
        if (mapSize && !initializedRef.current) {
            init();
        }
    }, [mapSize]);

    return null;
};

const StandardApp = ({ appConfig }) => {
    const [store, setStore] = useState(() => {
        StandardStore.init(appConfig.initialState || {}, appConfig.actionLogger);
        return StandardStore.get();
    });
    const [initialParams] = useState(UrlParams.getParams());
    const [touchY, setTouchY] = useState(null);

    const init = () => {
        // Detect browser properties
        store.dispatch(changeBrowserProperties(ConfigUtils.getBrowserProperties()));

        // Load config.json
        const configParams = Object.entries(UrlParams.getParams()).reduce((res, [key, value]) => {
            if (key.startsWith("config:")) {
                res[key.slice(7)] = value;
            }
            return res;
        }, {});
        ConfigUtils.loadConfiguration(configParams).then((config) => {
            store.dispatch(localConfigLoaded(config));
            const defaultLocale = appConfig.getDefaultLocale ? appConfig.getDefaultLocale() : "";
            // Dispatch user locale
            store.dispatch(loadLocale(appConfig.defaultLocaleData, defaultLocale));
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

    useEffect(() => {
        setStore(StandardStore.get());
        init();
    }, [store]);

    useEffect(() => {
        const computeVh = () => {
            // https://css-tricks.com/the-trick-to-viewport-units-on-mobile/
            document.documentElement.style.setProperty('--vh', (window.innerHeight * 0.01 ) + 'px');
        };
        computeVh();
        window.addEventListener('resize', computeVh);

        return window.removeEventListener('resize', computeVh);
    }, []);

    const preventOverscroll = useCallback((ev) => {
        if (ev.touches[0].touchType !== "direct") {
            // Don't do anything for stylus inputs
            return;
        }
        let scrollEvent = false;
        let element = ev.target;
        const direction = ev.targetTouches[0].clientY - touchY;
        setTouchY(ev.targetTouches[0].clientY);
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
    }, [touchY]);
    const setupTouchEvents = useCallback((el) => {
        el.addEventListener('touchstart', ev => {
            setTouchY(ev.targetTouches[0].clientY);
        }, { passive: false });
        el.addEventListener('touchmove', preventOverscroll, { passive: false });
    }, [preventOverscroll]);

    const plugins = appConfig.pluginsDef.plugins;
    return (
        <Provider store={store}>
            <div ref={setupTouchEvents}>
                <AppInitComponent appConfig={appConfig} initialParams={initialParams}/>
                <Localized>
                    <PluginsContainer plugins={plugins} pluginsAppConfig={appConfig.pluginsDef.cfg || {}} />
                </Localized>
            </div>
        </Provider>
    );
};

StandardApp.propTypes = {
    appConfig: PropTypes.object
};

export default StandardApp;
