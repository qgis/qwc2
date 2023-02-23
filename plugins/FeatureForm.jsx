/**
 * Copyright 2017-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import isEmpty from 'lodash.isempty';
import {setEditContext, clearEditContext} from '../actions/editing';
import {LayerRole} from '../actions/layers';
import AttributeForm from '../components/AttributeForm';
import ResizeableWindow from '../components/ResizeableWindow';
import TaskBar from '../components/TaskBar';
import EditingInterface from '../utils/EditingInterface';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';
import './style/FeatureForm.css';


class FeatureForm extends React.Component {
    static propTypes = {
        clearEditContext: PropTypes.func,
        click: PropTypes.object,
        currentEditContext: PropTypes.string,
        editContext: PropTypes.object,
        enabled: PropTypes.bool,
        iface: PropTypes.object,
        initialHeight: PropTypes.number,
        initialWidth: PropTypes.number,
        initialX: PropTypes.number,
        initialY: PropTypes.number,
        layers: PropTypes.array,
        map: PropTypes.object,
        setEditContext: PropTypes.func,
        theme: PropTypes.object
    }
    static defaultProps = {
        initialWidth: 320,
        initialHeight: 480,
        initialX: 0,
        initialY: 0
    }
    static defaultState = {
        pendingRequests: 0,
        pickedFeatures: null,
        selectedFeature: ""
    }
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
        if (this.props.click.button !== 0 || this.props.click === prevProps.click || (this.props.click.features || []).find(entry => entry.feature === 'startupposmarker')) {
            return null;
        }
        if (this.props.click.feature === 'searchmarker' && this.props.click.geometry && this.props.click.geomType === 'Point') {
            return this.props.click.geometry;
        }
        return this.props.click.coordinate;
    }
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
                    this.setState({
                        pickedFeatures: {
                            ...this.state.pickedFeatures,
                            ...featureCollection.features.reduce((res, feature) => ({
                                ...res,
                                [layerId + "::" + feature.id]: feature
                            }), {})
                        },
                        pendingRequests: this.state.pendingRequests - 1,
                        selectedFeature: this.state.selectedFeature || (layerId + "::" + featureCollection.features[0].id)
                    });
                } else {
                    this.setState({
                        pendingRequests: this.state.pendingRequests - 1
                    });
                }
            });
        });
        this.setState({pendingRequests: pendingRequests, pickedFeatures: {}, selectedFeature: ""});
    }
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
                <ResizeableWindow icon="featureform"
                    initialHeight={this.props.initialHeight} initialWidth={this.props.initialWidth}
                    initialX={this.props.initialX} initialY={this.props.initialY}
                    key="FeatureForm"
                    onClose={this.clearResults} title={LocaleUtils.trmsg("featureform.title")}
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
    }
    clearResults = () => {
        if (!this.props.editContext.changed) {
            this.setState(FeatureForm.defaultState);
        }
    }
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
        clearEditContext: clearEditContext,
        setEditContext: setEditContext
    })(FeatureForm);
};
