/**
 * Copyright 2018, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const ol = require('openlayers');
const assign = require('object-assign');
const ProxyUtils = require('../../../../utils/ProxyUtils');
const CoordinatesUtils = require('../../../../utils/CoordinatesUtils');
const FeatureStyles = require('../FeatureStyles');


let WMSLayer = {
    create: (options) => {
        const formatMap = {
            "gml3": (proj) => new ol.format.WFS({gmlFormat: new ol.format.GML3(), defaultDataProjection: proj}),
            "gml32": (proj) => new ol.format.WFS({gmlFormat: new ol.format.GML3(), defaultDataProjection: proj}),
            "application/gml+xml; version=3.2": (proj) => new ol.format.WFS({gmlFormat: new ol.format.GML3(), defaultDataProjection: proj}),

            "gml2": (proj) => new ol.format.WFS({gmlFormat: new ol.format.GML2(), defaultDataProjection: proj}),

            "text/xml; subtype=gml/3.1.1": (proj) => new ol.format.WFS({gmlFormat: new ol.format.GML3(), defaultDataProjection: proj}),
            "text/xml; subtype=gml/3.2": (proj) => new ol.format.WFS({gmlFormat: new ol.format.GML3(), defaultDataProjection: proj}),
            "text/xml; subtype=gml/2.1.2": (proj) => new ol.format.WFS({gmlFormat: new ol.format.GML2(), defaultDataProjection: proj}),

            "kml": (proj) => new ol.format.KML({defaultDataProjection: proj}),
            "application/vnd.google-earth.kml+xml": (proj) => new ol.format.KML({defaultDataProjection: proj}),

            "geojson": (proj) => new ol.format.GeoJSON({defaultDataProjection: proj}),
            "json": (proj) => new ol.format.GeoJSON({defaultDataProjection: proj}),
            "application/json": (proj) => new ol.format.GeoJSON({defaultDataProjection: proj})
        };

        let olformat = null;
        let format = null;
        for(let key of Object.keys(formatMap)) {
            let fmt = options.formats.find(entry => entry.toLowerCase() === key);
            if(fmt) {
                olformat = formatMap[key](options.srs);
                format = fmt;
                break;
            }
        }
        if(!format) {
            console.warn("No supported WFS format found");
            return null;
        }

        let typeName = options.version < "2.0.0" ? "typeName" : "typeNames";

        let vectorSource = new ol.source.Vector({
            format: olformat,
            url: function(extent) {
                let requestExtent;
                if(options.version >= "1.1.0") {
                    extent = CoordinatesUtils.reprojectBbox(extent, options.srs, 'EPSG:4326');
                    // http://augusttown.blogspot.com/2010/08/mysterious-bbox-parameter-in-web.html
                    // Invert WGS axis orentation
                    requestExtent = [extent[1], extent[0], extent[3], extent[2]];
                } else {
                    requestExtent = extent;
                }
                let url = ProxyUtils.addProxyIfNeeded(
                    options.url + (options.url.endsWith('?') ? '' : '?') + 'service=WFS&version=' + options.version +
                    '&request=GetFeature&' + typeName + '=' + options.name +
                    '&outputFormat=' + encodeURIComponent(format) +
                    '&srsName=' + options.srs +
                    '&bbox=' + requestExtent.join(',')
                );
                return url;
            },
            strategy: ol.loadingstrategy.bbox
        });

        return new ol.layer.Vector({
            source: vectorSource,
            zIndex: options.zIndex,
            style: (feature) => FeatureStyles.default(feature, {
                fillColor: options.color,
                strokeColor: feature.getGeometry().getType().endsWith("LineString") ? options.color : "#000",
                strokeWidth: 1,
                strokeDash: []
            })
        });
    },
    update: (layer, newOptions, oldOptions) => {
    }
};

module.exports = WMSLayer;
