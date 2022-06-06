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
import {changeEditingState} from '../actions/editing';
import {LayerRole} from '../actions/layers';
import AttributeForm from '../components/AttributeForm';
import ResizeableWindow from '../components/ResizeableWindow';
import EditingInterface from '../utils/EditingInterface';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';
import './style/FeatureForm.css';


class FeatureForm extends React.Component {
    static propTypes = {
        changeEditingState: PropTypes.func,
        click: PropTypes.object,
        editing: PropTypes.object,
        enabled: PropTypes.bool,
        iface: PropTypes.object,
        initialHeight: PropTypes.number,
        initialWidth: PropTypes.number,
        initialX: PropTypes.number,
        initialY: PropTypes.number,
        layers: PropTypes.array,
        map: PropTypes.object,
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
        if (this.props.enabled && this.state.pendingRequests === 0) {
            const clickPoint = this.queryPoint(prevProps);
            if (clickPoint) {
                this.queryFeatures(clickPoint);
            }
        }
        if (this.props.enabled && this.state.selectedFeature !== prevState.selectedFeature) {
            const feature = this.state.pickedFeatures ? this.state.pickedFeatures[this.state.selectedFeature] : null;
            const curLayerId = this.state.selectedFeature.split("::")[0];
            const curConfig = this.props.theme.editConfig[curLayerId] || {};
            this.props.changeEditingState({action: 'Pick', feature: feature, changed: false, geomType: curConfig.geomType || null});
        }
        if (!this.props.enabled && prevProps.enabled) {
            this.props.changeEditingState({action: null, geomType: null, feature: null});
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
        if (this.state.pickedFeatures === null) {
            return null;
        }
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
            const editDataset = this.editLayerId(curLayerId);
            const mapPrefix = editDataset.replace(new RegExp("." + curLayerId + "$"), ".");
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
                    {this.props.editing.feature ? (
                        <AttributeForm editConfig={curConfig} editDataset={editDataset}
                            editMapPrefix={mapPrefix} iface={this.props.iface} />
                    ) : null}
                </div>
            );
        }
        return (
            <ResizeableWindow icon="info-sign"
                initialHeight={this.props.initialHeight} initialWidth={this.props.initialWidth}
                initialX={this.props.initialX} initialY={this.props.initialY}
                key="FeatureForm"
                onClose={this.clearResults} title={LocaleUtils.trmsg("featureform.title")}
            >
                {body}
            </ResizeableWindow>
        );
    }
    editLayerId = (layerId) => {
        if (this.props.theme && this.props.theme.editConfig && this.props.theme.editConfig[layerId]) {
            return this.props.theme.editConfig[layerId].editDataset || layerId;
        }
        return layerId;
    }
    setSelectedFeature = (ev) => {
        this.setState({selectedFeature: ev.target.value});
    }
    clearResults = () => {
        this.setState(FeatureForm.defaultState);
    }
}

export default (iface = EditingInterface) => {
    return connect((state) => ({
        click: state.map.click || {modifiers: {}},
        enabled: state.task.id === "FeatureForm",
        editing: state.editing,
        iface: iface,
        layers: state.layers.flat,
        map: state.map,
        theme: state.theme.current
    }), {
        changeEditingState: changeEditingState
    })(FeatureForm);
};
