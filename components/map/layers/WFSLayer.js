/**
 * Copyright 2018-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ol from 'openlayers';
import CoordinatesUtils from '../../../utils/CoordinatesUtils';
import FeatureStyles from '../../../utils/FeatureStyles';


export default {
    create: (options) => {
        const formatMap = {
            "gml3": (proj) => new ol.format.WFS({gmlFormat: new ol.format.GML3(), dataProjection: proj, version: options.version}),
            "gml32": (proj) => new ol.format.WFS({gmlFormat: new ol.format.GML32(), defaultDataProjection: proj}),
            "application/gml+xml; version=3.2": (proj) => new ol.format.WFS({gmlFormat: new ol.format.GML32(), dataProjection: proj, version: options.version}),

            "gml2": (proj) => new ol.format.WFS({gmlFormat: new ol.format.GML2(), dataProjection: proj, version: options.version}),

            "text/xml; subtype=gml/3.1.1": (proj) => new ol.format.WFS({gmlFormat: new ol.format.GML3(), dataProjection: proj, version: options.version}),
            "text/xml; subtype=gml/3.2": (proj) => new ol.format.WFS({gmlFormat: new ol.format.GML32(), dataProjection: proj, version: options.version}),
            "text/xml; subtype=gml/2.1.2": (proj) => new ol.format.WFS({gmlFormat: new ol.format.GML2(), dataProjection: proj, version: options.version}),

            "kml": (proj) => new ol.format.KML({defaultDataProjection: proj}),
            "application/vnd.google-earth.kml+xml": (proj) => new ol.format.KML({defaultDataProjection: proj}),

            "geojson": (proj) => new ol.format.GeoJSON({defaultDataProjection: proj}),
            "json": (proj) => new ol.format.GeoJSON({defaultDataProjection: proj}),
            "application/json": (proj) => new ol.format.GeoJSON({defaultDataProjection: proj})
        };

        let olformat = null;
        let format = null;
        for (const key of Object.keys(formatMap)) {
            const fmt = options.formats.find(entry => entry.toLowerCase() === key);
            if (fmt) {
                olformat = formatMap[key](options.projection);
                format = fmt;
                break;
            }
        }
        if (!format) {
            console.warn("No supported WFS format found");
            return null;
        }

        const typeName = options.version < "2.0.0" ? "typeName" : "typeNames";

        const vectorSource = new ol.source.Vector({
            format: olformat,
            url: function(extent) {
                let bbox = extent.join(',');
                let srsName = options.projection;
                if (options.version >= "1.1.0") {
                    // http://augusttown.blogspot.com/2010/08/mysterious-bbox-parameter-in-web.html
                    // Invert WGS axis orentation
                    const requestExtent = options.projection === 'EPSG:4326' ? [extent[1], extent[0], extent[3], extent[2]] : extent;
                    bbox = requestExtent.join(',') + "," + CoordinatesUtils.toOgcUrnCrs(options.projection);
                    srsName = CoordinatesUtils.toOgcUrnCrs(options.projection);
                }
                const url = options.url + (options.url.endsWith('?') ? '' : '?') + 'service=WFS&version=' + options.version +
                    '&request=GetFeature&' + typeName + '=' + options.name +
                    '&outputFormat=' + encodeURIComponent(format) +
                    '&srsName=' + srsName +
                    '&bbox=' + bbox;
                return url;
            },
            strategy: ol.loadingstrategy.bbox
        });

        return new ol.layer.Vector({
            source: vectorSource,
            style: (feature) => FeatureStyles.default(feature, {
                fillColor: options.color,
                strokeColor: feature.getGeometry().getType().endsWith("LineString") ? options.color : "#000",
                strokeWidth: 1,
                strokeDash: []
            })
        });
    },
    update: (/* layer, newOptions, oldOptions */) => {
    }
};
