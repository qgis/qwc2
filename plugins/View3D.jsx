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
import {setCurrentTask} from '../actions/task';
import * as themeExports from '../actions/theme';
import PluginsContainer from '../components/PluginsContainer';
import ResizeableWindow from '../components/ResizeableWindow';
import StandardApp from '../components/StandardApp';
import View3DSwitcher from '../components/map3d/View3DSwitcher';
import map3dReducer from '../components/map3d/slices/map3d';
import ReducerIndex from '../reducers/index';
import searchProvidersSelector from '../selectors/searchproviders';
import {createStore} from '../stores/StandardStore';
import LocaleUtils from '../utils/LocaleUtils';
import {UrlParams} from '../utils/PermaLinkUtils';


/**
 * Displays a 3D map view.
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
        mapBBox: PropTypes.object,
        /** Various configuration options */
        options: PropTypes.shape({
            /** Minimum scale denominator when zooming to search result. */
            searchMinScaleDenom: PropTypes.number
        }),
        plugins: PropTypes.object,
        pluginsConfig: PropTypes.object,
        projection: PropTypes.string,
        searchProviders: PropTypes.object,
        setCurrentTask: PropTypes.func,
        setView3dMode: PropTypes.func,
        startupParams: PropTypes.object,
        startupState: PropTypes.object,
        theme: PropTypes.object,
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
        options: {
            searchMinScaleDenom: 1000
        }
    };
    state = {
        componentLoaded: false
    };
    constructor(props) {
        super(props);
        this.map3dComponent = null;
        this.map3dComponentRef = null;
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
        const themeActions = Object.values(themeExports).filter(x => typeof(x) === 'string');
        const display = forwardReducer("display", displayActions, "SYNC_DISPLAY_FROM_PARENT_STORE");
        const layers = forwardReducer("layers", [], "SYNC_LAYERS_FROM_PARENT_STORE");
        const localConfig = forwardReducer("localConfig", [], "SYNC_LOCAL_CONFIG_FROM_PARENT_STORE");
        const theme = forwardReducer("theme", themeActions, "SYNC_THEME_FROM_PARENT_STORE");
        this.store = createStore({display, layers, localConfig, map: map3dReducer, theme, task, windows});
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
        if (this.props.view3dMode !== prevProps.view3dMode) {
            if (this.props.view3dMode === View3DMode.FULLSCREEN) {
                UrlParams.updateParams({v: "3d"});
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
    }
    render3DWindow = () => {
        if (this.props.display.view3dMode > View3DMode.DISABLED) {
            const extraControls = [{
                icon: "sync",
                callback: this.setViewToExtent,
                title: LocaleUtils.tr("map3d.syncview")
            }, {
                icon: "maximize",
                callback: () => this.props.setView3dMode(View3DMode.FULLSCREEN),
                title: LocaleUtils.tr("window.maximize")
            }];
            const Map3D = this.map3dComponent;
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
                    onGeometryChanged={this.onGeometryChanged}
                    splitScreenWhenDocked
                    splitTopAndBottomBar
                    title={LocaleUtils.tr("map3d.title")}
                >
                    {this.state.componentLoaded ? (
                        <Provider role="body" store={this.store}>
                            <Map3D
                                innerRef={this.setRef}
                                onMapInitialized={this.setupMap}
                                options={this.props.options}
                                searchProviders={this.props.searchProviders}
                                theme={this.props.theme} />
                            {this.props.view3dMode === View3DMode.FULLSCREEN ? (
                                <PluginsContainer plugins={this.props.plugins} pluginsAppConfig={{}} pluginsConfig={this.props.pluginsConfig} />
                            ) : null}
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
    };
    onGeometryChanged = (geometry) => {
        if (geometry.maximized && this.props.display.view3dMode !== View3DMode.FULLSCREEN) {
            this.props.setView3dMode(View3DMode.FULLSCREEN);
        }
    };
    setRef = (ref) => {
        this.map3dComponentRef = ref;
    };
    setViewToExtent = () => {
        if (this.props.view3dMode !== View3DMode.FULLSCREEN && this.map3dComponentRef) {
            this.map3dComponentRef.setViewToExtent(this.props.mapBBox.bounds, this.props.mapBBox.rotation);
        }
    };
    setupMap = () => {
        this.setViewToExtent();
        if (this.map3dComponentRef && this.restoreOnComponentLoad) {
            this.restoreOnComponentLoad = false;
            this.map3dComponentRef.restore3dState(this.props.startupState.map3d);
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
        mapBBox: state.map.bbox,
        projection: state.map.projection,
        layers: state.layers,
        pluginsConfig: state.localConfig.plugins,
        theme: state.theme,
        localConfig: state.localConfig,
        view3dMode: state.display.view3dMode,
        startupParams: state.localConfig.startupParams,
        startupState: state.localConfig.startupState,
        searchProviders
    })), {
        setCurrentTask: setCurrentTask,
        setView3dMode: setView3dMode
    }
)(View3D);
