/**
 * Copyright 2019-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';
import {v4 as uuidv4} from 'uuid';

import {LayerRole, addLayer, addLayerFeatures} from '../../actions/layers';
import NumberInput from '../../components/widgets/NumberInput';
import VectorLayerPicker from '../../components/widgets/VectorLayerPicker';
import LocaleUtils from '../../utils/LocaleUtils';
import VectorLayerUtils from '../../utils/VectorLayerUtils';


class RedliningBufferSupport extends React.Component {
    static propTypes = {
        addLayer: PropTypes.func,
        addLayerFeatures: PropTypes.func,
        layers: PropTypes.array,
        projection: PropTypes.string,
        redlining: PropTypes.object
    };
    state = {
        bufferDistance: 0,
        bufferLayer: null,
        bufferUnit: "meters"
    };
    constructor(props) {
        super(props);
        this.state.bufferLayer = {
            id: "buffer",
            title: LocaleUtils.tr("redlining.bufferlayername"),
            role: LayerRole.USERLAYER
        };
    }
    componentDidUpdate() {
        if (this.state.bufferLayer && this.state.bufferLayer.id !== "buffer" && !this.props.layers.find(layer => layer.id === this.state.bufferLayer.id)) {
            this.setState({bufferLayer: {
                id: "buffer",
                title: LocaleUtils.tr("redlining.bufferlayername"),
                role: LayerRole.USERLAYER
            }});
        }
    }
    render() {
        if (!this.props.redlining.selectedFeature) {
            return (
                <div className="redlining-message">
                    {LocaleUtils.tr("redlining.bufferselectfeature")}
                </div>
            );
        }
        const enabled = this.state.bufferDistance !== 0;
        let layers = this.props.layers.filter(layer => layer.type === "vector" && layer.role === LayerRole.USERLAYER);
        // Ensure list contains current  target layer
        if (!layers.find(layer => layer.id === this.state.bufferLayer.id)) {
            layers = [this.state.bufferLayer, ...layers];
        }
        return (
            <div className="redlining-controlsbar">
                <div className="redlining-control">
                    <span>{LocaleUtils.tr("redlining.bufferdistance")} &nbsp;</span>
                    <NumberInput max={99999} min={-99999} mobile
                        onChange={(nr) => this.setState({bufferDistance: nr})}
                        value={this.state.bufferDistance} />
                    <select onChange={this.changeBufferUnit} value={this.state.bufferUnit}>
                        <option value="meters">m</option>
                        <option value="feet">ft</option>
                        <option value="kilometers">km</option>
                        <option value="miles">mi</option>
                    </select>
                </div>
                <div className="redlining-control">
                    <span>{LocaleUtils.tr("redlining.bufferlayer")}:&nbsp;</span>
                    <VectorLayerPicker
                        addLayer={this.props.addLayer} layers={layers}
                        onChange={layer => this.setState({bufferLayer: layer})}
                        value={this.state.bufferLayer.id} />
                </div>
                <div className="redlining-control">
                    <button className="button" disabled={!enabled} onClick={this.computeBuffer}>
                        {LocaleUtils.tr("redlining.buffercompute")}
                    </button>
                </div>
            </div>
        );
    }
    changeBufferUnit = (ev) => {
        this.setState({bufferUnit: ev.target.value});
    };
    computeBuffer = () => {
        let feature = this.props.redlining.selectedFeature;
        if (!feature || !feature.geometry || !this.state.bufferLayer) {
            return;
        }
        import("@turf/buffer").then(bufferMod => {
            const buffer = bufferMod.default;
            if (feature.circleParams) {
                const {center, radius} = feature.circleParams;
                const deg2rad = Math.PI / 180;
                feature = {
                    ...feature,
                    geometry: {
                        type: 'Polygon',
                        coordinates: [
                            Array.apply(null, Array(91)).map((item, index) => ([center[0] + radius * Math.cos(4 * index * deg2rad), center[1] + radius * Math.sin(4 * index * deg2rad)]))
                        ]
                    }
                };
            }
            const wgsGeometry = VectorLayerUtils.reprojectGeometry(feature.geometry, this.props.projection, "EPSG:4326");
            const wgsFeature = {...feature, geometry: wgsGeometry};
            const output = buffer(wgsFeature, this.state.bufferDistance, {units: this.state.bufferUnit});
            if (output && output.geometry) {
                output.geometry = VectorLayerUtils.reprojectGeometry(output.geometry, "EPSG:4326", this.props.projection);
                output.id = uuidv4();
                output.styleName = 'default';
                output.styleOptions = {
                    fillColor: [0, 0, 255, 0.5],
                    strokeColor: [0, 0, 255, 1]
                };
                this.props.addLayerFeatures(this.state.bufferLayer, [output]);
            }
        });
    };
}

export default {
    cfg: {
        key: "Buffer",
        tooltip: LocaleUtils.trmsg("redlining.buffer"),
        icon: "buffer",
        data: {action: "Buffer", geomType: null}
    },
    controls: connect((state) => ({
        projection: state.map.projection,
        layers: state.layers.flat,
        redlining: state.redlining
    }), {
        addLayerFeatures: addLayerFeatures,
        addLayer: addLayer
    })(RedliningBufferSupport)
};
