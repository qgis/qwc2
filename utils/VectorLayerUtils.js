/**
 * Copyright 2017-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import uuid from 'uuid';
import ol from 'openlayers';
import isEmpty from 'lodash.isempty';
import {stringify} from 'wellknown';
import geojsonBbox from 'geojson-bounding-box';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import ConfigUtils from '../utils/ConfigUtils';
import {getDefaultImageStyle} from 'ol/format/KML';


const VectorLayerUtils = {
    createPrintHighlighParams(layers, printCrs, dpi = 96, scaleFactor = 1.0) {
        const qgisServerVersion = ConfigUtils.getConfigProp("qgisServerVersion") || 3;
        const params = {
            geoms: [],
            styles: [],
            labels: [],
            labelFillColors: [],
            labelOultineColors: [],
            labelOutlineSizes: [],
            labelSizes: []
        };
        const defaultFeatureStyle = ConfigUtils.getConfigProp("defaultFeatureStyle");
        let ensureHex = null;
        if (qgisServerVersion >= 3) {
            ensureHex = (rgb) => (!Array.isArray(rgb) ? rgb : '#' + [255 - (rgb[3] || 1) * 255, ...rgb.slice(0, 3)].map(v => v.toString(16).padStart(2, '0')).join(''));
        } else {
            ensureHex = (rgb) => (!Array.isArray(rgb) ? rgb : ('#' + (0x1000000 + (rgb[2] | (rgb[1] << 8) | (rgb[0] << 16))).toString(16).slice(1)));
        }

        for (const layer of layers.slice(0).reverse()) {
            if (layer.type !== 'vector' || (layer.features || []).length === 0 || layer.visibility === false) {
                continue;
            }
            for (const feature of layer.features) {
                if (!feature.geometry) {
                    continue;
                }
                let geometry = VectorLayerUtils.reprojectGeometry(feature.geometry, feature.crs || printCrs, printCrs);
                params.styles.push(VectorLayerUtils.createSld(geometry.type, feature.styleName, feature.styleOptions, layer.opacity, dpi, scaleFactor));
                params.labels.push(feature.properties && feature.properties.label || " ");
                if (feature.styleName === "text") {
                    // Make point a tiny square, so that QGIS server centers the text inside the polygon when labelling
                    const x = geometry.coordinates[0];
                    const y = geometry.coordinates[1];
                    geometry = {
                        type: "Polygon",
                        coordinates: [[
                            [x - 0.00001, y - 0.00001],
                            [x + 0.00001, y - 0.00001],
                            [x + 0.00001, y + 0.00001],
                            [x - 0.00001, y + 0.00001],
                            [x - 0.00001, y - 0.00001]
                        ]]
                    };
                    params.geoms.push(VectorLayerUtils.geoJSONToWkt(geometry));
                    params.labelFillColors.push(ensureHex(feature.styleOptions.fillColor));
                    params.labelOultineColors.push(ensureHex(feature.styleOptions.strokeColor));
                    params.labelOutlineSizes.push(scaleFactor * feature.styleOptions.strokeWidth);
                    params.labelSizes.push(Math.round(10 * feature.styleOptions.strokeWidth * scaleFactor));
                } else {
                    params.geoms.push(VectorLayerUtils.geoJSONToWkt(geometry));
                    params.labelFillColors.push(defaultFeatureStyle.textFill);
                    params.labelOultineColors.push(defaultFeatureStyle.textStroke);
                    if (qgisServerVersion >= 3) {
                        params.labelOutlineSizes.push(scaleFactor * (feature.styleOptions || defaultFeatureStyle).strokeWidth);
                    } else {
                        params.labelOutlineSizes.push(scaleFactor);
                    }
                    params.labelSizes.push(Math.round(10 * scaleFactor));
                }
            }
        }
        return params;
    },
    createSld(geometrytype, styleName, styleOptions, layerOpacity, dpi = 96, scaleFactor = 1.0) {
        let opts = {};
        // Special cases
        if (styleName === 'text') {
            // Make geometry transparent
            opts = {
                strokeColor: [0, 0, 0, 0],
                fillColor: [0, 0, 0, 0]
            };
        } else if (styleName === 'marker') {
            opts = {
                strokeColor: [0, 0, 255, 1],
                strokeWidth: 4,
                fillColor: [255, 255, 255, 1],
                circleRadius: 6
            };
        } else {
            // Default style
            opts = {...ConfigUtils.getConfigProp("defaultFeatureStyle"), ...styleOptions};
        }
        const dpiScale = dpi / 96 * scaleFactor;

        const ensureHex = (rgb) => (!Array.isArray(rgb) ? rgb : ('#' + (0x1000000 + (rgb[2] | (rgb[1] << 8) | (rgb[0] << 16))).toString(16).slice(1)));
        const opacity =  (rgb) => {
            if (Array.isArray(rgb) && rgb.length > 3) {
                return rgb[3] * layerOpacity / 255;
            }
            return 1 * layerOpacity / 255;
        };

        const stroke = '<se:Stroke>' +
                     '<se:SvgParameter name="stroke">' + ensureHex(opts.strokeColor) + '</se:SvgParameter>' +
                     '<se:SvgParameter name="stroke-opacity">' + opacity(opts.strokeColor) + '</se:SvgParameter>' +
                     '<se:SvgParameter name="stroke-width">' + (opts.strokeWidth * dpiScale) + '</se:SvgParameter>' +
                     '<se:SvgParameter name="stroke-linejoin">round</se:SvgParameter>' +
                     (!isEmpty(opts.strokeDash) ? '<CssParameter name="stroke-dasharray">' + opts.strokeDash.join(' ') + '</CssParameter>' : '') +
                     '</se:Stroke>';
        const fill = '<se:Fill>' +
                   '<se:SvgParameter name="fill">' + ensureHex(opts.fillColor) + '</se:SvgParameter>' +
                   '<se:SvgParameter name="fill-opacity">' + opacity(opts.fillColor) + '</se:SvgParameter>' +
                   '</se:Fill>';

        let rule = null;
        if (geometrytype === "Point") {
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
                   '<se:Size>' + (2 * opts.circleRadius * dpiScale) + '</se:Size>' +
                   '</se:Graphic>' +
                   '</se:PointSymbolizer>';
        } else if (geometrytype === "LineString") {
            rule = '<se:LineSymbolizer>' +
                   stroke +
                   '</se:LineSymbolizer>';
        } else if (geometrytype === "Polygon") {
            rule = '<se:PolygonSymbolizer>' +
                   stroke +
                   fill +
                   '</se:PolygonSymbolizer>';
        }
        if (rule) {
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
        if (srccrs === dstcrs) {
            return geometry;
        }
        if (geometry.type === "Point") {
            const wgscoo = CoordinatesUtils.reproject(geometry.coordinates, srccrs, dstcrs);
            return {
                type: geometry.type,
                coordinates: wgscoo
            };
        } else if (geometry.type === "LineString" || geometry.type === "MultiPoint") {
            return {
                type: geometry.type,
                coordinates: geometry.coordinates.map(tuple => {
                    return CoordinatesUtils.reproject(tuple, srccrs, dstcrs);
                })
            };
        } else if (geometry.type === "Polygon" || geometry.type === "MultiLineString") {
            return {
                type: geometry.type,
                coordinates: geometry.coordinates.map(ring => {
                    return ring.map(tuple => {
                        return CoordinatesUtils.reproject(tuple, srccrs, dstcrs);
                    });
                })
            };
        } else if (geometry.type === "MultiPolygon") {
            return {
                type: geometry.type,
                coordinates: geometry.coordinates.map(part => {
                    return part.map(ring => {
                        return ring.map(tuple => {
                            return CoordinatesUtils.reproject(tuple, srccrs, dstcrs);
                        });
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
    wktToGeoJSON(wkt, srccrs, dstcrs, id = uuid.v1()) {
        wkt = wkt
            .replace(/Point(\w+)/i, "Point $1")
            .replace(/LineString(\w+)/i, "LineString $1")
            .replace(/Polygon(\w+)/i, "Polygon $1")
            .replace(/MultiSurface(\w*)/i, "GeometryCollection $1");
        try {
            const feature = new ol.format.WKT().readFeature(wkt, {
                dataProjection: srccrs,
                featureProjection: dstcrs
            });
            const featureObj = new ol.format.GeoJSON().writeFeatureObject(feature);
            featureObj.id = id;
            return featureObj;
        } catch (e) {
            console.warn("Failed to parse geometry: " + wkt);
            return null;
        }
    },
    kmlToGeoJSON(kml) {
        const kmlFormat = new ol.format.KML({defaultStyle: [new ol.style.Style()]});
        const geojsonFormat = new ol.format.GeoJSON();
        const features = [];
        let fid = 0;
        for (const olFeature of kmlFormat.readFeatures(kml)) {
            let style = olFeature.getStyleFunction()(olFeature);
            style = style[0] || style;

            const styleOptions = {
                strokeColor: style.getStroke() ? style.getStroke().getColor() : '#000000',
                strokeWidth: style.getStroke() ? style.getStroke().getWidth() : 1,
                strokeDash: style.getStroke() ? style.getStroke().getLineDash() : [],
                fillColor: style.getFill() ? style.getFill().getColor() : '#FFFFFF',
                textFill: style.getText() && style.getText().getFill() ? style.getText().getFill().getColor() : 'rgba(0, 0, 0 ,0)',
                textStroke: style.getText() && style.getText().getStroke() ? style.getText().getStroke().getColor() : 'rgba(0, 0, 0, 0)'
            };
            if (style.getImage() && style.getImage() !== getDefaultImageStyle() && style.getImage().getSrc()) {
                // FIXME: Uses private members of ol.style.Icon, style.getImage().getAnchor() returns null because style.getImage.getSize() is null because the the image is not yet loaded
                const anchor = style.getImage().anchor_ || [0.5, 0.5];
                const anchorOrigin = (style.getImage().anchorOrigin_ || "").split("-");
                if (anchorOrigin.includes("right")) {
                    anchor[0] = 1 - anchor[0];
                }
                if (anchorOrigin.includes("bottom")) {
                    anchor[1] = 1 - anchor[1];
                }
                styleOptions.iconSrc = style.getImage().getSrc();
                styleOptions.iconAnchor = anchor;
            }
            const feature = geojsonFormat.writeFeatureObject(olFeature);
            Object.assign(feature, {
                styleName: styleOptions.iconSrc ? 'marker' : 'default',
                styleOptions: styleOptions,
                id: fid++,
                crs: "EPSG:4326",
                properties: {}
            });
            const properties = olFeature.getProperties();
            const excludedProperties = ['visibility', olFeature.getGeometryName()];
            for (const key of Object.keys(properties)) {
                if (!excludedProperties.includes(key)) {
                    feature.properties[key] = properties[key];
                }
            }
            if (properties.name && feature.styleName === 'marker') {
                feature.properties.label = properties.name;
            }
            features.push(feature);
        }
        return features;
    },
    computeFeaturesBBox(features) {
        return geojsonBbox({
            type: "FeatureCollection",
            features: features.filter(feature => feature.geometry)
        });
    }
};

export default VectorLayerUtils;
