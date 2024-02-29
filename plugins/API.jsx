/**
 * Copyright 2020-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';

import * as displayActions from '../actions/display';
import {LayerRole} from '../actions/layers';
import * as layerActions from '../actions/layers';
import * as locateActions from '../actions/locate';
import * as mapActions from '../actions/map';
import * as taskActions from '../actions/task';
import * as themeActions from '../actions/theme';
import * as windowsActions from '../actions/windows';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import LayerUtils from '../utils/LayerUtils';
import ServiceLayerUtils from '../utils/ServiceLayerUtils';
import VectorLayerUtils from '../utils/VectorLayerUtils';


/**
 * Exposes an API for interacting with QWC2 via `window.qwc2`.
 *
 * All following action functions are available:
 *
 * - [display](https://github.com/qgis/qwc2/blob/master/actions/display.js)
 * - [layers](https://github.com/qgis/qwc2/blob/master/actions/layers.js)
 * - [locate](https://github.com/qgis/qwc2/blob/master/actions/locate.js)
 * - [map](https://github.com/qgis/qwc2/blob/master/actions/map.js)
 * - [task](https://github.com/qgis/qwc2/blob/master/actions/task.js)
 * - [theme](https://github.com/qgis/qwc2/blob/master/actions/theme.js)
 * - [windows](https://github.com/qgis/qwc2/blob/master/actions/windows.js)
 *
 * I.e. `setCurrentTask` is available via `window.qwc2.setCurrentTask`.
 *
 * Additionally, the following functions are available:
 *
 * ---
 *
 * `window.qwc2.addExternalLayer(resource, beforeLayerName = null)`
 *
 * Convenience method for adding an external layer.
 *
 *   * `resource`: An external resource of the form `wms:<service_url>#<layername>` or `wmts:<capabilities_url>#<layername>`.
 *   * `beforeLayerName`: Insert the new layer before the layer with the specified name. If `null` or the layer does not exist, the layer is inserted on top.
 *
 * ---
 *
 * `window.qwc2.drawScratch(geomType, message, drawMultiple, callback, style = null)`
 *
 *  Deprecated, use `window.qwc2.drawGeometry` instead.
 *
 * ---
 *
 * `window.qwc2.drawGeometry(geomType, message, callback, options)`
 *
 *  Draw geometries, and return these as GeoJSON to the calling application.
 *
 *   * `geomType`: `Point`, `LineString`, `Polygon`, `Circle` or `Box`.
 *   * `message`: A descriptive string to display in the tool taskbar.
 *   * `callback`: A `function(result, crs)`, the `result` being an array of GeoJSON features, and `crs` the projection of the feature coordinates.
 *   * `options`: Optional configuration:
 *         `drawMultiple`: Whether to allow drawing multiple geometries (default: `false`).
 *         `style`: A custom style object to use for the drawn features, in the same format as `DEFAULT_FEATURE_STYLE` in `qwc2/utils/FeatureStyles.js`.
 *         `initialFeatures`: Array of initial geometries.
 *         `snapping`: Whether snapping is available while drawing (default: `false`).
 *         `snappingActive`: Whether snapping is initially active (default: `false`)
 *
 * ---
 *
 * `window.qwc2.getState()`
 *
 * Return the current application state.
 */
class API extends React.Component {
    componentDidMount() {
        window.qwc2 = {};
        // Auto-binded functions
        for (const prop of Object.keys(this.props)) {
            window.qwc2[prop] = this.props[prop];
        }
        // Additional exports
        window.qwc2.LayerRole = LayerRole;
        window.qwc2.addExternalLayer = this.addExternalLayer;
        window.qwc2.drawScratch = this.drawScratch;
        window.qwc2.drawGeometry = this.drawGeometry;
        window.qwc2.getState = this.getState;
        window.qwc2.CoordinatesUtils = CoordinatesUtils;
        window.qwc2.VectorLayerUtils = VectorLayerUtils;
    }
    static propTypes = {
        addLayer: PropTypes.func,
        mapCrs: PropTypes.string,
        setCurrentTask: PropTypes.func,
        state: PropTypes.object
    };
    render() {
        return null;
    }
    addExternalLayer = (resource, beforeLayerName = null, sublayers = true) => {
        const params = LayerUtils.splitLayerUrlParam(resource);
        ServiceLayerUtils.findLayers(params.type, params.url, [params], this.props.mapCrs, (id, layer) => {
            if (layer) {
                if (sublayers === false) {
                    layer.sublayers = null;
                }
                this.props.addLayer(layer, null, beforeLayerName);
            }
        });
    };
    drawScratch = (geomType, message, drawMultiple, callback, style = null) => {
        /* eslint-disable-next-line */
        console.warn("window.qwc2.drawScratch is deprecated, use window.qwc2.drawGeometry instead");
        this.props.setCurrentTask("ScratchDrawing", null, null, {geomType, message, drawMultiple, callback, style});
    };
    drawGeometry = (geomType, message, callback, options = {}) => {
        this.props.setCurrentTask("ScratchDrawing", null, null, {
            callback: callback,
            geomType: geomType,
            message: message,
            drawMultiple: options.drawMultiple || false,
            style: options.style,
            snapping: options.snapping || false,
            snappingActive: options.snappingActive || false,
            initialFeatures: options.initialFeatures
        });
    };
    getState = () => {
        return this.props.state;
    };
}

function extractFunctions(obj) {
    return Object.entries(obj).reduce((result, [key, value]) => {
        if (typeof value === "function") {
            result[key] = value;
        }
        return result;
    }, {});
}

export default connect(state => ({
    mapCrs: state.map.projection,
    state: state
}), {
    ...extractFunctions(displayActions),
    ...extractFunctions(layerActions),
    ...extractFunctions(locateActions),
    ...extractFunctions(mapActions),
    ...extractFunctions(taskActions),
    ...extractFunctions(themeActions),
    ...extractFunctions(windowsActions)
})(API);
