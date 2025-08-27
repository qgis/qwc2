/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect, Provider} from 'react-redux';

import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';

import * as displayExports from '../actions/display';
import {setView3dMode, View3DMode} from '../actions/display';
import * as layersExports from '../actions/layers';
import {LayerRole, addLayerFeatures, removeLayer} from '../actions/layers';
import {panTo, zoomToPoint} from '../actions/map';
import * as mapExports from '../actions/map';
import * as themeExports from '../actions/theme';
import PluginsContainer from '../components/PluginsContainer';
import ResizeableWindow from '../components/ResizeableWindow';
import StandardApp from '../components/StandardApp';
import View3DSwitcher from '../components/map3d/View3DSwitcher';
import Spinner from '../components/widgets/Spinner';
import ReducerIndex from '../reducers/index';
import personIcon from '../resources/person.png';
import {createStore} from '../stores/StandardStore';
import ConfigUtils from '../utils/ConfigUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';
import {UrlParams} from '../utils/PermaLinkUtils';

import './style/View3D.css';


/**
 * Displays a 3D map view.
 *
 * ### Configuration
 *
 * To add a 3D View to a theme, add the following configuration block to a theme item in `themesConfig.json`:
 * ```
 * "map3d": {
 *     "initialView": {
 *       "camera": [x, y, z],
 *       "target": [x, y, z],
 *       "personHeight": h
 *     },
 *     "dtm": {"url": "<url_to_dtm.tif>", "crs": "<dtm_epsg_code>},
 *     "basemaps": [
 *          {"name": "<name_of_background_layer>", "visibility": true, "overview": true},
 *          {"name": "<name_of_background_layer>"},
 *          ...
 *     ],
 *     "tiles3d": [
 *          {
 *              "name": "<name>",
 *              "url": "<url_to_tileset.json>",
 *              "title": "<title>",
 *              "baseColor": "<css RGB(A) color string>",
 *              "idAttr": "<tile_feature_attr>",
 *              "styles": {"<styleName>", "<url_to_tilesetStyle.json>", ...},
 *              "style": "<styleName>",
 *              "colorAttr": "<tile_feature_attr>",
 *              "alphaAttr": "<tile_feature_attr>",
 *              "labelAttr": "<tile_feature_attr>",
 *          }
 *     ],
 *     "objects3d": [
 *         {
 *              "name": "<name>",
 *              "url": "<url_to_file.gltf>",
 *              "title": "<title>"
 *         }
 *     ]
 * }
 * ```
 * Where:
 *
 * - `initialView` is optional and allows to define the initial view when opening the 3D view. If `personHeight` is specified and greater than 0, the first-person view is activated. If not specified, the 2D view is synchronized.
 * - The DTM should be a cloud optimized GeoTIFF.
 * - The background layer names refer to the names of the entries defined in `backgroundLayers` in the `themesConfig.json`. Additionally:
 *    - `visibility` controls the initially visibile background layer
 *    - `overview: true` controls the name of background layer to display in the overview map. If no background layer is marked with `overview: true`, the currently visibile background layer id dipslayed in the overview map.
 * - The `tiles3d` entry contains an optional list of 3d tiles to add to the scene, with:
 *    - `idAttr`: feature properties table attribute which stores the object id, used for styling and passed to `tileInfoServiceUrl` of the `Identify3D` plugin. Default: `id`.
 *    - `styles`: optional, available tileset styles. Takes precedente over `colorAttr`, `alphaAttr`, `labelAttr`.
 *    - `style`: optional, tileset style enabled by default.
 *    - `baseColor`: the fallback color for the tile objects, defaults to white.
 *    - `colorAttr`: optional, feature properties table attribute which stores the feature color, as a 0xRRGGBB integer.
 *    - `alphaAttr`: optional, feature properties table attribute which stores the feature alpha (transparency), as a [0, 255] integer.
 *    - `labelAttr`: optional, feature properties table attribute which stores the feature label, displayed above the geometry.
 * - The `objects3d` entry contains an optional list of GLTF objects to add to the scene.
 *
 * You can control whether a theme is loaded by default in 2D, 3D or splitscreen 2D/3D view via `startupView` in the [theme item configuration]().
 *
 *
 * ### Styling
 *
 * The tileset style JSON is a [3D Tiles stylesheet](https://github.com/CesiumGS/3d-tiles/tree/main/specification/Styling),
 * of which currently the `color` section is supported, and which may in addition also contain a `featureStyles` section as follows:
 * ```
 * {
 *     "color": {
 *        ...
 *     },
 *     "featureStyles": {
 *       "<object_id>": {
 *           "label": "<label>",
 *           "labelOffset": <offset>,
 *           "color": "<css RGB(A) color string>"
 *       }
 *    }
 * }
 * ```
 * Where:
 *
 * - `label` is an optional string with which to label the object.
 * - `labelOffset` is an optional number which represents the vertical offset between the object top and the label. Defaults to 80.
 * - `color` is an optional CSS color string which defines the object color.
 *
 * *Note*:
 *
 * - The color declarations in the `featureStyles` section override any color resulting from a color expression in the `color` section.
 * - You must ensure that your 3D tiles properties table contains all attributes which are referenced as variables in a color expression!
 *
 * ### Import
 *
 * To import scene objects in formats other than GLTF, a `ogcProcessesUrl` in `config.json` needs to point to a BBOX OGC processes server.
 */
