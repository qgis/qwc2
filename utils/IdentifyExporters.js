/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import JSZip from 'jszip';

import CoordinatesUtils from '../utils/CoordinatesUtils';
import {EXCLUDE_ATTRS, EXCLUDE_PROPS} from '../utils/IdentifyUtils';
import MiscUtils from '../utils/MiscUtils';
import VectorLayerUtils from '../utils/VectorLayerUtils';

export const IdentifyExporters = [
    {
        id: 'json',
        title: 'json',
        allowClipboard: true,
        export: (json, callback) => {
            const data = JSON.stringify(json, null, ' ');
            callback({
                data: data, type: "text/plain;charset=utf-8", filename: "results.json"
            });
        }
    }, {
        id: 'geojson',
        title: 'geojson',
        allowClipboard: true,
        export: (json, callback) => {
            const featureCollection = {
                type: "FeatureCollection",
                features: Object.values(json).flat().map(entry => {
                    const feature = MiscUtils.objectOmit(entry, EXCLUDE_PROPS);
                    feature.properties = MiscUtils.objectOmit(feature.properties, EXCLUDE_ATTRS);
                    if (feature.geometry) {
                        feature.geometry = VectorLayerUtils.reprojectGeometry(feature.geometry, entry.crs, 'EPSG:4326');
                    }
                    return feature;
                })
            };
            const data = JSON.stringify(featureCollection, null, ' ');
            callback({
                data: data, type: "application/geo+json;charset=utf-8", filename: "results.json"
            });
        }
    }, {
        id: 'csv',
        title: 'CSV',
        allowClipboard: true,
        export: (json, callback) => {
            const dataset = [];
            Object.entries(json).forEach(([layerId, features]) => {
                features.forEach(feature => {
                    dataset.push([feature.layertitle + ": " + feature.displayname]);
                    Object.entries(feature.properties || {}).forEach(([attrib, value]) => {
                        if (!EXCLUDE_ATTRS.includes(attrib)) {
                            dataset.push(["", attrib, String(value)]);
                        }
                    });
                    if (feature.geometry) {
                        dataset.push(["", "geometry", VectorLayerUtils.geoJSONGeomToWkt(feature.geometry)]);
                    }
                });
            });
            const csv = dataset.map(row => row.map(field => field ? `"${field.replace('"', '""')}"` : "").join("\t")).join("\n");
            callback({
                data: csv, type: "text/plain;charset=utf-8", filename: "results.csv"
            });
        }
    }, {
        id: 'csvzip',
        title: 'CSV+ZIP',
        allowClipboard: false,
        export: (json, callback) => {

            const data = [];
            const filenames = [];
            Object.entries(json).forEach(([layerId, features]) => {
                const exportAttrs = Object.keys(features[0]?.properties ?? {}).filter(attr => !EXCLUDE_ATTRS.includes(attr));
                const dataset = [[...exportAttrs]];
                if (features[0].geometry) {
                    dataset[0].push("geometry");
                }
                features.forEach(feature => {
                    const row = exportAttrs.map(attr => String(feature.properties[attr]));
                    if (feature.geometry) {
                        row.push(VectorLayerUtils.geoJSONGeomToWkt(feature.geometry));
                    }
                    dataset.push(row);
                });
                const csv = dataset.map(row => row.map(field => `"${field.replace('"', '""')}"`).join(";")).join("\n");
                data.push(csv);
                filenames.push(features[0].layername);
            });
            if (data.length > 1) {
                const zip = new JSZip();
                for (let i = 0; i < data.length; i++) {
                    const blob = new Blob([data[i]], {type: "text/csv;charset=utf-8"});
                    zip.file(filenames[i] + ".csv", blob);
                }
                zip.generateAsync({type: "arraybuffer"}).then((result) => {
                    callback({
                        data: result, type: "application/zip", filename: "results.zip"
                    });
                });
            } else {
                callback({
                    data: data[0], type: "text/csv;charset=utf-8", filename: filenames[0] + ".csv"
                });
            }
        }
    }, {
        id: 'shapefile',
        title: 'Shapefile',
        allowClipboard: false,
        export: (json, callback) => {
            import("@mapbox/shp-write").then(shpwriteMod => {
                const shpwrite = shpwriteMod.default;
                const layers = Object.entries(json);
                const options = {
                    outputType: 'arraybuffer',
                    types: {
                        point: 'points',
                        polygon: 'polygons',
                        polyline: 'lines'
                    }
                };
                const usedFoldernames = new Set();
                const promises = layers.map(([layerId, features]) => {
                    const layerName = layerId.split('#')[1];
                    const geojson = {
                        type: "FeatureCollection",
                        features: features.map(feature => MiscUtils.objectOmit(feature, EXCLUDE_PROPS)).map(feature => {
                            // Note: shpw-write does not handle MultiPoint
                            if (feature.geometry?.type === "MultiPoint") {
                                return feature.geometry.coordinates.map((point, idx) => ({
                                    ...feature,
                                    geometry: {
                                        type: 'Point', coordinates: point
                                    },
                                    id: idx === 0 ? feature.id : feature.id + "_" + idx
                                }));
                            } else {
                                return feature;
                            }
                        }).flat()
                    };
                    let folderName = layerName;
                    if (usedFoldernames.has(folderName)) {
                        let i = 0;
                        for (; usedFoldernames.has(folderName + "_" + i); ++i);
                        folderName = folderName + "_" + i;
                    }
                    const layerOptions = {...options, folder: folderName};
                    const crs = features[0]?.crs;
                    if (crs) {
                        const wkt = CoordinatesUtils.getEsriWktFromCrs(crs);
                        if (wkt) {
                            layerOptions.prj = wkt;
                        }
                    }
                    return shpwrite.zip(geojson, layerOptions).then((shpData) => ({
                        layerName,
                        shpData
                    }));
                });
                Promise.all(promises).then((results) => {
                    if (results.length === 1) {
                        callback({
                            data: results[0].shpData,
                            type: "application/zip",
                            filename: results[0].layerName + ".zip"
                        });
                    } else {
                        const zip = new JSZip();
                        results.forEach(({layerName, shpData}) => {
                            zip.file(layerName + ".zip", shpData);
                        });
                        zip.generateAsync({type: "arraybuffer"}).then((result) => {
                            callback({
                                data: result,
                                type: "application/zip",
                                filename: "shapefiles.zip"
                            });
                        });
                    }
                });
            });
        }
    }, {
        id: 'xlsx',
        title: 'XLSX',
        allowClipboard: false,
        export: (json, callback) => {
            import('xlsx').then(xlsx => {

                const document = xlsx.utils.book_new();

                Object.entries(json).forEach(([layerName, features]) => {
                    const exportAttrs = Object.keys(features[0]?.properties ?? {}).filter(attr => !EXCLUDE_ATTRS.includes(attr));
                    const dataset = [[...exportAttrs]];
                    if (features[0].geometry) {
                        dataset[0].push("geometry");
                    }
                    features.forEach(feature => {
                        const row = exportAttrs.map(attr => {
                            const value = feature.properties[attr];
                            return MiscUtils.isNumeric(value) ? Number(value) : value;
                        });
                        if (feature.geometry) {
                            const geomWkt = VectorLayerUtils.geoJSONGeomToWkt(feature.geometry);
                            if (geomWkt.length < 32768) {
                                row.push(geomWkt);
                            } else {
                                row.push("Geometry too large");
                            }
                        }
                        dataset.push(row);
                    });
                    const worksheet = xlsx.utils.aoa_to_sheet(dataset);
                    const sheetName = features[0].layertitle.slice(0, 30).replace(/[\\/?*[]]?/g, '_');
                    xlsx.utils.book_append_sheet(document, worksheet, sheetName);
                });
                const data = xlsx.write(document, {type: "buffer"});
                callback({
                    data: data, type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename: "results.xlsx"
                });
            });
        }
    }
];
