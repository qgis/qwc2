/**
 * Copyright 2017, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const assign = require('object-assign');
const uuid = require('uuid');
const ol = require('openlayers');
const isEmpty = require('lodash.isempty');
const {stringify} = require('wellknown');
const CoordinatesUtils = require('../../MapStore2Components/utils/CoordinatesUtils');
const ConfigUtils = require('../../MapStore2Components/utils/ConfigUtils');

const VectorLayerUtils = {

    createPrintHighlighParams(layers, printCrs, dpi = 96) {
        let params = {
            geoms: [],
            styles: [],
            labels: [],
            labelFillColors: [],
            labelOultineColors: [],
            labelOutlineSizes: [],
            labelSizes: []
        }
        const ensureHex = (rgb) => (!Array.isArray(rgb) ? rgb : ('#' + (0x1000000 + (rgb[2] | (rgb[1] << 8) | (rgb[0] << 16))).toString(16).slice(1)));

        for(let layer of layers) {
            if(layer.type != 'vector' || (layer.features || []).length == 0) {
                continue;
            }
            for(let feature of layer.features) {
                let geometry = VectorLayerUtils.reprojectGeometry(feature.geometry, feature.crs || printCrs, printCrs);
                params.geoms.push(VectorLayerUtils.geoJSONToWkt(geometry));
                params.styles.push(VectorLayerUtils.createSld(geometry.type, feature.styleName, feature.styleOptions, dpi));
                params.labels.push(feature.properties && feature.properties.label || "");
                if(feature.styleName === "text") {
                    params.labelFillColors.push(ensureHex(feature.styleOptions.fillColor));
                    params.labelOultineColors.push(ensureHex(feature.styleOptions.strokeColor));
                    params.labelOutlineSizes.push(1);
                    params.labelSizes.push(10 * feature.styleOptions.strokeWidth);
                } else {
                    params.labelFillColors.push('white');
                    params.labelOultineColors.push('black');
                    params.labelOutlineSizes.push(1);
                    params.labelSizes.push(10);
                }
            }
        }
        return params;
    },
    createSld(geometrytype, styleName, styleOptions, dpi = 96.) {
        let opts = {};
        // Special cases
        if(styleName == 'text') {
            // Make geometry transparent
            opts = {
                strokeColor: [0, 0, 0, 0.],
                fillColor: [0, 0, 0, 0.]
            };
        } else if(styleName == 'marker') {
            opts = {
                strokeColor: [255, 255, 0, 1.],
                strokeWidth: 4,
                fillColor: [0, 0, 0, 0.],
                circleRadius: 6
            };
        } else {
            // Default style
            opts = assign({}, ConfigUtils.getConfigProp("defaultFeatureStyle"), styleOptions);
        }
        let dpiScale = dpi / 96.;

        const ensureHex = (rgb) => (!Array.isArray(rgb) ? rgb : ('#' + (0x1000000 + (rgb[2] | (rgb[1] << 8) | (rgb[0] << 16))).toString(16).slice(1)));
        const opacity = (rgb) => (!Array.isArray(rgb) ? 1. : (rgb[3] === undefined ? 1. : rgb[3]));

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
                   '<se:SvgParameter name="stroke-width">' + (opts.strokeWidth * dpiScale) + '</se:SvgParameter>' +
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
                "coordinates": wgscoo
            };
        } else if(geometry.type === "LineString") {
            return {
                "type": "LineString",
                "coordinates": geometry.coordinates.map(tuple => {
                    return CoordinatesUtils.reproject(tuple, srccrs, dstcrs);
                })
            };
        } else if(geometry.type === "Polygon") {
            return {
                "type": "Polygon",
                "coordinates": geometry.coordinates.map(ring => {
                    return ring.map(tuple => {
                        return CoordinatesUtils.reproject(tuple, srccrs, dstcrs);
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
    wktToGeoJSON(wkt, srccrs, dstcrs) {
        wkt = wkt.replace(/Point(\w+)/i, "Point $1")
                 .replace(/LineString(\w+)/i, "LineString $1")
                 .replace(/Polygon(\w+)/i, "Polygon $1")
                 .replace(/MultiSurface(\w*)/i, "GeometryCollection $1");
        let feature = new ol.format.WKT().readFeature(wkt, {
            dataProjection: srccrs,
            featureProjection: dstcrs
        });
        let featureObj = new ol.format.GeoJSON().writeFeatureObject(feature);
        featureObj.id = uuid.v1();
        return featureObj;
    },
    kmlToGeoJSON(kml) {
        let kmlFormat = new ol.format.KML();
        let geojsonFormat = new ol.format.GeoJSON();
        let features = [];
        let fid = 0;
        for(let olFeature of kmlFormat.readFeatures(kml)) {
            let style = olFeature.getStyleFunction().call(olFeature);
            style = style[0] || style;

            let styleOptions = {
                strokeColor: style.getStroke().getColor(),
                strokeWidth: style.getStroke().getWidth(),
                strokeDash: style.getStroke().getLineDash() || [],
                fillColor: style.getFill().getColor(),
                textFill: style.getText().getFill().getColor(),
                textStroke: style.getText().getStroke().getColor()
            };
            let feature = geojsonFormat.writeFeatureObject(olFeature);
            feature = assign(feature, {
                styleName: 'default',
                styleOptions: styleOptions,
                id: fid++,
                crs: "EPSG:4326"
            });
            features.push(feature);
        }
        return features;
    }
};

module.exports = VectorLayerUtils;
