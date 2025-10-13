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
 * See [3D View](../../topics/View3D).
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
        /** Mouse buttons assignment. You can assign `pan`, `rotate`, `zoom` to each button.  */
        mouseButtons: PropTypes.shape({
            left: PropTypes.string,
            middle: PropTypes.string,
            right: PropTypes.string
        }),
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
        defaultSceneQuality: 100,
        geometry: {
            initialWidth: 600,
            initialHeight: 800,
            initialX: 0,
            initialY: 0,
            initiallyDocked: true
        },
        pluginOptions: {},
        mouseButtons: {
            left: 'pan',
            middle: 'zoom',
            right: 'rotate'
        }
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
            this.syncParentStore(this.props, true);
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
                UrlParams.updateParams({v: "2d"});
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
    syncParentStore(prevProps, force = false) {
        if (this.props.view3dMode === View3DMode.DISABLED) {
            return;
        }
        if (this.props.display !== prevProps.display || force) {
            this.store.dispatch({type: "SYNC_DISPLAY_FROM_PARENT_STORE", display: this.props.display});
        }
        if (this.props.theme !== prevProps.theme || force) {
            this.store.dispatch({type: "SYNC_THEME_FROM_PARENT_STORE", theme: this.props.theme});
        }
        if (this.props.localConfig !== prevProps.localConfig || force) {
            this.store.dispatch({type: "SYNC_LOCAL_CONFIG_FROM_PARENT_STORE", localConfig: this.props.localConfig});
        }
        if (this.props.layers !== prevProps.layers || force) {
            this.store.dispatch({type: "SYNC_LAYERS_FROM_PARENT_STORE", layers: this.props.layers});
        }
        if (this.props.map !== prevProps.map || force) {
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
                                    mouseButtons={this.props.mouseButtons}
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
