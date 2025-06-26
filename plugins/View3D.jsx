/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect, Provider} from 'react-redux';

import PropTypes from 'prop-types';
import {createSelector} from 'reselect';

import * as displayExports from '../actions/display';
import {setView3dMode, View3DMode} from '../actions/display';
import * as layersExports from '../actions/layers';
import {panTo} from '../actions/map';
import * as mapExports from '../actions/map';
import {setCurrentTask} from '../actions/task';
import * as themeExports from '../actions/theme';
import PluginsContainer from '../components/PluginsContainer';
import ResizeableWindow from '../components/ResizeableWindow';
import StandardApp from '../components/StandardApp';
import View3DSwitcher from '../components/map3d/View3DSwitcher';
import ReducerIndex from '../reducers/index';
import searchProvidersSelector from '../selectors/searchproviders';
import {createStore} from '../stores/StandardStore';
import LocaleUtils from '../utils/LocaleUtils';
import {UrlParams} from '../utils/PermaLinkUtils';


/**
 * Displays a 3D map view.
 *
 * To add a 3D View to a theme, add the following configuration block to a theme item in `themesConfig.json`:
 * ```
 * "map3d": {
 *     "dtm": {"url": "<url_to_dtm.tif>", "crs": "<dtm_epsg_code>},
 *     "basemaps": [
 *          {"name": "<name_of_background_layer>", "visibility": true},
 *          {"name": "<name_of_background_layer>"},
 *          ...
 *     ],
 *     "tiles3d": [
 *          {
 *              "name": "<name>",
 *              "url": "<url_to_tileset.json>",
 *              "title": "<title>",
 *              "idAttr": "<tile_batch_attr>",
 *              "styles": {"<styleName>", "<url_to_tilesetStyle.json>", ...},
 *              "style": "<styleName>",
 *              "colorAttr": "<tile_batch_attr>",
 *              "alphaAttr": "<tile_batch_attr>",
 *              "labelAttr": "<tile_batch_attr>",
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
 * - The DTM should be a cloud optimized GeoTIFF.
 * - The background layer names refer to the names of the entries defined in `backgroundLayers` in the `themesConfig.json`.
 * - The `tiles3d` entry contains an optional list of 3d tiles to add to the scene, with:
 *   - `idAttr`: Batch table attribute which stores the batch object id, used for styling and passed to `tileInfoServiceUrl`. Default: `id`.
 *   - `styles`: optional, available tileset styles. Takes precedente over `colorAttr`, `alphaAttr`, `labelAttr`.
 *   - `style`: optional, tileset style enabled by default.
 *   - `colorAttr`: optional, batch table attribute which stores the batch color, as a 0xRRGGBB integer.
 *   - `alphaAttr`: optional, batch table attribute which stores the batch alpha (transparency), as a [0, 255] integer.
 *   - `labelAttr`: optional, batch table attribute which stores the batch label, displayed above the geometry.
 * - The `objects3d` entry contains an optional list of GLTF objects to add to the scene.
 *
 * The tileset style JSON is shaped as follows:
 * ```
 * {
 *     "<object_id>": {
 *         "label": "<label>",
 *         "labelOffset": <offset>,
 *         "color": "<css RGB(A) color string>"
 *     }
 * }
 * ```
 * Where:
 *
 * - `label` is an optional string with which to label the object.
 * - `labelOffset` is an optional number which represents the vertical offset between the object top and the label. Defaults to 80.
 * - `color` is an optional CSS color string which defines the object color.
 */
