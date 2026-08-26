/**
 * Copyright 2017-2026 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import isEmpty from 'lodash.isempty';
import Proj4js from 'proj4';

import ConfigUtils from './ConfigUtils';
import CoordinatesUtils from './CoordinatesUtils';
import {decodeDxf, unescapeDxfUnicode} from './DxfUtils';
import LocaleUtils from './LocaleUtils';
import VectorLayerUtils from './VectorLayerUtils';

// Stroke color for DXF entities without an own color
const DXF_DEFAULT_COLOR = '#1565C0';

const FileImportUtils = {
    /**
     * Imports a local file (KML, KMZ, GeoJSON, zipped Shapefile, GeoPDF, DXF) as a map layer.
     * `options.crs` sets the CRS in which DXF coordinates are interpreted.
     * Returns a promise which resolves when the import completed.
     */
    importFile(file, mapCrs, addLayer, addLayerFeatures, options = {}) {
        const filename = file.name.toLowerCase();
        if (filename.endsWith(".dxf")) {
            return file.arrayBuffer().then(buffer => FileImportUtils.addDXFLayer(file.name, decodeDxf(buffer), options.crs || mapCrs, addLayerFeatures));
        } else if (filename.endsWith(".pdf")) {
            return FileImportUtils.addGeoPDFLayer(file, mapCrs, addLayer);
        } else if (filename.endsWith(".zip")) {
            return FileImportUtils.addSHPLayer(file, mapCrs, addLayerFeatures);
        } else if (filename.endsWith(".kmz")) {
            return FileImportUtils.addKMZLayer(file, addLayerFeatures);
        } else if (filename.endsWith(".kml")) {
            return file.text().then(data => {
                FileImportUtils.addKMLLayer(file.name, data, addLayerFeatures);
            });
        } else if (filename.endsWith(".geojson") || filename.endsWith(".json")) {
            return file.text().then(data => {
                try {
                    FileImportUtils.addGeoJSONLayer(file.name, JSON.parse(data), addLayerFeatures);
                } catch {
                    /* Pass */
                }
            });
        }
        /* eslint-disable-next-line */
        alert(LocaleUtils.tr("importlayer.unsupportedfile"));
        return Promise.resolve();
    },
    addKMLLayer(filename, data, addLayerFeatures) {
        FileImportUtils.addGeoJSONLayer(filename, {features: VectorLayerUtils.kmlToGeoJSON(data)}, addLayerFeatures);
    },
    addKMZLayer: async(file, addLayerFeatures) => {
        const {load} = await import('@loaders.gl/core');
        const {ZipLoader} = await import('@loaders.gl/zip');

        // .kmz must be a zip archive with at least a doc.kml file. The kml is then imported like any other KML file.
        const fileMap = await load(file, ZipLoader);
        for (const fileName in fileMap) {
            if (fileName === "doc.kml") {
                const decoder = new TextDecoder();
                FileImportUtils.addKMLLayer(file.name, decoder.decode(fileMap[fileName]), addLayerFeatures);
                break;
            }
        }
    },
    addGeoJSONLayer(filename, data, addLayerFeatures) {
        if (!data.features && data.type === "Feature") {
            data = {
                type: "FeatureCollection",
                features: [data],
                crs: data.crs
            };
        }
        if (!isEmpty(data.features)) {
            let defaultCrs = "EPSG:4326";
            if (data.crs && data.crs.properties && data.crs.properties.name) {
                // Extract CRS from FeatureCollection crs
                defaultCrs = CoordinatesUtils.fromOgcUrnCrs(data.crs.properties.name);
            }
            const features = data.features.map(feature => {
                let crs = defaultCrs;
                if (feature.crs && feature.crs.properties && feature.crs.properties.name) {
                    crs = CoordinatesUtils.fromOgcUrnCrs(feature.crs.properties.name);
                } else if (typeof feature.crs === "string") {
                    crs = feature.crs;
                }
                if (feature.geometry && feature.geometry.coordinates) {
                    feature.geometry.coordinates = feature.geometry.coordinates.map(VectorLayerUtils.convert3dto2d);
                }
                return {...feature, crs: crs};
            });
            addLayerFeatures({
                name: filename,
                title: filename.replace(/\.[^/.]+$/, ""),
                zoomToExtent: true
            }, features, true);
        } else {
            // eslint-disable-next-line
            alert(LocaleUtils.tr("importlayer.nofeatures"));
        }
    },
    // DXF carries no CRS, the coordinates are taken to be in the passed crs. Entities without a
    // polyline representation (i.e. TEXT/MTEXT) are dropped, splines are approximated.
    addDXFLayer: async(filename, data, crs, addLayerFeatures) => {
        const {Helper} = await import('dxf');
        let polylines = [];
        try {
            polylines = new Helper(data).toPolylines().polylines;
        } catch (e) {
            /* eslint-disable-next-line */
            console.warn(e);
            /* eslint-disable-next-line */
            alert(LocaleUtils.tr("importlayer.dxfparsefailed"));
            return;
        }
        const features = polylines.filter(polyline => (polyline.vertices || []).length >= 2).map((polyline, idx) => {
            // Color 0 means "by layer" in DXF and surfaces as black, which is invisible on dark backgrounds
            const rgb = polyline.rgb || [0, 0, 0];
            const color = rgb.every(v => v === 0) ? DXF_DEFAULT_COLOR : ("#" + rgb.map(v => v.toString(16).padStart(2, "0")).join(""));
            return {
                type: "Feature",
                id: idx,
                crs: crs,
                geometry: {
                    type: "LineString",
                    coordinates: polyline.vertices.map(vertex => [vertex[0], vertex[1]])
                },
                properties: {
                    layer: unescapeDxfUnicode(polyline.layer?.name ?? "")
                },
                styleName: "default",
                styleOptions: {
                    strokeColor: color,
                    strokeWidth: 1,
                    strokeDash: [],
                    fillColor: [0, 0, 0, 0],
                    circleRadius: 0
                }
            };
        });
        if (isEmpty(features)) {
            /* eslint-disable-next-line */
            alert(LocaleUtils.tr("importlayer.nofeatures"));
            return;
        }
        addLayerFeatures({
            name: filename,
            title: filename.replace(/\.[^/.]+$/, ""),
            zoomToExtent: true
        }, features, true);
    },
    addGeoPDFLayer(file, mapCrs, addLayer) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const pdfText = atob(ev.target.result.slice(28));
                /* FIXME: This is a very ugly way to extract PDF objects */
                const GPTS = pdfText.match(/\/GPTS\s+\[([^\]]+)\]/);
                const LPTS = pdfText.match(/\/LPTS\s+\[([^\]]+)\]/);
                const Viewport = pdfText.match(/<<([^>]+\/Type\s+\/Viewport[^>]+)>>/);
                const EPSG = pdfText.match(/\/EPSG\s*(\d+)/);
                if (!GPTS || !LPTS || !Viewport || !EPSG) {
                    /* eslint-disable-next-line */
                    alert(LocaleUtils.tr("importlayer.notgeopdf"));
                    resolve();
                    return;
                }
                const pairs = (res, value, idx, array) => idx % 2 === 0 ? [...res, array.slice(idx, idx + 2)] : res;
                const gpts = GPTS[1].split(/\s+/).filter(Boolean).map(Number).reduce(pairs, []).map(e => e.reverse()); // lat-lon => lon-lat
                const lpts = LPTS[1].split(/\s+/).filter(Boolean).map(Number).reduce(pairs, []);
                const viewport = Viewport[1].match(/\/BBox\s+\[([^\]]+)\]/)[1].split(/\s+/).filter(Boolean).map(Number);
                const epsg = EPSG[1];
                const projDef = Proj4js.defs('EPSG:' + epsg);
                if (!projDef) {
                    /* eslint-disable-next-line */
                    alert(LocaleUtils.tr("importlayer.unknownproj", 'EPSG:' + epsg));
                    resolve();
                    return;
                }
                // Construct geog CS
                const geogCs = {
                    projName: 'longlat',
                    ellps: projDef.ellps,
                    datum_params: projDef.datum_params,
                    no_defs: projDef.no_defs
                };

                // Compute the georeferenced area
                // Note: this is a simplistic implementation, assuming that the frame is rectangular and not skewed
                const getCornerIdx = (x, y) => lpts.findIndex(entry => Math.round(entry[0]) === x && Math.round(entry[1]) === y);
                const idxBL = getCornerIdx(0, 0);
                const idxTR = getCornerIdx(1, 1);

                const computeCorner = (idx) => ({
                    pixel: [
                        viewport[0] * (1 - lpts[idx][0]) + viewport[2] * lpts[idx][0],
                        viewport[1] * (1 - lpts[idx][1]) + viewport[3] * lpts[idx][1]
                    ],
                    // eslint-disable-next-line
                    coo: Proj4js(geogCs, mapCrs, gpts[idx])
                });
                const bl = computeCorner(idxBL);
                const tr = computeCorner(idxTR);
                const geoextent = [bl.coo[0], bl.coo[1], tr.coo[0], tr.coo[1]];
                const imgextent = [bl.pixel[0], bl.pixel[1], tr.pixel[0], tr.pixel[1]];

                import('pdfjs-dist').then(pdfjsLib => {
                    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
                        'pdfjs-dist/build/pdf.worker.min.mjs',
                        import.meta.url
                    ).toString();

                    pdfjsLib.getDocument(ev.target.result).promise.then((pdf) => {
                        pdf.getPage(1).then((page) => {
                            const pageViewport = page.getViewport({scale: 1});
                            const canvas = document.createElement('canvas');
                            canvas.width = imgextent[2] - imgextent[0];
                            canvas.height = imgextent[3] - imgextent[1];
                            const context = canvas.getContext('2d');
                            context.translate(-imgextent[0], -(pageViewport.height - imgextent[3]));
                            page.render({canvasContext: context, viewport: pageViewport}).promise.then(() => {
                                addLayer({
                                    type: "image",
                                    name: file.name,
                                    title: file.name,
                                    url: canvas.toDataURL(),
                                    projection: mapCrs,
                                    imageExtent: geoextent
                                });
                                resolve();
                            });
                        });
                    });
                }).catch(() => {
                    /* eslint-disable-next-line */
                    console.warn("pdfjs import failed");
                    resolve();
                });
            };
            reader.readAsDataURL(file);
        });
    },
    addSHPLayer: async(file, mapCrs, addLayerFeatures) => {
        const {_BrowserFileSystem, load} = await import('@loaders.gl/core');
        const {Proj4Projection} = await import('@math.gl/proj4');
        const {ShapefileLoader} = await import('@loaders.gl/shapefile');
        const {ZipLoader} = await import('@loaders.gl/zip');

        // Import SHP layer from ZIP. Zip must contain all the required files : shp, dbf, shx, prj, cpg
        const mimeTypes = ['application/zip', 'application/zip-compressed', 'application/x-zip-compressed'];
        if (mimeTypes.includes(file.type)) {
            const projections = ConfigUtils.getConfigProp("projections") || [];
            if (projections) {
                Proj4Projection.defineProjectionAliases(projections);
            }
            const fileMap = await load(file, ZipLoader);
            const EXTENSIONS = ['shp', 'shx', 'dbf', 'cpg', 'prj'];
            const files = {};
            // Iterate through all the files in ZIP to get a list of (SHP + sidecar files) by filename
            for (const fileName in fileMap) {
                if (Object.hasOwn(fileMap, fileName)) {
                    const name = fileName.split('.')[0];
                    const ext = fileName.split('.').pop();
                    const fileList = files[name] || [];
                    if (EXTENSIONS.includes(ext)) {
                        // Create Blob and File from arrayBuffer loaded by ZipLoader
                        const blob = new Blob([fileMap[fileName]]);
                        fileList.push(new File([blob], fileName));
                    }
                    files[name] = fileList;
                }
            }
            // Load each SHP with sidecar files as GeoJSON features
            for (const f in files) {
                if (Object.hasOwn(files, f)) {
                    const list = files[f];
                    const fileSystem = new _BrowserFileSystem(list);
                    const fetch = fileSystem.fetch.bind(fileSystem.fetch);
                    const filename = `${f}.shp`;
                    // Load SHP and reproject to mapCrs
                    let data = null;
                    try {
                        data = await load(filename, ShapefileLoader, {
                            fetch,
                            shapefile: {shape: 'geojson-table'},
                            gis: {
                                format: 'geojson', reproject: true, _targetCrs: mapCrs
                            }
                        });
                    } catch {
                        try {
                            data = await load(filename, ShapefileLoader, {
                                fetch,
                                shapefile: {shape: 'geojson-table'},
                                gis: {
                                    format: 'geojson', reproject: false, _targetCrs: mapCrs
                                }
                            });
                            /* eslint-disable-next-line */
                            alert(LocaleUtils.tr("importlayer.shpreprojectionerror"));
                        } catch {
                            data = null;
                        }
                    }
                    if (data) {
                        data.crs = {
                            type: "name",
                            properties: {name: CoordinatesUtils.toOgcUrnCrs(mapCrs)}
                        };
                        // Add data as GeoJSON layer
                        FileImportUtils.addGeoJSONLayer(f, data, addLayerFeatures);
                    }
                }
            }
        }
    }
};

export default FileImportUtils;
