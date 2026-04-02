/**
 * Copyright 2026 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class Layer3D {
    constructor(id, layer) {
        this._layer = layer;
        this._layer.userData.layerId = id;
        this._map = null;
    }
    attach(map) {
        this._map = map;
        this._map.addLayer(this._layer);
    }
    dispose() {
        if (this._map) {
            this._map.removeLayer(this._layer, {dispose: true});
        }
    }
    layer() {
        return this._layer;
    }
    moveAfter(layerBelow) {
        if (this._map) {
            this._map.insertLayerAfter(this._layer, layerBelow);
        }
    }
    setOpacity(opacity) {
        this._layer.opacity = opacity;
    }
    opacity() {
        return this._layer.opacity;
    }
    setVisible(visible) {
        this._layer.visible = visible;
    }
    visible() {
        return this._layer.visible;
    }
}

export class LayerGroup3D {
    constructor(id) {
        this._id = id;
        this._layers = [];
        this._map = null;
    }
    attach(map) {
        this._map = map;
        this._layers.forEach(layer => {
            this._map.addLayer(layer);
        });
    }
    addLayer(layer) {
        this._layers.push(layer);
        if (this._map) {
            this._map.addLayer(layer);
            if (this._layers.length > 1) {
                this._map.insertLayerAfter(layer, this._layers[this._layers.length - 2]);
            }
        }
        this._layers.forEach((l, idx) => {
            l.userData.layerId = this._id + ":" + idx;
        });
        // Last layer should carry unsuffixed layer id (so that insertLayerAfter works)
        this._layers[this._layers.length - 1].userData.layerId = this.is;
    }
    removeLayer(layer) {
        if (this._map) {
            this._map.removeLayer(layer, {dispose: true});
        }
        this._layers = this._layers.filter(x => x !== layer);
    }
    dispose() {
        if (this._map) {
            this._layers.forEach(layer => {
                this._map.removeLayer(layer, {dispose: true});
            });
        }
        this._layers = [];
    }
    moveAfter(layerBelow) {
        if (this._map) {
            let prevLayer = layerBelow;
            this._layers.forEach(layer => {
                this._map.insertLayerAfter(layer, prevLayer);
                prevLayer = layer;
            });
        }
    }
    setOpacity(opacity) {
        this._layers.forEach(layer => {
            layer.opacity = opacity;
        });
    }
    opacity() {
        return this._layers[0]?.opacity;
    }
    setVisible(visible) {
        this._layers.forEach(layer => {
            layer.visible = visible;
        });
    }
    visible() {
        return this._layers[0]?.visible;
    }
}