class View3D extends React.Component {
    static propTypes = {
        /** The position slot index of the 3d switch map button, from the bottom (0: bottom slot). */
        buttonPosition: PropTypes.number,
        display: PropTypes.object,
        enabled: PropTypes.bool,
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
        plugins: PropTypes.object,
        pluginsConfig: PropTypes.object,
        /** Minimum scale denominator when zooming to search result. */
        searchMinScaleDenom: PropTypes.number,
        searchProviders: PropTypes.object,
        setCurrentTask: PropTypes.func,
        setView3dMode: PropTypes.func,
        startupParams: PropTypes.object,
        startupState: PropTypes.object,
        theme: PropTypes.object,
        /** URL to service for querying additional tile information.
         * Can contain the `{tileset}` and `{objectid}` placeholders.
         * Expected to return a JSON dict with attributes.*/
        tileInfoServiceUrl: PropTypes.string,
        view3dMode: PropTypes.number
    };
    static defaultProps = {
        buttonPosition: 6,
        geometry: {
            initialWidth: 600,
            initialHeight: 800,
            initialX: 0,
            initialY: 0,
            initiallyDocked: true
        },
        searchMinScaleDenom: 1000
    };
    state = {
        componentLoaded: false,
        windowDetached: false,
        viewsLocked: false
    };
    constructor(props) {
        super(props);
        this.map3dComponent = null;
        this.map3dComponentRef = null;
        this.map3dFocused = false;
        // Subset of 2d reducers
        const {
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
        this.store = createStore({display, layers, localConfig, map, theme, task, windows});
    }
    componentDidMount() {
        if (this.props.startupParams.v === "3d") {
            this.props.setView3dMode(View3DMode.FULLSCREEN);
            this.restoreOnComponentLoad = true;
        } else if (this.props.startupParams.v === "3d2d") {
            this.props.setView3dMode(View3DMode.SPLITSCREEN);
            this.restoreOnComponentLoad = true;
        }
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.enabled && !prevProps.enabled) {
            this.setState({mode: View3DMode.FULLSCREEN});
            this.props.setCurrentTask(null);
        } else if (this.props.display.view3dMode !== View3DMode.DISABLED && prevProps.display.view3dMode === View3DMode.DISABLED) {
            import('../components/map3d/Map3D').then(component => {
                this.map3dComponent = component.default;
                this.map3dComponentRef = null;
                this.setState({componentLoaded: true});
            });
        } else if (this.props.display.view3dMode === View3DMode.DISABLED && prevProps.display.view3dMode !== View3DMode.DISABLED) {
            this.map3dComponent = null;
            this.map3dComponentRef = null;
            this.setState({componentLoaded: false});
        }
        // Sync parts of parent store
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
        if (this.state.viewsLocked && this.props.map.bbox !== prevProps.map.bbox && !this.map3dFocused) {
            this.sync2DExtent();
        }
    }
    render3DWindow = () => {
        if (this.props.display.view3dMode > View3DMode.DISABLED) {
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
            const options = {
                searchMinScaleDenom: this.props.searchMinScaleDenom,
                tileInfoServiceUrl: this.props.tileInfoServiceUrl
            };
            return (
                <ResizeableWindow
                    extraControls={extraControls}
                    fullscreen={this.props.display.view3dMode === View3DMode.FULLSCREEN}
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
                            <PluginsContainer plugins={this.props.plugins} pluginsAppConfig={{}} pluginsConfig={this.props.pluginsConfig}>
                                <Map3D
                                    innerRef={this.setRef}
                                    mapFocusChange={focus => { this.map3dFocused = focus; }}
                                    onCameraChanged={this.onCameraChanged}
                                    onMapInitialized={this.setupMap}
                                    options={options}
                                    searchProviders={this.props.searchProviders}
                                    theme={this.props.theme} />
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
        this.props.setView3dMode(View3DMode.DISABLED);
        UrlParams.updateParams({v3d: undefined});
    };
    onGeometryChanged = (geometry) => {
        if (geometry.maximized && this.props.display.view3dMode !== View3DMode.FULLSCREEN) {
            this.props.setView3dMode(View3DMode.FULLSCREEN);
        }
        this.setState({windowDetached: geometry.detached});
    };
    onCameraChanged = (center) => {
        if (this.state.viewsLocked && this.map3dFocused) {
            this.props.panTo(center, this.props.theme.mapCrs);
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
        this.setState(state => ({viewsLocked: !state.viewsLocked}), () => {
            if (this.state.viewsLocked) {
                this.sync2DExtent();
            }
        });
    };
    setupMap = () => {
        if (this.map3dComponentRef && this.restoreOnComponentLoad) {
            this.restoreOnComponentLoad = false;
            const state3d = {
                ...this.props.startupState.map3d
            };
            if (this.props.startupParams.v3d) {
                const values = this.props.startupParams.v3d.split(",").map(parseFloat).filter(x => !isNaN(x));
                if (values.length >= 6) {
                    state3d.camera = [values[0], values[1], values[2]];
                    state3d.target = [values[3], values[4], values[5]];
                    state3d.personHeight = values[6] ?? 0;
                }
            }
            if (this.props.startupParams.bl3d !== undefined) {
                state3d.baselayer = this.props.startupParams.bl3d;
            }
            this.map3dComponentRef.restore3dState(state3d);
            if (!this.props.startupParams.v3d) {
                this.sync2DExtent();
            }
        } else {
            this.sync2DExtent();
        }
    };
    redrawScene = (ev) => {
        if (this.map3dComponentRef) {
            this.map3dComponentRef.redrawScene(ev);
        }
    };
}

export default connect(
    createSelector([state => state, searchProvidersSelector], (state, searchProviders) => ({
        enabled: state.task.id === 'View3D',
        display: state.display,
        map: state.map,
        layers: state.layers,
        pluginsConfig: state.localConfig.plugins,
        theme: state.theme,
        localConfig: state.localConfig,
        view3dMode: state.display.view3dMode,
        startupParams: state.localConfig.startupParams,
        startupState: state.localConfig.startupState,
        searchProviders
    })), {
        panTo: panTo,
        setCurrentTask: setCurrentTask,
        setView3dMode: setView3dMode
    }
)(View3D);
