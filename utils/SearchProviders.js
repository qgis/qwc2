/**
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */


import axios from 'axios';
import yaml from 'js-yaml';
import polygonIntersectTest from 'polygon-intersect-test';

import ConfigUtils from './ConfigUtils';
import CoordinatesUtils from './CoordinatesUtils';
import IdentifyUtils from './IdentifyUtils';
import LocaleUtils from './LocaleUtils';

export const SearchResultType = {
    PLACE: 0,
    THEMELAYER: 1,
    THEME: 2,
    EXTERNALLAYER: 3
};

function coordinatesSearch(text, searchParams, callback) {
    const displaycrs = searchParams.displaycrs || "EPSG:4326";
    const matches = text.match(/^\s*([+-]?\d+\.?\d*)[,\s]\s*([+-]?\d+\.?\d*)\s*$/);
    const items = [];
    if (matches && matches.length >= 3) {
        const x = parseFloat(matches[1]);
        const y = parseFloat(matches[2]);
        if (displaycrs !== "EPSG:4326") {
            items.push({
                id: "coord0",
                text: x + ", " + y + " (" + displaycrs + ")",
                x: x,
                y: y,
                crs: displaycrs,
                bbox: [x, y, x, y]
            });
        }
        if (x >= -180 && x <= 180 && y >= -90 && y <= 90) {
            const title = Math.abs(x) + (x >= 0 ? "°E" : "°W") + ", "
                      + Math.abs(y) + (y >= 0 ? "°N" : "°S");
            items.push({
                id: "coord" + items.length,
                text: title,
                x: x,
                y: y,
                crs: "EPSG:4326",
                bbox: [x, y, x, y]
            });
        }
        if (x >= -90 && x <= 90 && y >= -180 && y <= 180 && x !== y) {
            const title = Math.abs(y) + (y >= 0 ? "°E" : "°W") + ", "
                      + Math.abs(x) + (x >= 0 ? "°N" : "°S");
            items.push({
                id: "coord" + items.length,
                text: title,
                x: y,
                y: x,
                crs: "EPSG:4326",
                bbox: [y, x, y, x]
            });
        }
    }
    const results = [];
    if (items.length > 0) {
        results.push(
            {
                id: "coords",
                titlemsgid: "search.coordinates",
                type: SearchResultType.PLACE,
                items: items
            }
        );
    }
    callback({results: results});
}

/** ************************************************************************ **/

class NominatimSearch {
    static TRANSLATIONS = {};

