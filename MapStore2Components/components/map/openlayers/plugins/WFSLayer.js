/**
 * Copyright 2018, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

var ol = require('openlayers');
var assign = require('object-assign');
const ProxyUtils = require('../../../../utils/ProxyUtils');
const FeatureStyles = require('../FeatureStyles');


let WMSLayer = {
    create: (options) => {
        const formatMap = {
            "gml2": (proj) => new ol.format.GML2({defaultDataProjection: proj}),
            "text/xml; subtype=gml/2.1.2": (proj) => new ol.format.WFS({gmlFormat: new ol.format.GML2(), defaultDataProjection: proj}),

            "gml3": (proj) => new ol.format.GML3({defaultDataProjection: proj}),
            "gml32": (proj) => new ol.format.GML3({defaultDataProjection: proj}),
            "text/xml; subtype=gml/3.1.1": (proj) => new ol.format.WFS({gmlFormat: new ol.format.GML3(), defaultDataProjection: proj}),
            "application/gml+xml; version=3.2": (proj) => new ol.format.WFS({gmlFormat: new ol.format.GML3(), defaultDataProjection: proj}),
            "text/xml; subtype=gml/3.2": (proj) => new ol.format.WFS({gmlFormat: new ol.format.GML3(), defaultDataProjection: proj}),

            "geojson": (proj) => new ol.format.GeoJSON({defaultDataProjection: proj}),
            "json": (proj) => new ol.format.GeoJSON({defaultDataProjection: proj}),
            "application/json": (proj) => new ol.format.GeoJSON({defaultDataProjection: proj}),

            "kml": (proj) => new ol.format.KML({defaultDataProjection: proj}),
            "application/vnd.google-earth.kml+xml": (proj) => new ol.format.KML({defaultDataProjection: proj})
        };

        let olformat = null;
        let format = null;
        for(let fmt of options.formats) {
            if(formatMap[fmt.toLowerCase()]) {
                olformat = formatMap[fmt.toLowerCase()](options.srs);
                format = fmt;
                break;
            }
        }
        let typeName = options.version < "2.0.0" ? "typeName" : "typeNames";

        let vectorSource = new ol.source.Vector({
            format: olformat,
            url: function(extent) {
                let url = ProxyUtils.addProxyIfNeeded(
                    options.url + 'service=WFS&version=' + options.version +
                    '&request=GetFeature&' + typeName + '=' + options.name +
                    '&outputFormat=' + encodeURIComponent(format) +
                    '&srsname=' + encodeURIComponent(options.srs) +
                    '&bbox=' + extent.join(',')
                );
                console.log(url);
                return url;
            },
            strategy: ol.loadingstrategy.bbox
        });
        vectorSource.on('addfeature', (ev) => {
            console.log("Add feature");
            console.log(ev);
         });

        return new ol.layer.Vector({
            source: vectorSource,
            style: (feature) => FeatureStyles.default(feature, {})
        });
    },
    update: (layer, newOptions, oldOptions) => {
    }
};

module.exports = WMSLayer;
