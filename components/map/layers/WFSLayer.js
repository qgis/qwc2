/**
 * Copyright 2018-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ol from 'openlayers';
import url from 'url';

import CoordinatesUtils from '../../../utils/CoordinatesUtils';
import FeatureStyles from '../../../utils/FeatureStyles';


export default {
    create: (options) => {
        const formatMap = {
            "gml3": (proj) => new ol.format.WFS({gmlFormat: new ol.format.GML3({dataProjection: proj}), version: options.version}),
            "gml32": (proj) => new ol.format.WFS({gmlFormat: new ol.format.GML32({dataProjection: proj}), version: options.version}),
            "application/gml+xml; version=3.2": (proj) => new ol.format.WFS({gmlFormat: new ol.format.GML32({dataProjection: proj}), version: options.version}),

            "gml2": (proj) => new ol.format.WFS({gmlFormat: new ol.format.GML2({dataProjection: proj}), version: options.version}),

            "text/xml; subtype=gml/3.1.1": (proj) => new ol.format.WFS({gmlFormat: new ol.format.GML3({dataProjection: proj}), version: options.version}),
            "text/xml; subtype=gml/3.2": (proj) => new ol.format.WFS({gmlFormat: new ol.format.GML32({dataProjection: proj}), version: options.version}),
            "text/xml; subtype=gml/2.1.2": (proj) => new ol.format.WFS({gmlFormat: new ol.format.GML2({dataProjection: proj}), version: options.version}),

            "kml": (proj) => new ol.format.KML({defaultDataProjection: proj}),
            "application/vnd.google-earth.kml+xml": (proj) => new ol.format.KML({dataProjection: proj}),

            "geojson": (proj) => new ol.format.GeoJSON({dataProjection: proj}),
            "json": (proj) => new ol.format.GeoJSON({dataProjection: proj}),
            "application/json": (proj) => new ol.format.GeoJSON({dataProjection: proj})
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
            // eslint-disable-next-line
            console.warn("No supported WFS format found");
            return null;
        }

        const typeName = options.version < "2.0.0" ? "typeName" : "typeNames";

        const vectorSource = new ol.source.Vector({
            format: olformat,
            loader: options.loader ? function(extent, resolution, projection, success, failure) {
                options.loader(vectorSource, extent, resolution, projection, success, failure);
            } : undefined,
            url: options.url ? function(extent) {
                let bbox = extent.join(',');
                let srsName = options.projection;
                if (options.version >= "1.1.0") {
                    // http://augusttown.blogspot.com/2010/08/mysterious-bbox-parameter-in-web.html
                    // Invert WGS axis orentation
                    const requestExtent = options.projection === 'EPSG:4326' ? [extent[1], extent[0], extent[3], extent[2]] : extent;
                    bbox = requestExtent.join(',') + "," + CoordinatesUtils.toOgcUrnCrs(options.projection);
                    srsName = CoordinatesUtils.toOgcUrnCrs(options.projection);
                }
                const urlParts = url.parse(options.url, true);
                const urlParams = Object.entries(urlParts.query).reduce((res, [key, val]) => ({...res, [key.toUpperCase()]: val}), {});
                delete urlParts.search;
                urlParts.query = {
                    ...urlParams,
                    SERVICE: 'WFS',
                    VERSION: options.version,
                    REQUEST: 'GetFeature',
                    [typeName]: options.name,
                    outputFormat: format,
                    srsName: srsName,
                    bbox: bbox
                };
                return url.format(urlParts);
            } : undefined,
            strategy: ol.loadingstrategy.bbox
        });

        return new ol.layer.Vector({
            source: vectorSource,
            style: (feature) => FeatureStyles.default(feature, {
                fillColor: options.color,
                strokeColor: feature.getGeometry().getType().endsWith("LineString") ? options.color : "#000",
                strokeWidth: 1,
                strokeDash: [],
                circleRadius: 5
            })
        });
    },
    update: (/* layer, newOptions, oldOptions */) => {
    }
};