class View3D extends React.Component {
    static propTypes = {
        addLayerFeatures: PropTypes.func,
        /** The position slot index of the 3d switch map button, from the bottom (0: bottom slot). */
        buttonPosition: PropTypes.number,
        /** The position of the navigation controls. Either `top` or `bottom`. */
        controlsPosition: PropTypes.string,
        /** The default scene quality factor (`20`: min, `100`: max). */
        defaultSceneQuality: PropTypes.number,
        display: PropTypes.object,
        /** Default window geometry. */
        geometry: PropTypes.shape({
            initialWidth: PropTypes.number,
            initialHeight: PropTypes.number,
            initialX: PropTypes.number,
            initialY: PropTypes.number,
            initiallyDocked: PropTypes.bool
        }),
        layers: PropTypes.object,
        localConfig: PropTypes.object,
        map: PropTypes.object,
        panTo: PropTypes.func,
        /** Options to pass to the 3D plugins, in the form `{"<PluginName>": {<options>}}`.
         * Refer to the documentation of the <a href="#plugins3d">3D plugins</a> for settable options. */
        pluginOptions: PropTypes.object,
        plugins3d: PropTypes.object,
        removeLayer: PropTypes.func,
        searchProviders: PropTypes.object,
        setView3dMode: PropTypes.func,
        startupParams: PropTypes.object,
        startupState: PropTypes.object,
        theme: PropTypes.object,
        view3dMode: PropTypes.number,
        zoomToPoint: PropTypes.func
    };
    static defaultProps = {
        buttonPosition: 6,
        controlsPosition: 'top',
        geometry: {
            initialWidth: 600,
            initialHeight: 800,
            initialX: 0,
            initialY: 0,
            initiallyDocked: true
        },
        pluginOptions: {}
    };
    state = {
        componentLoaded: false,
        windowDetached: false,
        viewsLocked: false,
        storedState: null
    };
    constructor(props) {
        super(props);
        this.map3dComponent = null;
        this.map3dComponentRef = null;
        this.focusedMap = null;
        this.firstPersonMarker = true;
        // Subset of 2d reducers
        const {
            processNotifications,
            task,
            windows
        } = ReducerIndex.reducers;

        // Reducer for syncronization with parent store
        const forwardReducer = (key, forwardActions, syncAction) => (state = {}, action) => {
            if (forwardActions.includes(action.type)) {
                // Forward to parent store
                StandardApp.store.dispatch(action);
                return state;
            } else {
                return action.type === syncAction ? action[key] : state;
            }
        };
        const displayActions = Object.values(displayExports).filter(x => typeof(x) === 'string');
        const layersActions = Object.values(layersExports).filter(x => typeof(x) === 'string');
        const mapActions = Object.values(mapExports).filter(x => typeof(x) === 'string');
        const themeActions = Object.values(themeExports).filter(x => typeof(x) === 'string');
        const display = forwardReducer("display", displayActions, "SYNC_DISPLAY_FROM_PARENT_STORE");
        const layers = forwardReducer("layers", layersActions, "SYNC_LAYERS_FROM_PARENT_STORE");
        const map = forwardReducer("map", mapActions, "SYNC_MAP_FROM_PARENT_STORE");
        const localConfig = forwardReducer("localConfig", [], "SYNC_LOCAL_CONFIG_FROM_PARENT_STORE");
        const theme = forwardReducer("theme", themeActions, "SYNC_THEME_FROM_PARENT_STORE");
        this.store = createStore({display, layers, localConfig, map, processNotifications, theme, task, windows});

        // Set stored state
        const storedState = {
            ...props.startupState.map3d
        };
        if (props.startupParams.v3d) {
            const values = props.startupParams.v3d.split(",").map(parseFloat).filter(x => !isNaN(x));
            if (values.length >= 6) {
                storedState.camera = [values[0], values[1], values[2]];
                storedState.target = [values[3], values[4], values[5]];
                storedState.personHeight = values[6] ?? 0;
            }
        }
        if (props.startupParams.bl3d !== undefined) {
            storedState.baseLayer = props.startupParams.bl3d;
        }

        this.state.storedState = storedState;
    }
    componentDidMount() {
        if (this.props.startupParams.v === "3d") {
            this.props.setView3dMode(View3DMode.FULLSCREEN);
        } else if (this.props.startupParams.v === "3d2d") {
            this.props.setView3dMode(View3DMode.SPLITSCREEN);
        }
        window.addEventListener('focus', this.trackFocus, true);
        this.syncParentStore({});
    }
    componentWillUnmount() {
        window.removeEventListener('focus', this.trackFocus);
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.view3dMode !== View3DMode.DISABLED && prevProps.view3dMode === View3DMode.DISABLED) {
            import('../components/map3d/Map3D').then(component => {
                this.map3dComponent = component.default;
                this.map3dComponentRef = null;
                this.setState({componentLoaded: true});
            });
        } else if (this.props.view3dMode === View3DMode.DISABLING && prevProps.view3dMode !== View3DMode.DISABLING) {
            if (this.map3dComponentRef) {
                this.map3dComponentRef.store3dState().then(storedState => {
                    this.setState({storedState});
                    UrlParams.updateParams({v3d: undefined, bl3d: undefined});
                    this.props.setView3dMode(View3DMode.DISABLED);
                });
            } else {
                UrlParams.updateParams({v3d: undefined, bl3d: undefined});
                this.props.setView3dMode(View3DMode.DISABLED);
            }
        } else if (this.props.view3dMode === View3DMode.DISABLED && prevProps.view3dMode !== View3DMode.DISABLED) {
            this.map3dComponent = null;
            this.map3dComponentRef = null;
            this.setState({componentLoaded: false});
            if (this.firstPersonMarker) {
                this.props.removeLayer("view3d-firstperson-marker");
                this.firstPersonMarker = false;
            }
        }
        // Sync parts of parent store
        this.syncParentStore(prevProps);
        // Handle view mode change
        if (this.props.view3dMode !== prevProps.view3dMode) {
            if (this.props.view3dMode === View3DMode.FULLSCREEN) {
                UrlParams.updateParams({v: "3d"});
                this.setState({viewsLocked: false});
            } else if (this.props.view3dMode === View3DMode.SPLITSCREEN) {
                UrlParams.updateParams({v: "3d2d"});
            } else {
                UrlParams.updateParams({v: undefined});
            }
        }
        // Switch to 2D mode if new theme has no 3D configuration
        if (
            this.props.theme.current !== prevProps.theme.current &&
            !this.props.theme.current?.map3d &&
            this.props.view3dMode !== View3DMode.DISABLED
        ) {
            this.props.setView3dMode(View3D.DISABLED);
        }
        // Lock views
        if (this.state.viewsLocked && this.props.map.bbox !== prevProps.map.bbox && this.focusedMap === "map") {
            this.sync2DExtent();
        }
        // Clear stored state when switching away from a theme
        if (prevProps.theme.current && this.props.theme.current !== prevProps.theme.current) {
            this.setState({storedState: null});
        }
    }
    syncParentStore(prevProps) {
        if (this.props.display !== prevProps.display) {
            this.store.dispatch({type: "SYNC_DISPLAY_FROM_PARENT_STORE", display: this.props.display});
        }
        if (this.props.theme !== prevProps.theme) {
            this.store.dispatch({type: "SYNC_THEME_FROM_PARENT_STORE", theme: this.props.theme});
        }
        if (this.props.localConfig !== prevProps.localConfig) {
            this.store.dispatch({type: "SYNC_LOCAL_CONFIG_FROM_PARENT_STORE", localConfig: this.props.localConfig});
        }
        if (this.props.layers !== prevProps.layers) {
            this.store.dispatch({type: "SYNC_LAYERS_FROM_PARENT_STORE", layers: this.props.layers});
        }
        if (this.props.map !== prevProps.map) {
            this.store.dispatch({type: "SYNC_MAP_FROM_PARENT_STORE", map: this.props.map});
        }
    }
    render3DWindow = () => {
        if (this.props.view3dMode > View3DMode.DISABLED) {
            const extraControls = [{
                icon: "sync",
                callback: this.sync2DExtent,
                title: LocaleUtils.tr("map3d.syncview")
            }, {
                icon: "lock",
                callback: this.setLockViews,
                title: LocaleUtils.tr("map3d.lockview"),
                active: this.state.viewsLocked
            }];
            if (!this.state.windowDetached) {
                extraControls.push({
                    icon: "maximize",
                    callback: () => this.props.setView3dMode(View3DMode.FULLSCREEN),
                    title: LocaleUtils.tr("window.maximize")
                });
            }
            const Map3D = this.map3dComponent;
            const device = ConfigUtils.isMobile() ? 'mobile' : 'desktop';
            const pluginsConfig = this.props.view3dMode === View3DMode.FULLSCREEN ? this.props.localConfig.plugins[device].filter(entry => {
                return entry.availableIn3D;
            }) : [];
            return (
                <ResizeableWindow
                    extraControls={extraControls}
                    fullscreen={this.props.view3dMode === View3DMode.FULLSCREEN}
                    icon="map3d"
                    initialHeight={this.props.geometry.initialHeight}
                    initialWidth={this.props.geometry.initialWidth}
                    initialX={this.props.geometry.initialX}
                    initialY={this.props.geometry.initialY}
                    initiallyDocked={this.props.geometry.initiallyDocked}
                    key="View3DWindow"
                    maximizeable={false}
                    onClose={this.onClose}
                    onExternalWindowResized={this.redrawScene}
                    onFocusChanged={this.windowFocusChanged}
                    onGeometryChanged={this.onGeometryChanged}
                    splitScreenWhenDocked
                    splitTopAndBottomBar
                    title={LocaleUtils.tr("map3d.title")}
                >
                    {this.state.componentLoaded ? (
                        <Provider role="body" store={this.store}>
                            <PluginsContainer pluginsConfig={pluginsConfig}>
                                <Map3D
                                    controlsPosition={this.props.controlsPosition}
                                    defaultSceneQuality={this.props.defaultSceneQuality}
                                    innerRef={this.setRef}
                                    onCameraChanged={this.onCameraChanged}
                                    onMapInitialized={this.setupMap}
                                    pluginOptions={this.props.pluginOptions}
                                    plugins3d={this.props.plugins3d}
                                    searchProviders={this.props.searchProviders}
                                    theme={this.props.theme} />
                                {
                                    this.props.view3dMode === View3DMode.DISABLING ? (
                                        <div className="view3d-busy-overlay">
                                            <Spinner /><span>{LocaleUtils.tr("view3d.storingstate")}</span>
                                        </div>
                                    ) : null
                                }
                            </PluginsContainer>
                        </Provider>
                    ) : null}
                </ResizeableWindow>
            );
        }
        return null;
    };
    render() {
        const button = this.props.theme.current?.map3d ? (
            <View3DSwitcher key="View3DButton" position={this.props.buttonPosition} />
        ) : null;
        return [button, this.render3DWindow()];
    }
    onClose = () => {
        this.props.setView3dMode(View3DMode.DISABLING);
    };
    onGeometryChanged = (geometry) => {
        if (geometry.maximized && this.props.view3dMode !== View3DMode.FULLSCREEN) {
            this.props.setView3dMode(View3DMode.FULLSCREEN);
        }
        this.setState({windowDetached: geometry.detached});
    };
    onCameraChanged = (center, camera, fov) => {
        // Note: If camera pos is NULL, we are in first-person-view
        if (this.state.viewsLocked && this.focusedMap === "map3d") {
            let rotation = undefined;
            if (camera) {
                rotation = Math.atan2(center[1] - camera[1], center[0] - camera[0]) - 0.5 * Math.PI;
                const distance = Math.sqrt(
                    (camera[0] - center[0]) * (camera[0] - center[0]) +
                    (camera[1] - center[1]) * (camera[1] - center[1]) +
                    (camera[2] - center[2]) * (camera[2] - center[2])
                );
                const fovrad = fov / 180 * Math.PI;
                const bboxWidth = distance * (2 * Math.tan(fovrad / 2));
                const bbox = [-0.5 * bboxWidth, 0, 0.5 * bboxWidth, 0];
                const zoom = MapUtils.getZoomForExtent(bbox, this.props.map.resolutions, this.props.map.size, 0, this.props.map.scales.length - 1);
                this.props.zoomToPoint(center.slice(0, 2), zoom, this.props.theme.mapCrs, rotation);
                if (this.firstPersonMarker) {
                    this.props.removeLayer("view3d-firstperson-cone");
                    this.firstPersonMarker = false;
                }
            } else {
                this.props.panTo(center.slice(0, 2), this.props.theme.mapCrs, rotation);

                const feature = {
                    geometry: {
                        type: 'Point',
                        coordinates: center.slice(0, 2)
                    },
                    crs: this.props.theme.mapCrs,
                    styleName: 'marker',
                    styleOptions: {
                        iconSrc: personIcon
                    }
                };
                const layer = {
                    id: "view3d-firstperson-marker",
                    role: LayerRole.MARKER
                };
                this.props.addLayerFeatures(layer, [feature], true);
                this.firstPersonMarker = true;

            }
        } else if (this.firstPersonMarker) {
            this.props.removeLayer("view3d-firstperson-marker");
            this.firstPersonMarker = false;
        }
    };
    setRef = (ref) => {
        this.map3dComponentRef = ref;
    };
    sync2DExtent = () => {
        if (this.map3dComponentRef) {
            this.map3dComponentRef.setViewToExtent(this.props.map.bbox.bounds, this.props.map.bbox.rotation);
        }
    };
    setLockViews = () => {
        this.setState(state => ({viewsLocked: !state.viewsLocked}));
        if (this.firstPersonMarker) {
            this.props.removeLayer("view3d-firstperson-marker");
            this.firstPersonMarker = false;
        }
    };
    setupMap = () => {
        if (this.map3dComponentRef) {
            if (!isEmpty(this.state.storedState)) {
                this.map3dComponentRef.restore3dState(this.state.storedState);
            } else if (this.props.theme.current.map3d.initialView) {
                this.map3dComponentRef.restore3dState(this.props.theme.current.map3d.initialView);
            } else {
                this.sync2DExtent();
            }
        }
    };
    redrawScene = (ev) => {
        if (this.map3dComponentRef) {
            this.map3dComponentRef.redrawScene(ev);
        }
    };
    trackFocus = (ev) => {
        const mapEl = document.getElementById("map");
        const map3dEl = document.getElementById("map3d");
        if (mapEl?.contains?.(document.activeElement)) {
            this.focusedMap = "map";
        } else if (map3dEl?.contains?.(document.activeElement)) {
            this.focusedMap = "map3d";
        } else {
            this.focusedMap = null;
        }
    };
}

export default (plugins3d) => connect(
    (state) => ({
        plugins3d: plugins3d,
        display: state.display,
        map: state.map,
        layers: state.layers,
        theme: state.theme,
        localConfig: state.localConfig,
        view3dMode: state.display.view3dMode,
        startupParams: state.localConfig.startupParams,
        startupState: state.localConfig.startupState
    }), {
        addLayerFeatures: addLayerFeatures,
        removeLayer: removeLayer,
        panTo: panTo,
        zoomToPoint: zoomToPoint,
        setView3dMode: setView3dMode
    }
)(View3D);