    static search(text, searchParams, callback) {
        const viewboxParams = {};
        if (searchParams.filterBBox) {
            viewboxParams.viewbox = CoordinatesUtils.reprojectBbox(searchParams.filterBBox, searchParams.mapcrs, "EPSG:4326").join(",");
            viewboxParams.bounded = 1;
        }
        axios.get("https://nominatim.openstreetmap.org/search", {params: {
            'q': text,
            'addressdetails': 1,
            'polygon_geojson': 1,
            'limit': 20,
            'format': 'json',
            'accept-language': searchParams.lang,
            ...viewboxParams,
            ...(searchParams.cfgParams || {})
        }}).then(response => {
            const locale = searchParams.lang;
            if (NominatimSearch.TRANSLATIONS[locale] === undefined) {
                NominatimSearch.TRANSLATIONS[locale] = {promise: NominatimSearch.loadLocale(locale)};
                NominatimSearch.TRANSLATIONS[locale].promise.then(() => {
                    NominatimSearch.parseResults(response.data, NominatimSearch.TRANSLATIONS[locale].strings, callback);
                });
            } else if (NominatimSearch.TRANSLATIONS[locale].promise) {
                NominatimSearch.TRANSLATIONS[locale].promise.then(() => {
                    NominatimSearch.parseResults(response.data, NominatimSearch.TRANSLATIONS[locale].strings, callback);
                });
            } else if (NominatimSearch.TRANSLATIONS[locale].strings) {
                NominatimSearch.parseResults(response.data, NominatimSearch.TRANSLATIONS[locale].strings, callback);
            }
        });
    }
    static parseResults(obj, translations, callback) {
        const results = [];
        const groups = {};
        let groupcounter = 0;

        (obj || []).map(entry => {
            if (!(entry.class in groups)) {
                let title = entry.type;
                try {
                    title = translations[entry.class][entry.type] || entry.type;
                } catch (e) {
                    /* pass */
                }
                groups[entry.class] = {
                    id: "nominatimgroup" + (groupcounter++),
                    // capitalize class
                    title: title,
                    type: SearchResultType.PLACE,
                    items: []
                };
                results.push(groups[entry.class]);
            }

            // shorten display_name
            let text = entry.display_name.split(', ').slice(0, 3).join(', ');
            // map label
            const label = text;

            // collect address fields
            const address = [];
            if (entry.address.town) {
                address.push(entry.address.town);
            }
            if (entry.address.city) {
                address.push(entry.address.city);
            }
            if (entry.address.state) {
                address.push(entry.address.state);
            }
            if (entry.address.country) {
                address.push(entry.address.country);
            }
            if (address.length > 0) {
                text += "<br/><i>" + address.join(', ') + "</i>";
            }

            // reorder coords from [miny, maxy, minx, maxx] to [minx, miny, maxx, maxy]
            const b = entry.boundingbox.map(coord => parseFloat(coord));
            const bbox = [b[2], b[0], b[3], b[1]];

            groups[entry.class].items.push({
                id: entry.place_id,
                // shorten display_name
                text: text,
                label: label,
                bbox: bbox,
                geometry: entry.geojson,
                x: 0.5 * (bbox[0] + bbox[2]),
                y: 0.5 * (bbox[1] + bbox[3]),
                crs: "EPSG:4326",
                provider: "nominatim"
            });
        });
        callback({results: results});
    }
    static loadLocale(locale) {
        return new Promise((resolve) => {
            axios.get('https://raw.githubusercontent.com/openstreetmap/openstreetmap-website/master/config/locales/' + locale + '.yml')
                .then(resp2 => {
                    NominatimSearch.TRANSLATIONS[locale] = {strings: NominatimSearch.parseLocale(resp2.data, locale)};
                    resolve(true);
                }).catch(() => {
                    NominatimSearch.TRANSLATIONS[locale] = {
                        promise: axios.get('https://raw.githubusercontent.com/openstreetmap/openstreetmap-website/master/config/locales/' + locale.slice(0, 2) + '.yml')
                            .then(resp3 => {
                                NominatimSearch.TRANSLATIONS[locale] = {strings: NominatimSearch.parseLocale(resp3.data, locale.slice(0, 2))};
                                resolve(true);
                            }).catch(() => {
                                NominatimSearch.TRANSLATIONS[locale] = {strings: {}};
                                resolve(true);
                            })
                    };
                });
        });
    }
    static parseLocale(data, locale) {
        const doc = yaml.load(data, {json: true});
        try {
            return doc[locale].geocoder.search_osm_nominatim.prefix;
        } catch (e) {
            return {};
        }
    }
}

/** ************************************************************************ **/

class QgisSearch {

    static search(text, searchParams, callback) {

        const filter = {...searchParams.cfgParams.expression};
        const values = {TEXT: text};
        const params = {
            SERVICE: 'WMS',
            VERSION: searchParams.theme.version,
            REQUEST: 'GetFeatureInfo',
            CRS: searchParams.theme.mapCrs,
            WIDTH: 100,
            HEIGHT: 100,
            LAYERS: [],
            FILTER: [],
            WITH_MAPTIP: false,
            WITH_GEOMETRY: true,
            feature_count: searchParams.cfgParams.featureCount || 100,
            info_format: 'text/xml'
        };
        Object.keys(filter).forEach(layer => {
            Object.entries(values).forEach(([key, value]) => {
                filter[layer] = filter[layer].replaceAll(`$${key}$`, value.replace("'", "\\'"));
            });
            params.LAYERS.push(layer);
            params.FILTER.push(layer + ":" + filter[layer]);
        });
        params.QUERY_LAYERS = params.LAYERS = params.LAYERS.join(",");
        params.FILTER = params.FILTER.join(";");
        axios.get(searchParams.theme.featureInfoUrl, {params}).then(response => {
            callback(QgisSearch.searchResults(
                IdentifyUtils.parseResponse(response.data, searchParams.theme, 'text/xml', null, searchParams.mapcrs),
                searchParams.cfgParams.title, searchParams.cfgParams.resultTitle
            ));
        }).catch(() => {
            callback({results: []});
        });
    }
    static searchResults(features, title, resultTitle) {
        const results = [];
        Object.entries(features).forEach(([layername, layerfeatures]) => {
            const items = layerfeatures.map(feature => {
                const values = {
                    ...feature.properties,
                    id: feature.id,
                    layername: layername
                };
                return {
                    id: "qgis." + layername + "." + feature.id,
                    text: resultTitle ? resultTitle.replace(/{([^}]+)}/g, match => values[match.slice(1, -1)]) : feature.displayname,
                    x: 0.5 * (feature.bbox[0] + feature.bbox[2]),
                    y: 0.5 * (feature.bbox[1] + feature.bbox[3]),
                    crs: feature.crs,
                    bbox: feature.bbox,
                    geometry: feature.geometry
                };
            });
            results.push(
                {
                    id: "qgis." + layername,
                    title: title + ": " + layername,
                    type: SearchResultType.PLACE,
                    items: items
                }
            );
        });
        return {results};
    }
    static getResultGeometry(resultItem, callback) {
        callback({geometry: resultItem.geometry, crs: resultItem.crs});
    }
}

