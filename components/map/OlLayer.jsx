/**
 * Copyright 2015 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React from 'react';
import {connect} from 'react-redux';

import ol from 'openlayers';
import PropTypes from 'prop-types';

import {setLayerLoading} from '../../actions/layers';
import CoordinatesUtils from '../../utils/CoordinatesUtils';
import MapUtils from '../../utils/MapUtils';
import Signal from '../../utils/Signal';
import LayerRegistry from './layers/index';

export const OlLayerAdded = new Signal();
export const OlLayerUpdated = new Signal();


class OlLayer extends React.Component {
    static propTypes = {
        map: PropTypes.object,
        options: PropTypes.object,
        projection: PropTypes.string,
        setLayerLoading: PropTypes.func,
        swipe: PropTypes.number,
        zIndex: PropTypes.number
    };
    state = {
        layer: null
    };
    componentDidMount() {
        this.tilestoload = 0;
        this.createLayer(this.makeOptions(this.props.options));
    }
    componentDidUpdate(prevProps) {
        if (!this.state.layer) {
            return;
        }
        const newOptions = this.makeOptions(this.props.options);
        const oldOptions = this.makeOptions(prevProps.options);

        this.updateLayer(newOptions, oldOptions);
        // WMS layer handles visibility separately
        if (newOptions.type !== "wms") {
            this.state.layer.setVisible(newOptions.visibility);
        }
        this.state.layer.setOpacity(newOptions.opacity / 255.0);
        this.state.layer.setZIndex(this.props.zIndex);

        if (this.props.swipe !== prevProps.swipe) {
            this.props.map.render();
        }
    }
    componentWillUnmount() {
        if (this.state.layer && this.props.map) {
            this.props.map.removeLayer(this.state.layer);
        }
    }
    render() {
        const layerCreator = LayerRegistry[this.props.options.type];
        if (layerCreator && layerCreator.render) {
            // NOTE: required for Google Maps layer
            return layerCreator.render(this.props.options, this.props.map, this.state.layer);
        }
        return null;
    }
    makeOptions = (options) => {
        const projection = options.srs || options.crs || options.projection || this.props.projection;
        return {
            ...options,
            projection: projection,
            opacity: options.opacity !== undefined ? options.opacity : 255,
            minResolution: typeof options.minScale === 'number' ? MapUtils.getResolutionsForScales([options.minScale], projection)[0] : undefined,
            maxResolution: typeof options.maxScale === 'number' ? MapUtils.getResolutionsForScales([options.maxScale], projection)[0] : undefined
        };
    };
    createLayer = (options) => {
        let layer = null;
        if (options.type === 'group') {
            layer = new ol.layer.Group({zIndex: this.props.zIndex});
            layer.setLayers(new ol.Collection(options.items.map(item => {
                const layerCreator = LayerRegistry[item.type];
                if (layerCreator) {
                    const sublayer = layerCreator.create(this.makeOptions(item), this.props.map);
                    layer.set('id', options.id + "#" + item.name);
                    return sublayer;
                } else {
                    return null;
                }
            }).filter(x => x)));
        } else {
            const layerCreator = LayerRegistry[options.type];
            if (layerCreator) {
                layer = layerCreator.create(options, this.props.map);
            }
        }
        if (layer) {
            layer.set('id', options.id);
            layer.setVisible(layer.get("empty") !== true && options.visibility);
            layer.setOpacity(options.opacity / 255.0);
            layer.setZIndex(this.props.zIndex);
            this.addLayer(layer, options);
            this.setState({layer: layer});
        }
    };
    updateLayer = (newOptions, oldOptions) => {
        // optimization to avoid to update the layer if not necessary
        if (newOptions === oldOptions) {
            return;
        }
        const layerCreator = LayerRegistry[this.props.options.type];
        if (layerCreator && layerCreator.update) {
            layerCreator.update(
                this.state.layer,
                newOptions,
                oldOptions,
                this.props.map
            );
            OlLayerUpdated.notify(this.state.layer);
        }
    };
    addLayer = (layer, options) => {
        this.props.map.addLayer(layer);
        OlLayerAdded.notify(layer);
        layer.on('prerender', (event) => {
            const ctx = event.context;
            ctx.save();
            ctx.beginPath();
            if (this.props.swipe !== null && this.props.swipe !== undefined) {
                const width = ctx.canvas.width * (this.props.swipe / 100);
                ctx.rect(0, 0, width, ctx.canvas.height);
                ctx.clip();
            }
        });

        layer.on('postrender', (event) => {
            event.context.restore();
        });

        if (options.zoomToExtent && options.bbox && options.bbox.bounds) {
            const map = this.props.map;
            const extent = CoordinatesUtils.reprojectBbox(options.bbox.bounds, options.bbox.crs, map.getView().getProjection());
            try {
                map.getView().fit(extent, map.getSize());
            } catch (e) {
                /* pass */
            }
        }
        const sublayers = {};
        if (layer instanceof ol.layer.Group) {
            layer.getLayers().forEach(sublayer => {
                sublayers[options.id + "#" + sublayer.get('id')] = sublayer;
            });
        } else {
            sublayers[options.id] = layer;
        }
        Object.entries(sublayers).map(([id, sublayer]) => {
            if (sublayer.getSource() && sublayer.getSource().getImageLoadFunction) {
                sublayer.getSource().on('imageloadstart', () => {
                    this.props.setLayerLoading(id, true);
                });
                sublayer.getSource().on('imageloadend', () => {
                    this.props.setLayerLoading(id, false);
                });
                sublayer.getSource().on('imageloaderror', () => {
                    this.props.setLayerLoading(id, false);
                });
            } else if (sublayer.getSource() && sublayer.getSource().getTileLoadFunction) {
                sublayer.getSource().on('tileloadstart', () => {
                    if (this.tilestoload === 0) {
                        this.props.setLayerLoading(id, true);
                    }
                    this.tilestoload++;
                });
                sublayer.getSource().on('tileloadend', () => {
                    this.tilestoload--;
                    if (this.tilestoload === 0) {
                        this.props.setLayerLoading(id, false);
                    }
                });
                sublayer.getSource().on('tileloaderror', () => {
                    this.tilestoload--;
                    if (this.tilestoload === 0) {
                        this.props.setLayerLoading(id, false);
                    }
                });
            } else if (sublayer.getSource() && sublayer.getSource() instanceof ol.source.Vector && sublayer.getSource().getUrl()) {
                sublayer.getSource().on('featuresloadstart', () => {
                    this.props.setLayerLoading(id, true);
                });
                sublayer.getSource().on('featuresloadend', () => {
                    this.props.setLayerLoading(id, false);
                });
                sublayer.getSource().on('featuresloaderror', () => {
                    this.props.setLayerLoading(id, false);
                });
            }
        });
    };
}

export default connect(() => ({}), {
    setLayerLoading: setLayerLoading
})(OlLayer);
