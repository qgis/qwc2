/**
 * Copyright 2017, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const assign = require('object-assign');
const uuid = require('uuid');
const {isArray,isEmpty} = require('lodash');
const {parse,stringify} = require('wellknown');
const CoordinatesUtils = require('../../MapStore2Components/utils/CoordinatesUtils');
const ConfigUtils = require('../../MapStore2Components/utils/ConfigUtils');

const VectorLayerUtils = {

    createSld(geometrytype, styleName, styleOptions, dpi = 96.) {
        let opts = {};
        // Special cases
        if(styleName == 'marker') {
            opts = {
                strokeColor: [255, 255, 0, 1.],
                circleBorder: 4,
                fillColor: [0, 0, 0, 0.],
                circleRadius: 6
            };
        } else {
            // Default style
            opts = assign({}, ConfigUtils.getConfigProp("defaultFeatureStyle"), styleOptions);
        }
        let dpiScale = dpi / 96.;

        const ensureHex = (rgb) => (!isArray(rgb) ? rgb : ('#' + (0x1000000 + (rgb[2] | (rgb[1] << 8) | (rgb[0] << 16))).toString(16).slice(1)));
        const opacity = (rgb) => (!isArray(rgb) ? 1. : (rgb[3] === undefined ? 1. : rgb[3]));

        let stroke = '<se:Stroke>' +
                     '<se:SvgParameter name="stroke">' + ensureHex(opts.strokeColor) + '</se:SvgParameter>' +
                     '<se:SvgParameter name="stroke-opacity">' + opacity(opts.strokeColor) + '</se:SvgParameter>' +
                     '<se:SvgParameter name="stroke-width">' + (opts.strokeWidth * dpiScale) + '</se:SvgParameter>' +
                     '<se:SvgParameter name="stroke-linejoin">bevel</se:SvgParameter>' +
                     (!isEmpty(opts.strokeDash) ? '<CssParameter name="stroke-dasharray">' + opts.strokeDash.join(' ') + '</CssParameter>' : '') +
                     '</se:Stroke>';
        let fill = '<se:Fill>' +
                   '<se:SvgParameter name="fill">' + ensureHex(opts.fillColor) + '</se:SvgParameter>' +
                   '<se:SvgParameter name="fill-opacity">' + opacity(opts.fillColor) + '</se:SvgParameter>' +
                   '</se:Fill>';

        let rule = null;
        if(geometrytype == "Point") {
            rule = '<se:PointSymbolizer>' +
                   '<se:Graphic>' +
                   '<se:Mark>' +
                   '<se:WellKnownName>circle</se:WellKnownName>' +
                   '<se:Stroke>' +
                   '<se:SvgParameter name="stroke">' + ensureHex(opts.strokeColor) + '</se:SvgParameter>' +
                   '<se:SvgParameter name="stroke-opacity">' + opacity(opts.strokeColor) + '</se:SvgParameter>' +
                   '<se:SvgParameter name="stroke-width">' + (opts.circleBorder * dpiScale) + '</se:SvgParameter>' +
                   '</se:Stroke>' +
                   fill +
                   '</se:Mark>' +
                   '<se:Size>' + (2. * opts.circleRadius * dpiScale) + '</se:Size>' +
                   '</se:Graphic>' +
                   '</se:PointSymbolizer>';
        } else if(geometrytype == "LineString") {
            rule = '<se:LineSymbolizer>' +
                   stroke +
                   '</se:LineSymbolizer>';
        } else if(geometrytype == "Polygon") {
            rule = '<se:PolygonSymbolizer>' +
                   stroke +
                   fill +
                   '</se:PolygonSymbolizer>';
        }
        if(rule) {
            return '<?xml version="1.0" encoding="UTF-8"?>' +
                   '<StyledLayerDescriptor xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="1.1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xsi:schemaLocation="http://www.opengis.net/sld http://schemas.opengis.net/sld/1.1.0/StyledLayerDescriptor.xsd" xmlns:se="http://www.opengis.net/se">' +
                   '<UserStyle>' +
                   '<se:FeatureTypeStyle>' +
                   '<se:Rule>' +
                   rule +
                   '</se:Rule>' +
                   '</se:FeatureTypeStyle>' +
                   '</UserStyle>' +
                   '</StyledLayerDescriptor>';
        }
        return null;
    },
    reprojectGeometry(geometry, srccrs, dstcrs) {
        if(srccrs == dstcrs) {
            return geometry;
        }
        if(geometry.type === "Point") {
            let wgscoo = CoordinatesUtils.reproject(geometry.coordinates, srccrs, dstcrs);
            return {
                "type": "Point",
                "coordinates": [wgscoo.x, wgscoo.y]
            };
        } else if(geometry.type === "LineString") {
            return {
                "type": "LineString",
                "coordinates": geometry.coordinates.map(tuple => {
                    let wgscoo = CoordinatesUtils.reproject(tuple, srccrs, dstcrs);
                    return [wgscoo.x, wgscoo.y];
                })
            };
        } else if(geometry.type === "Polygon") {
            return {
                "type": "Polygon",
                "coordinates": geometry.coordinates.map(ring => {
                    return ring.map(tuple => {
                        let wgscoo = CoordinatesUtils.reproject(tuple, srccrs, dstcrs);
                        return [wgscoo.x, wgscoo.y];
                    });
                })
            };
        } else {
            return geometry;
        }
    },
    geoJSONToWkt(geometry) {
        return stringify(geometry);
    },
    wktToGeoJSON(wkt) {
        wkt = wkt.replace(/Point(\w+)/i, "Point $1")
                 .replace(/LineString(\w+)/i, "LineString $1")
                 .replace(/Polygon(\w+)/i, "Polygon $1");
        return {
            "id": uuid.v1(),
            "geometry": parse(wkt),
            "type": "Feature",
            "properties": {}
        };
    }
};

module.exports = VectorLayerUtils;
