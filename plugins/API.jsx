/**
 * Copyright 2020, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {LayerRole} from '../actions/layers';
import LayerUtils from '../utils/LayerUtils';
import ServiceLayerUtils from '../utils/ServiceLayerUtils';

import * as displayActions from '../actions/display';
import * as layerActions from '../actions/layers';
import * as locateActions from '../actions/locate';
import * as mapActions from '../actions/map';
import * as taskActions from '../actions/task';
import * as themeActions from '../actions/theme';
import * as windowsActions from '../actions/windows';


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
    }
    static propTypes = {
        addLayer: PropTypes.func,
        mapCrs: PropTypes.string,
        setCurrentTask: PropTypes.func
    }
    render() {
        return null;
    }
    /*
     * Convenience method for adding an external layer.
     * - resource: An external resource of the form `wms:<service_url>#<layername>` or `wmts:<capabilities_url>#<layername>`.
     * - beforeLayerName: Insert the new layer before the layer with the specified name. If `null` or the layer does not exist, the layer is inserted on top.
     */
    addExternalLayer = (resource, beforeLayerName = null) => {
        const params = LayerUtils.splitLayerUrlParam(resource);
        ServiceLayerUtils.findLayers(params.type, params.url, [params], this.props.mapCrs, (id, layer) => {
            if (layer) {
                this.props.addLayer(layer, null, beforeLayerName);
            }
        });
    }
    /*
     * Draw scratch geometries, and return these as GeoJSON to the calling application.
     * - geomType: `Point`, `LineString`, `Polygon`, `Circle` or `Box`.
     * - message: A descriptive string to display in the tool taskbar.
     * - drawMultiple: Whether to allow drawing multiple geometries.
     * - callback: A `function(result, crs)`, the `result` being an array of GeoJSON features, and `crs` the projection of the feature coordinates.
     * - style: Optional, a custom style object to use for the drawn features, in the same format as `DEFAULT_FEATURE_STYLE` in `qwc2/utils/FeatureStyles.js`.
     */
    drawScratch = (geomType, message, drawMultiple, callback, style = null) => {
        this.props.setCurrentTask("ScratchDrawing", null, null, {geomType, message, drawMultiple, callback, style});
    }
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
    mapCrs: state.map.projection
}), {
    ...extractFunctions(displayActions),
    ...extractFunctions(layerActions),
    ...extractFunctions(locateActions),
    ...extractFunctions(mapActions),
    ...extractFunctions(taskActions),
    ...extractFunctions(themeActions),
    ...extractFunctions(windowsActions)
})(API);
