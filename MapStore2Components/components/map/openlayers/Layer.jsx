/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
const React = require('react');
const PropTypes = require('prop-types');
const assign = require('object-assign');
const _ = require('lodash');
const CoordinatesUtils = require('../../../utils/CoordinatesUtils');
const LayerRegistry = require('./plugins/index');

class OpenlayersLayer extends React.Component {
    static propTypes = {
        map: PropTypes.object,
        mapId: PropTypes.string,
        type: PropTypes.string,
        srs: PropTypes.string,
        position: PropTypes.number,
        options: PropTypes.object,
        onLayerLoading: PropTypes.func,
        onLayerError: PropTypes.func,
        onLayerLoad: PropTypes.func,
        onInvalid: PropTypes.func
    }
    static defaultProps = {
        onLayerLoading: () => {},
        onLayerLoad: () => {},
        onLayerError: () => {},
        onInvalid: () => {}
    }
    state = {
        layer: null
    }
    componentDidMount() {
        this.valid = true;
        this.tilestoload = 0;
        this.createLayer(this.props.type, this.props.options, this.props.position);
    }
    componentWillReceiveProps(newProps) {
        const newVisibility = newProps.options && newProps.options.visibility !== false;
        this.setLayerVisibility(newVisibility);

        const newOpacity = (newProps.options && newProps.options.opacity !== undefined) ? newProps.options.opacity : 1.0;
        this.setLayerOpacity(newOpacity);

        if (newProps.position !== this.props.position && this.state.layer.setZIndex) {
            this.state.layer.setZIndex(newProps.position);
        }
        if (this.props.options) {
            this.updateLayer(newProps, this.props);
        }
    }
    componentWillUnmount() {
        if (this.state.layer && this.props.map) {
            if (this.state.layer.detached) {
                this.state.layer.remove();
            } else {
                this.props.map.removeLayer(this.state.layer);
            }
        }
    }
    render() {
        if (this.props.children) {
            const layer = this.state.layer;
            if(!layer) {
                return null;
            }
            return (
                <noscript>
                    {React.Children.map(this.props.children, child => {
                        return child ? React.cloneElement(child, {container: layer}) : null;
                    })}
                </noscript>
            );
        }

        let layerCreator = LayerRegistry[this.props.type];
        if (layerCreator && layerCreator.render) {
            return layerCreator.render(this.props.options, this.props.map, this.props.mapId, this.state.layer);
        }
        return null;
    }
    setLayerVisibility = (visibility) => {
        var oldVisibility = this.props.options && this.props.options.visibility !== false;
        if (visibility !== oldVisibility && this.state.layer && this.isValid(this.state.layer)) {
            this.state.layer.setVisible(visibility);
        }
    }
    setLayerOpacity = (opacity) => {
        var oldOpacity = (this.props.options && this.props.options.opacity !== undefined) ? this.props.options.opacity : 1.0;
        if (opacity !== oldOpacity && this.state.layer) {
            this.state.layer.setOpacity(opacity);
        }
    }
    generateOpts = (options, position, srs) => {
        return assign({}, options, position ? {zIndex: position, srs} : null, {
            onError: () => {
                this.props.onInvalid(this.props.type, options);
            }
        });
    }
    createLayer = (type, options, position) => {
        let layerCreator = LayerRegistry[type];
        if (layerCreator) {
            const layerOptions = this.generateOpts(options, position, CoordinatesUtils.normalizeSRS(this.props.srs));
            let layer = layerCreator.create(layerOptions, this.props.map, this.props.mapId);
            if (layer && !layer.detached) {
                this.addLayer(layer, options);
            }
            this.setState({layer: layer});
        }
    }
    updateLayer = (newProps, oldProps) => {
        // optimization to avoid to update the layer if not necessary
        if (newProps.position === oldProps.position && newProps.srs === oldProps.srs) {
            // check if options are the same, except loading
            if (newProps.options === oldProps.options) return;
            if (_.isEqual( _.omit(newProps.options, ["loading"]), _.omit(oldProps.options, ["loading"]) ) ) {
                return;
            }
        }
        let layerCreator = LayerRegistry[this.props.type];
        if (layerCreator && layerCreator.update) {
            layerCreator.update(
            this.state.layer,
            this.generateOpts(newProps.options, newProps.position, newProps.srs),
            this.generateOpts(oldProps.options, oldProps.position, oldProps.srs),
            this.props.map,
            this.props.mapId);
        }
    }
    addLayer = (layer, options) => {
        if (this.isValid(layer)) {
            this.props.map.addLayer(layer);
            if (options.singleTile) {
                layer.getSource().on('imageloadstart', () => {
                    this.props.onLayerLoading(options.id);
                });
                layer.getSource().on('imageloadend', () => {
                    this.props.onLayerLoad(options.id);
                });
                layer.getSource().on('imageloaderror', (event) => {
                    this.props.onLayerLoad(options.id, {error: event});
                });
            }
            else {
                layer.getSource().on('tileloadstart', () => {
                    if (this.tilestoload === 0) {
                        this.props.onLayerLoading(options.id);
                    }
                    this.tilestoload++;
                });
                layer.getSource().on('tileloadend', () => {
                    this.tilestoload--;
                    if (this.tilestoload === 0) {
                        this.props.onLayerLoad(options.id);
                    }
                });
                layer.getSource().on('tileloaderror', (event) => {
                    this.tilestoload--;
                    this.props.onLayerError(options.id);
                    if (this.tilestoload === 0) {
                        this.props.onLayerLoad(options.id, {error: event});
                    }
                });
            }
        }
    }
    isValid = (layer) => {
        var layerCreator = LayerRegistry[this.props.type];
        this.valid = layerCreator && layerCreator.isValid ? layerCreator.isValid(layer) : true;
        return this.valid;
    }
};

module.exports = OpenlayersLayer;
