/**
* Copyright 2019, Sourcepole AG.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/

const React = require('react');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const assign = require('object-assign');
const buffer = require('@turf/buffer').default;
const uuid = require('uuid');
const NumericInput = require('react-numeric-input');
const {LayerRole,addLayer,addLayerFeatures} = require('../../actions/layers');
const Message = require('../../components/I18N/Message');
const VectorLayerPicker = require('../../components/widgets/VectorLayerPicker');
const LocaleUtils = require('../../utils/LocaleUtils');
const VectorLayerUtils = require('../../utils/VectorLayerUtils');


class RedliningBufferSupport extends React.Component {
    static propTypes = {
        projection: PropTypes.string,
        layers: PropTypes.array,
        redlining: PropTypes.object,
        addLayer: PropTypes.func,
        addLayerFeatures: PropTypes.func
    }
    state = {
        bufferDistance: 0,
        bufferLayer: null
    }
    static contextTypes = {
        messages: PropTypes.object
    }
    componentWillMount() {
        this.setState({bufferLayer: {
            id: "buffer",
            title: LocaleUtils.getMessageById(this.context.messages, "redlining.bufferlayername"),
            role: LayerRole.USERLAYER
        }});
    }
    componentWillReceiveProps(newProps) {
        if(this.state.bufferLayer && !newProps.layers.find(layer => layer.id === this.state.bufferLayer.id)) {
            this.setState({bufferLayer: {
                id: "buffer",
                title: LocaleUtils.getMessageById(this.context.messages, "redlining.bufferlayername"),
                role: LayerRole.USERLAYER
            }});
        }
    }
    render() {
        if(!this.props.redlining.selectedFeature) {
            return (
                <div className="redlining-message">
                    <Message msgId="redlining.bufferselectfeature" />
                </div>
            );
        }
        let enabled = this.state.bufferDistance != 0;
        let layers = this.props.layers.filter(layer => layer.type === "vector" && layer.role === LayerRole.USERLAYER);
        // Ensure list contains current  target layer
        if(!layers.find(layer => layer.id === this.state.bufferLayer.id)) {
            layers = [this.state.bufferLayer, ...layers];
        }
        return (
            <div className="redlining-controlsbar">
                <span>
                    <span><Message msgId="redlining.bufferdistance" /> [m]:&nbsp;</span>
                        <NumericInput mobile strict
                            min={-99999} max={99999} precision={0} step={1}
                            value={this.state.bufferDistance} onChange={(nr) => this.setState({bufferDistance: nr})}/>
                </span>
                <span>
                    <span><Message msgId="redlining.bufferlayer" />:&nbsp;</span>
                    <VectorLayerPicker
                        value={this.state.bufferLayer.id} layers={layers}
                        onChange={layer => this.setState({bufferLayer: layer})}
                        addLayer={this.props.addLayer} />
                </span>
                <span>
                    <button onClick={this.computeBuffer} className="button" disabled={!enabled}>
                        <Message msgId="redlining.buffercompute" />
                    </button>
                </span>
            </div>
        );
    }
    computeBuffer = () => {
        let feature = this.props.redlining.selectedFeature;
        if(!feature || !feature.geometry || !this.state.bufferLayer) {
            return;
        }
        let wgsGeometry = VectorLayerUtils.reprojectGeometry(feature.geometry, this.props.projection, "EPSG:4326");
        let wgsFeature = assign({}, feature, {geometry: wgsGeometry});
        let output = buffer(wgsFeature, this.state.bufferDistance, {units: 'meters'});
        if(output && output.geometry) {
            output.geometry = VectorLayerUtils.reprojectGeometry(output.geometry, "EPSG:4326", this.props.projection);
            output.id = uuid.v4();
            output.styleName = 'default';
            output.styleOptions = {
                fillColor: [0, 0, 255, 0.5],
                strokeColor: [0, 0, 255, 1]
            };
            this.props.addLayerFeatures(this.state.bufferLayer, [output]);
        }
    }
};

module.exports = {
    cfg: {
        key: "Buffer",
        tooltip: "redlining.buffer",
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