/** ************************************************************************ **/

export class FulltextSearch {
    static search(searchText, searchParams, callback) {
        const searchServiceUrl = ConfigUtils.getConfigProp("searchServiceUrl");
        if (!searchServiceUrl) {
            /* eslint-disable-next-line */
            console.warn("Fulltext search failed: searchServiceUrl not set");
            callback({results: []});
        }
        // Compute search filter
        const searchFilter = new Set([...searchParams.cfgParams.default || [], ...searchParams.searchTerms]);
        const facetMap = searchParams.cfgParams.layers;
        searchParams.activeLayers.forEach(layername => {
            if (facetMap[layername]) {
                searchFilter.add(facetMap[layername]);
            }
        });
        const params = {
            searchtext: searchText,
            filter: [...searchFilter].join(","),
            limit: searchParams.limit
        };
        const iconPath = ConfigUtils.getAssetsPath() + '/img/search/';
        axios.get(searchServiceUrl, {params}).then(response => {
            const data = FulltextSearch.filterFulltextResults(response.data, searchParams.filterPoly, searchParams.mapcrs);
            const placeResultCount = (data.result_counts || []).reduce((res, entry) => res + (entry.dataproduct_id !== 'dataproduct' ? (entry.count || 0) : 0), 0);
            const results = [];
            // Layers
            const formatLayerEntry = (dataproduct => ({
                type: SearchResultType.THEMELAYER,
                id: dataproduct.dataproduct_id,
                text: dataproduct.display,
                thumbnail: iconPath + "dataproduct.svg",
                info: dataproduct.dset_info,
                sublayers: dataproduct.sublayers ? dataproduct.sublayers.map(formatLayerEntry) : null
            }));
            results.push({
                id: "fulltext.layers",
                titlemsgid: LocaleUtils.trmsg("search.layers"),
                type: SearchResultType.THEMELAYER,
                items: data.results.filter(entry => entry.dataproduct).map(entry => formatLayerEntry(entry.dataproduct))
            });
            // Places
            results.push({
                id: "fulltext.places",
                titlemsgid: LocaleUtils.trmsg("search.places"),
                resultCount: placeResultCount,
                type: SearchResultType.PLACE,
                items: data.results.filter(entry => entry.feature).map(entry => ({
                    id: entry.feature.feature_id,
                    text: entry.feature.display,
                    x: 0.5 * (entry.feature.bbox[0] + entry.feature.bbox[2]),
                    y: 0.5 * (entry.feature.bbox[1] + entry.feature.bbox[3]),
                    crs: entry.feature.srid,
                    bbox: entry.feature.bbox,
                    thumbnail: iconPath + entry.feature.dataproduct_id + ".svg",
                    // fulltext specific info
                    dataproduct_id: entry.feature.dataproduct_id,
                    id_field_name: entry.feature.id_field_name
                }))
            });
            callback({results: results, result_counts: data.result_counts});
        }).catch(e => {
            // eslint-disable-next-line
            console.warn("Fulltext search failed: " + e);
            callback({results: []});
        });
    }
    static filterFulltextResults(data, filterPoly, mapCrs) {
        if (!filterPoly) {
            return data;
        }
        data.results = data.results.filter(result => {
            if (!result.feature || !result.feature.bbox) {
                return true;
            }
            const [xmin, ymin, xmax, ymax] = CoordinatesUtils.reprojectBbox(result.feature.bbox, "EPSG:" + result.feature.srid, mapCrs);
            const intersects = polygonIntersectTest([[xmin, ymin], [xmax, ymin], [xmax, ymax], [xmin, ymax], [xmin, ymin]], filterPoly);
            if (!intersects) {
                data.result_counts.find(entry => entry.dataproduct_id === result.feature.dataproduct_id).count -= 1;
            }
            return intersects;
        });
        return data;
    }
    static getResultGeometry(resultItem, callback) {
        const dataServiceUrl = ConfigUtils.getConfigProp("searchDataServiceUrl") || ConfigUtils.getConfigProp("dataServiceUrl");
        if (!dataServiceUrl) {
            callback(null);
        }
        // URL example: /api/data/v1/ch.so.afu.fliessgewaesser.netz/?filter=[["gewissnr","=",1179]]
        const quot = typeof(resultItem.id) === 'string' ? '"' : '';
        const filter = `[["${resultItem.id_field_name}","=", ${quot}${resultItem.id}${quot}]]`;
        axios.get(dataServiceUrl.replace(/\/?$/, "/") + resultItem.dataproduct_id + "/?filter=" + filter).then(response => {
            callback({feature: response.data, crs: response.data.crs.properties.name});
        }).catch(() => {
            callback(null);
        });
    }
    static getLayerDefinition(resultItem, callback) {
        const dataProductServiceUrl = ConfigUtils.getConfigProp("dataproductServiceUrl");
        if (!dataProductServiceUrl) {
            /* eslint-disable-next-line */
            console.warn("Fulltext search: failed to get layer definition, dataproductServiceUrl is not defined");
            callback(null);
        }
        const params = {
            filter: resultItem.id
        };
        axios.get(dataProductServiceUrl.replace(/\/?$/, "/") + "weblayers", {params}).then(response => {
            callback(response.data[resultItem.id]?.[0]);
        }).catch(() => {
            callback(null);
        });
    }
    static handleHighlightParameters(hp, hf, st, callback) {
        const searchServiceUrl = ConfigUtils.getConfigProp("searchServiceUrl");
        const dataServiceUrl = ConfigUtils.getConfigProp("searchDataServiceUrl") || ConfigUtils.getConfigProp("dataServiceUrl");
        if (!searchServiceUrl || !dataServiceUrl) {
            return;
        }
        const queryFeature = (filter) => {
            axios.get(dataServiceUrl.replace(/\/?$/, "/") + hp + "/?filter=" + filter).then(response => {
                const bbox = response.data.bbox;
                const item = {
                    x: 0.5 * [bbox[0] + bbox[2]],
                    y: 0.5 * [bbox[1] + bbox[3]],
                    label: st,
                    crs: response.data.crs.properties.name,
                    bbox: bbox
                };
                callback(item, {feature: response.data, crs: response.data.crs.properties.name});
            }).catch(() => {});
        };
        if (hp && hf) {
            queryFeature(hf);
        } else if (hp && st) {
            const params = {
                searchtext: st,
                filter: hp,
                limit: 1
            };
            axios.get(searchServiceUrl, {params}).then(response => {
                if (response.data.results && response.data.results.length === 1) {
                    const result = response.data.results[0].feature;
                    const quot = typeof(result.feature_id) === 'string' ? '"' : '';
                    const filter = `[["${result.id_field_name}","=", ${quot}${result.feature_id}${quot}]]`;
                    queryFeature(filter);
                }
            }).catch(() => {});
        }
    }
}

export default {
    coordinates: {
        labelmsgid: "search.coordinates",
        onSearch: coordinatesSearch,
        handlesGeomFilter: false
    },
    nominatim: {
        label: "OpenStreetMap",
        onSearch: NominatimSearch.search,
        handlesGeomFilter: false
    },
    qgis: {
        label: "QGIS",
        onSearch: QgisSearch.search,
        getResultGeometry: QgisSearch.getResultGeometry,
        handlesGeomFilter: false
    },
    fulltext: {
        label: "Fulltext",
        onSearch: FulltextSearch.search,
        getResultGeometry: FulltextSearch.getResultGeometry,
        getLayerDefinition: FulltextSearch.getLayerDefinition,
        handlesGeomFilter: true
    }
};
