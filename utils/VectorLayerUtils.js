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
            ensureHex = (rgb) => (!Array.isArray(rgb) ? rgb : '#' + [255 - (rgb.length > 3 ? rgb[3] : 1) * 255, ...rgb.slice(0, 3)].map(v => v.toString(16).padStart(2, '0')).join(''));
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
                            [x - 0.01, y - 0.01],
                            [x + 0.01, y - 0.01],
                            [x + 0.01, y + 0.01],
                            [x - 0.01, y + 0.01],
                            [x - 0.01, y - 0.01]
                        ]]
                    };
                    params.geoms.push(VectorLayerUtils.geoJSONGeomToWkt(geometry, printCrs === "EPSG:4326" ? 4 : 2));
                    params.labelFillColors.push(ensureHex(feature.styleOptions.fillColor));
                    params.labelOultineColors.push(ensureHex(feature.styleOptions.strokeColor));
                    params.labelOutlineSizes.push(scaleFactor * feature.styleOptions.strokeWidth * 0.5);
                    params.labelSizes.push(Math.round(10 * feature.styleOptions.strokeWidth * scaleFactor));
                } else {
                    params.geoms.push(VectorLayerUtils.geoJSONGeomToWkt(geometry, printCrs === "EPSG:4326" ? 4 : 2));
                    params.labelFillColors.push(defaultFeatureStyle.textFill);
                    params.labelOultineColors.push(defaultFeatureStyle.textStroke);
                    params.labelOutlineSizes.push(scaleFactor);
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
        if (geometrytype.endsWith("Point")) {
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
        } else if (geometrytype.endsWith("LineString")) {
            rule = '<se:LineSymbolizer>' +
                   stroke +
                   '</se:LineSymbolizer>';
        } else if (geometrytype.endsWith("Polygon")) {
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
        if (srccrs === dstcrs || !srccrs || !dstcrs) {
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
    geoJSONGeomToWkt(gj, precision = 4) {
        if (gj.type === 'Feature') {
            gj = gj.geometry;
        }

        const wrapParens = (s) =>  { return '(' + s + ')'; };
        const pairWKT = (c) => { return c.map(x => x.toFixed(precision)).join(' '); };
        const ringWKT = (r) => { return r.map(pairWKT).join(', '); };
        const ringsWKT = (r) => { return r.map(ringWKT).map(wrapParens).join(', '); };
        const multiRingsWKT = (r) => { return r.map(ringsWKT).map(wrapParens).join(', '); };

        switch (gj.type) {
        case 'Point':
            return 'POINT (' + pairWKT(gj.coordinates) + ')';
        case 'LineString':
            return 'LINESTRING (' + ringWKT(gj.coordinates) + ')';
        case 'Polygon':
            return 'POLYGON (' + ringsWKT(gj.coordinates) + ')';
        case 'MultiPoint':
            return 'MULTIPOINT (' + ringWKT(gj.coordinates) + ')';
        case 'MultiPolygon':
            return 'MULTIPOLYGON (' + multiRingsWKT(gj.coordinates) + ')';
        case 'MultiLineString':
            return 'MULTILINESTRING (' + ringsWKT(gj.coordinates) + ')';
        case 'GeometryCollection':
            return 'GEOMETRYCOLLECTION (' + gj.geometries.map(
                function (x) { return VectorLayerUtils.geoJSONGeomToWkt(x, precision); }
            ).join(', ') + ')';
        default:
            throw new Error('Invalid geometry object');
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
                strokeColor: style.getStroke() ? style.getStroke().getColor() : [0, 0, 0, 1],
                strokeWidth: style.getStroke() ? style.getStroke().getWidth() : 1,
                strokeDash: style.getStroke() ? style.getStroke().getLineDash() : [],
                fillColor: style.getFill() ? style.getFill().getColor() : [255, 255, 255, 1],
                textFill: style.getText() && style.getText().getFill() ? style.getText().getFill().getColor() : [0, 0, 0, 1],
                textStroke: style.getText() && style.getText().getStroke() ? style.getText().getStroke().getColor() : [255, 255, 255, 1]
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
    convert3dto2d(entry) {
        if (!Array.isArray(entry)) {
            return entry;
        } else if (entry.length >= 3 && !Array.isArray(entry[0])) {
            return [entry[0], entry[1]];
        } else if (Array.isArray(entry[0])) {
            return entry.map(VectorLayerUtils.convert3dto2d);
        }
        return entry;
    },
    computeFeaturesBBox(features) {
        const featureCrs = new Set();
        features.forEach(feature => {
            if (feature.crs) {
                featureCrs.add(feature.crs);
            }
        });
        const bboxCrs = featureCrs.size === 1 ? [...featureCrs.keys()][0] : "EPSG:4326";
        let bounds = geojsonBbox({
            type: "FeatureCollection",
            features: features.filter(feature => feature.geometry).map(feature => ({
                ...feature,
                geometry: feature.crs ? VectorLayerUtils.reprojectGeometry(feature.geometry, feature.crs, bboxCrs) : feature.geometry
            }))
        });
        // Discard z component
        if (bounds.length === 6) {
            bounds = [bounds[0], bounds[1], bounds[3], bounds[4]];
        }
        return {
            crs: bboxCrs,
            bounds: bounds
        };
    },
    computeFeatureBBox(feature) {
        let bounds = geojsonBbox(feature);
        // Discard z component
        if (bounds.length === 6) {
            bounds = [bounds[0], bounds[1], bounds[3], bounds[4]];
        }
        return bounds;
    },
    getFeatureCenter(feature) {
        const geojson = new ol.format.GeoJSON().readFeature(feature);
        const geometry = geojson.getGeometry();
        const type = geometry.getType();
        let center = null;
        switch (type) {
        case "Polygon":
            center = geometry.getInteriorPoint().getCoordinates();
            break;
        case "MultiPolygon":
            center = geometry.getInteriorPoints().getClosestPoint(ol.extent.getCenter(geometry.getExtent()));
            break;
        case "Point":
            center = geometry.getCoordinates();
            break;
        case "MultiPoint":
            center = geometry.getClosestPoint(ol.extent.getCenter(geometry.getExtent()));
            break;
        case "LineString":
            center = geometry.getCoordinateAt(0.5);
            break;
        case "MultiLineString":
            center = geometry.getClosestPoint(ol.extent.getCenter(geometry.getExtent()));
            break;
        case "Circle":
            center = geometry.getCenter();
            break;
        default:
            break;
        }
        return center;
    }
};

export default VectorLayerUtils;
