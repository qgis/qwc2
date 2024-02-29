/**
 * Copyright 2017-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';

import {setEditContext, getFeatureTemplate} from '../actions/editing';
import {LayerRole, addLayerFeatures, removeLayer} from '../actions/layers';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';
import AttributeForm from './AttributeForm';

import './style/LinkFeatureForm.css';

class LinkFeatureForm extends React.Component {
    static propTypes = {
        action: PropTypes.string,
        addLayerFeatures: PropTypes.func,
        displayField: PropTypes.string,
        editConfig: PropTypes.object,
        editContextId: PropTypes.string,
        editing: PropTypes.object,
        feature: PropTypes.object,
        featureId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        finished: PropTypes.func,
        iface: PropTypes.object,
        map: PropTypes.object,
        pickFilter: PropTypes.func,
        readOnly: PropTypes.bool,
        removeLayer: PropTypes.func,
        setEditContext: PropTypes.func
    };
    state = {
        editContext: {},
        pickedFeatures: null,
        highlightedFeature: null
    };
    componentDidMount() {
        if (this.props.action === 'Edit') {
            if (this.props.feature) {
                this.props.setEditContext(this.props.editContextId, {action: 'Pick', feature: this.props.feature, geomType: this.props.editConfig.geomType});
            } else {
                this.props.iface.getFeatureById(this.props.editConfig.editDataset, this.props.featureId, this.props.map.projection, (result) => {
                    if (result) {
                        this.props.setEditContext(this.props.editContextId, {action: 'Pick', feature: result, geomType: this.props.editConfig.geomType});
                    }
                });
            }
        } else if (this.props.action === 'Create') {
            const featureTemplate = getFeatureTemplate(this.props.editConfig, {
                type: "Feature",
                properties: {},
                ...this.props.feature
            });
            this.props.setEditContext(this.props.editContextId, {action: 'Draw', geomType: this.props.editConfig.geomType, feature: featureTemplate});
        } else if (this.props.action === 'Pick') {
            this.props.setEditContext(this.props.editContextId, {action: null});
        }
    }
    componentDidUpdate(prevProps) {
        // Handle drawPick
        const editContext = this.props.editing.contexts[this.props.editContextId];
        if (editContext && editContext.action === null && this.props.map.click && this.props.map.click !== prevProps.map.click) {
            this.childPickQuery(this.props.map.click.coordinate);
        }
    }
    render() {
        const editContext = this.props.editing.contexts[this.props.editContextId];
        if (!editContext) {
            return null;
        }

        if (editContext.action === null) {
            // Picking
            return (
                <div className="link-feature-form">
                    {!this.state.pickedFeatures ? (
                        <div className="link-feature-form-hint">
                            <span>{LocaleUtils.tr("linkfeatureform.pickhint")}</span>
                        </div>
                    ) : (
                        <div className="link-feature-form-feature-list">
                            {this.state.pickedFeatures.map(feature => (
                                <div key={feature.id} onClick={() => this.pickFeatureSelected(feature)}
                                    onMouseOut={() => this.unhoverFeature(feature)} onMouseOver={() => this.hoverFeature(feature)}
                                >{feature.properties[this.props.displayField] ?? feature.id}</div>
                            ))}
                        </div>
                    )}
                    <div className="link-feature-form-close">
                        <button className="button" disabled={editContext.changed} onClick={this.finish}>
                            {LocaleUtils.tr("linkfeatureform.cancel")}
                        </button>
                    </div>
                </div>
            );
        } else if (editContext.feature) {
            const drawing = (editContext.action === 'Draw' && !editContext.feature.geometry && this.props.editConfig.geomType);

            return (
                <div className="link-feature-form">
                    {drawing ? (
                        <div className="link-feature-form-hint">
                            <span>{LocaleUtils.tr("linkfeatureform.drawhint")}</span>
                        </div>
                    ) : (
                        <AttributeForm editConfig={this.props.editConfig} editContext={editContext} iface={this.props.iface} onDiscard={this.onDiscard} readOnly={this.props.readOnly} />
                    )}
                    <div className="link-feature-form-close">
                        <button className="button" disabled={editContext.changed} onClick={this.finish}>
                            {drawing ? LocaleUtils.tr("linkfeatureform.cancel") : LocaleUtils.tr("linkfeatureform.close")}
                        </button>
                    </div>
                </div>
            );
        } else {
            return null;
        }
    }
    childPickQuery = (coordinate) => {
        const scale = Math.round(MapUtils.computeForZoom(this.props.map.scales, this.props.map.zoom));
        this.props.iface.getFeature(this.props.editConfig.editDataset, coordinate, this.props.map.projection, scale, 96, (featureCollection) => {
            const features = featureCollection ? featureCollection.features : null;
            if (features && features.length === 1) {
                if (!this.props.pickFilter) {
                    this.props.finished(features[0]);
                } else {
                    const newFeature = this.props.pickFilter(features[0]);
                    if (newFeature) {
                        this.props.finished(newFeature);
                    }
                }
            } else {
                this.setState({pickedFeatures: features});
            }
        });
    };
    finish = () => {
        const editContext = this.props.editing.contexts[this.props.editContextId];
        this.props.finished(editContext.feature);
    };
    hoverFeature = (feature) => {
        const layer = {
            id: this.props.editContextId + "-pick-selection",
            role: LayerRole.SELECTION
        };
        this.props.addLayerFeatures(layer, [feature], true);
        this.setState({highlightedFeature: feature.id});
    };
    unhoverFeature = (feature) => {
        if (this.state.highlightedFeature === feature.id) {
            this.props.removeLayer(this.props.editContextId + "-pick-selection");
            this.setState({highlightedFeature: null});
        }
    };
    pickFeatureSelected = (feature) => {
        this.unhoverFeature(feature);
        if (!this.props.pickFilter) {
            this.props.finished(feature);
        } else {
            const newFeature = this.props.pickFilter(feature);
            if (newFeature) {
                this.props.finished(newFeature);
            }
        }
    };
    onDiscard = () => {
        const editContext = this.props.editing.contexts[this.props.editContextId];
        if (editContext.action === "Draw") {
            // Discarded draw = cancel
            this.props.finished(null);
        }
    };
}

export default connect((state) => ({
    editing: state.editing,
    map: state.map
}), {
    addLayerFeatures: addLayerFeatures,
    removeLayer: removeLayer,
    setEditContext: setEditContext
})(LinkFeatureForm);
