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
