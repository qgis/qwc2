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
import {setCurrentTask} from '../actions/task';
import PluginsContainer from '../components/PluginsContainer';
import ResizeableWindow from '../components/ResizeableWindow';
import StandardApp from '../components/StandardApp';
import ReducerIndex from '../reducers/index';
import searchProvidersSelector from '../selectors/searchproviders';
import {createStore} from '../stores/StandardStore';
import LocaleUtils from '../utils/LocaleUtils';


/**
 * Displays a 3D map view.
 */
class View3D extends React.Component {
    static propTypes = {
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
        locale: PropTypes.object,
        mapBBox: PropTypes.object,
        mapMargins: PropTypes.object,
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
        theme: PropTypes.object
    };
    static defaultProps = {
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
        enabled: false,
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
        // Inline reducers to sync parts of parent store
        const displayActions = Object.values(displayExports).filter(x => typeof(x) === 'string');
        const display = (state = {}, action) => {
            if (displayActions.includes(action.type)) {
                // Forward to parent store
                StandardApp.store.dispatch(action);
                return state;
            } else {
                return action.type === "SYNC_DISPLAY_FROM_PARENT_STORE" ? action.display : state;
            }
        };
        const localConfig = (state = {}, action) => {
            return action.type === "SYNC_LOCAL_CONFIG_FROM_PARENT_STORE" ? action.localConfig : state;
        };
        const theme = (state = {}, action) => {
            return action.type === "SYNC_THEME_FROM_PARENT_STORE" ? action.theme : state;
        };
        const locale = (state = {}, action) => {
            return action.type === "SYNC_LOCALE_FROM_PARENT_STORE" ? action.locale : state;
        };
        const layers = (state = {}, action) => {
            return action.type === "SYNC_LAYERS_FROM_PARENT_STORE" ? action.layers : state;
        };
        this.store = createStore({task, windows, display, localConfig, theme, locale, layers});
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.enabled && !prevProps.enabled) {
            this.setState({enabled: true});
            this.props.setCurrentTask(null);
            import('../components/map3d/Map3D').then(component => {
                this.map3dComponent = component.default;
                this.map3dComponentRef = null;
                this.setState({componentLoaded: true});
            });
        } else if (!this.state.enabled && prevState.enabled) {
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
        if (this.props.locale !== prevProps.locale) {
            this.store.dispatch({type: "SYNC_LOCALE_FROM_PARENT_STORE", locale: this.props.locale});
        }
        if (this.props.layers !== prevProps.layers) {
            this.store.dispatch({type: "SYNC_LAYERS_FROM_PARENT_STORE", layers: this.props.layers});
        }
    }
    render() {
        if (!this.state.enabled) {
            return null;
        }
        const extraControls = [{
            icon: "sync",
            callback: this.setViewToExtent,
            title: LocaleUtils.tr("map3d.syncview")
        }];
        const Map3D = this.map3dComponent;
        return (
            <ResizeableWindow
                extraControls={extraControls} icon="map3d"
                initialHeight={this.props.geometry.initialHeight}
                initialWidth={this.props.geometry.initialWidth}
                initialX={this.props.geometry.initialX}
                initialY={this.props.geometry.initialY}
                initiallyDocked={this.props.geometry.initiallyDocked}
                onClose={this.onClose}
                onExternalWindowResized={this.redrawScene}
                splitScreenWhenDocked
                splitTopAndBottomBar
                title={LocaleUtils.tr("map3d.title")}
            >
                {this.state.componentLoaded ? (
                    <Provider role="body" store={this.store}>
                        <Map3D
                            innerRef={this.setRef}
                            mapBBox={this.props.mapBBox} options={this.props.options}
                            projection={this.props.projection}
                            searchProviders={this.props.searchProviders}
                            theme={this.props.theme} />
                        <PluginsContainer plugins={this.props.plugins} pluginsAppConfig={{}}  pluginsConfig={this.props.pluginsConfig} />
                    </Provider>
                ) : null}
            </ResizeableWindow>
        );
    }
    onClose = () => {
        this.setState({enabled: false});
    };
    setRef = (ref) => {
        this.map3dComponentRef = ref;
    };
    setViewToExtent = () => {
        if (this.map3dComponentRef) {
            this.map3dComponentRef.setViewToExtent(this.props.mapBBox.bounds, this.props.mapBBox.rotation);
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
        mapMargins: state.windows.mapMargins,
        projection: state.map.projection,
        layers: state.layers,
        locale: state.locale,
        pluginsConfig: state.localConfig.plugins,
        theme: state.theme,
        localConfig: state.localConfig,
        searchProviders
    })), {
        setCurrentTask: setCurrentTask
    }
)(View3D);
