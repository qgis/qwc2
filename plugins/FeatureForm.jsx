/**
 * Copyright 2017-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';

import {setEditContext, clearEditContext} from '../actions/editing';
import {LayerRole} from '../actions/layers';
import {setCurrentTask} from '../actions/task';
import AttributeForm from '../components/AttributeForm';
import ResizeableWindow from '../components/ResizeableWindow';
import TaskBar from '../components/TaskBar';
import EditingInterface from '../utils/EditingInterface';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';

import './style/FeatureForm.css';


/**
 * Displays queried feature attributes in a form.
 *
 * The attribute form is generated from the QGIS attribute form configuration.
 *
 * If the dataset it editable, allows editing the attributes directly in the
 * displayed form.
 *
 * This plugin queries the feature via the editing service specified by
 * `editServiceUrl` in `config.json` (by default the `qwc-data-service`), rather than over WMS
 * GetFeatureInfo like the `Identify` plugin.
 *
 * Can be used as default identify tool by setting `"identifyTool": "FeatureForm"` in `config.json`.
 */
class FeatureForm extends React.Component {
    static propTypes = {
        clearEditContext: PropTypes.func,
        click: PropTypes.object,
        currentEditContext: PropTypes.string,
        editContext: PropTypes.object,
        enabled: PropTypes.bool,
        /** Whether to clear the task when the results window is closed. */
        exitTaskOnResultsClose: PropTypes.bool,
        /** Default window geometry with size, position and docking status. Positive position values (including '0') are related to top (InitialY) and left (InitialX), negative values (including '-0') to bottom (InitialY) and right (InitialX). */
        geometry: PropTypes.shape({
            initialWidth: PropTypes.number,
            initialHeight: PropTypes.number,
            initialX: PropTypes.number,
            initialY: PropTypes.number,
            initiallyDocked: PropTypes.bool,
            side: PropTypes.string
        }),
        iface: PropTypes.object,
        layers: PropTypes.array,
        map: PropTypes.object,
        setCurrentTask: PropTypes.func,
        setEditContext: PropTypes.func,
        theme: PropTypes.object
    };
    static defaultProps = {
        geometry: {
            initialWidth: 320,
            initialHeight: 480,
            initialX: 0,
            initialY: 0,
            initiallyDocked: false,
            side: 'left'
        }
    };
    static defaultState = {
        pendingRequests: 0,
        pickedFeatures: null,
        selectedFeature: ""
    };
    constructor(props) {
        super(props);
        this.state = FeatureForm.defaultState;
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.props.enabled && !prevProps.enabled) {
            this.props.setEditContext('FeatureForm', {action: 'Pick'});
        }
        const isCurrentContext = this.props.editContext.id === this.props.currentEditContext;
        if (this.props.enabled && isCurrentContext && !this.props.editContext.changed && this.state.pendingRequests === 0) {
            const clickPoint = this.queryPoint(prevProps);
            if (clickPoint) {
                this.queryFeatures(clickPoint);
            }
        }
        if (this.props.enabled && this.state.selectedFeature !== prevState.selectedFeature) {
            const feature = this.state.pickedFeatures ? this.state.pickedFeatures[this.state.selectedFeature] : null;
            const curLayerId = this.state.selectedFeature.split("::")[0];
            const curConfig = this.props.theme.editConfig[curLayerId] || {};
            const editPermissions = curConfig.permissions || {};
            this.props.setEditContext('FeatureForm', {
                action: 'Pick',
                feature: feature,
                changed: false,
                geomType: curConfig.geomType || null,
                geomReadOnly: editPermissions.updatable === false
            });
        }
        if (!this.props.enabled && prevProps.enabled) {
            this.props.clearEditContext('FeatureForm');
            this.setState(FeatureForm.defaultState);
        }
    }
    queryPoint = (prevProps) => {
        if (this.props.click.button !== 0 || this.props.click === prevProps.click || (this.props.click.features || []).find(feature => feature.id === 'startupposmarker')) {
            return null;
        }
        const searchMarker = (this.props.click.features || []).find(feature => feature.id === 'searchmarker');
        if (searchMarker) {
            return searchMarker.geometry.coordinates;
        }
        return this.props.click.coordinate;
    };
    queryFeatures = (pos) => {
        let pendingRequests = 0;
        Object.entries(this.props.theme.editConfig || {}).forEach(([layerId, editConfig]) => {
            if (!editConfig.geomType) {
                // Skip geometryless datasets
                return;
            }
            const path = [];
            let sublayer = null;
            const layer = this.props.layers.find(l => (l.role === LayerRole.THEME && (sublayer = LayerUtils.searchSubLayer(l, 'name', layerId, path))));
            if (layer && sublayer && !LayerUtils.sublayerVisible(layer, path)) {
                return;
            }
            ++pendingRequests;
            const editDataset = editConfig.editDataset || layerId;
            const scale = Math.round(MapUtils.computeForZoom(this.props.map.scales, this.props.map.zoom));
            this.props.iface.getFeature(editDataset, pos, this.props.map.projection, scale, 96, (featureCollection) => {
                if (featureCollection && !isEmpty(featureCollection.features)) {
                    this.setState((state) => ({
                        pickedFeatures: {
                            ...state.pickedFeatures,
                            ...featureCollection.features.reduce((res, feature) => ({
                                ...res,
                                [layerId + "::" + feature.id]: feature
                            }), {})
                        },
                        pendingRequests: state.pendingRequests - 1,
                        selectedFeature: state.selectedFeature || (layerId + "::" + featureCollection.features[0].id)
                    }));
                } else {
                    this.setState((state) => ({
                        pendingRequests: state.pendingRequests - 1
                    }));
                }
            }, layer.filterParams?.[sublayer.name], layer.filterGeom);
        });
        this.setState({pendingRequests: pendingRequests, pickedFeatures: {}, selectedFeature: ""});
    };
    render() {
        let resultWindow = null;
        if (this.state.pickedFeatures !== null) {
            let body = null;
            if (this.state.pendingRequests > 0) {
                body = (
                    <div className="feature-query-body" role="body"><span className="identify-body-message">{LocaleUtils.tr("featureform.querying")}</span></div>
                );
            } else if (isEmpty(this.state.pickedFeatures)) {
                body = (
                    <div className="feature-query-body" role="body"><span className="identify-body-message">{LocaleUtils.tr("featureform.noresults")}</span></div>
                );
            } else {
                const featureText = LocaleUtils.tr("featureform.feature");
                const curLayerId = this.state.selectedFeature.split("::")[0];
                const curConfig = this.props.theme.editConfig[curLayerId];
                const editPermissions = curConfig.permissions || {};
                body = (
                    <div className="feature-query-body" role="body">
                        {Object.keys(this.state.pickedFeatures).length > 1 ? (
                            <div className="feature-query-selection">
                                <select onChange={this.setSelectedFeature} value={this.state.selectedFeature}>
                                    {Object.entries(this.state.pickedFeatures).map(([id, feature]) => {
                                        const [layerId, featureId] = id.split("::");
                                        const editConfig = this.props.theme.editConfig[layerId];
                                        const match = LayerUtils.searchLayer(this.props.layers, 'name', editConfig.layerName, [LayerRole.THEME]);
                                        const layerName = match ? match.sublayer.title : editConfig.layerName;
                                        const featureName = editConfig.displayField ? feature.properties[editConfig.displayField] : featureText + " " + featureId;
                                        return (
                                            <option key={id} value={id}>{layerName + ": " + featureName}</option>
                                        );
                                    })}
                                </select>
                            </div>
                        ) : null}
                        {this.props.editContext.feature ? (
                            <AttributeForm editConfig={curConfig} editContext={this.props.editContext} iface={this.props.iface} readOnly={editPermissions.updatable === false} />
                        ) : null}
                    </div>
                );
            }
            resultWindow = (
                <ResizeableWindow dockable={this.props.geometry.side} icon="featureform"
                    initialHeight={this.props.geometry.initialHeight} initialWidth={this.props.geometry.initialWidth}
                    initialX={this.props.geometry.initialX} initialY={this.props.geometry.initialY}
                    initiallyDocked={this.props.geometry.initiallyDocked} key="FeatureForm"
                    onClose={this.onWindowClose} title={LocaleUtils.trmsg("featureform.title")}
                >
                    {body}
                </ResizeableWindow>
            );
        }
        return [resultWindow, (
            <TaskBar key="FeatureFormTaskBar" task="FeatureForm">
                {() => ({
                    body: LocaleUtils.tr("infotool.clickhelpPoint")
                })}
            </TaskBar>
        )];
    }
    setSelectedFeature = (ev) => {
        this.setState({selectedFeature: ev.target.value});
    };
    onWindowClose = () => {
        this.clearResults();
        if (this.props.exitTaskOnResultsClose) {
            this.props.setCurrentTask(null);
        }
    };
    clearResults = () => {
        if (!this.props.editContext.changed) {
            this.setState(FeatureForm.defaultState);
        }
    };
}

export default (iface = EditingInterface) => {
    return connect((state) => ({
        click: state.map.click || {modifiers: {}},
        enabled: state.task.id === "FeatureForm" || state.identify.tool === "FeatureForm",
        editContext: state.editing.contexts.FeatureForm || {},
        currentEditContext: state.editing.currentContext,
        iface: iface,
        layers: state.layers.flat,
        map: state.map,
        theme: state.theme.current
    }), {
        setCurrentTask: setCurrentTask,
        clearEditContext: clearEditContext,
        setEditContext: setEditContext
    })(FeatureForm);
};
