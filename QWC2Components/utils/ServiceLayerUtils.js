/**
 * Copyright 2017, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const ol = require('openlayers');
const {isEmpty} = require('lodash');

function strcmp(a, b) {
    let al = a.toLowerCase();
    let bl = b.toLowerCase();
    return al < bl ? -1 : al > bl ? 1 : 0;
}

const ServiceLayerUtils = {
    getWMSLayers(capabilitiesXml) {
        let wmsFormat = new ol.format.WMSCapabilities();
        let capabilities = wmsFormat.read(capabilitiesXml);
        let infoFormats = null;
        try {
            infoFormats = capabilities.Capability.Request.GetFeatureInfo.Format;
        } catch(e) {
            infoFormats = ['text/plain'];
        }
        let topLayer = null;
        try {
            topLayer = capabilities.Capability.Layer;
        } catch (e) {
            return [];
        }
        let serviceUrl = capabilities.Service.OnlineResource;
        let version = capabilities.version;
        if(!topLayer.Layer) {
            return [this.getWMSLayerParams(topLayer, topLayer.CRS, serviceUrl, version, infoFormats)];
        } else {
            let entries = topLayer.Layer.map(layer => this.getWMSLayerParams(layer, topLayer.CRS, serviceUrl, version, infoFormats));
            return entries.sort((a, b) => strcmp(a.title, b.title));
        }
    },
    getWMSLayerParams(layer, parentCrs, serviceUrl, version, infoFormats) {
        let supportedCrs = layer.CRS;
        if(isEmpty(supportedCrs)) {
            supportedCrs = [...parentCrs];
        } else {
            supportedCrs = [...parentCrs, ...supportedCrs];
        }
        let sublayers = [];
        if(!isEmpty(layer.Layer)) {
            sublayers = layer.Layer.map(sublayer => this.getWMSLayerParams(sublayer, supportedCrs, serviceUrl, version));
        }
        let bbox = {
            crs: layer.BoundingBox[0].crs,
            bounds: layer.BoundingBox[0].extent
        };
        let legendUrl = null;
        try {
            legendUrl = layer.Style[0].LegendURL[0].OnlineResource;
        } catch (e) {
        }
        return {
            type: "wms",
            name: layer.Name,
            title: layer.Title,
            abstract: layer.Abstract,
            attribution: layer.Attribution,
            legendUrl: legendUrl,
            service: serviceUrl,
            version: version,
            infoFormats: infoFormats,
            queryable: layer.queryable,
            sublayers: sublayers.sort((a, b) => strcmp(a.title, b.title)),
            expanded: false,
            bbox: bbox
        };
    }
};

module.exports = ServiceLayerUtils;
