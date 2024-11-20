/**
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */


import axios from 'axios';
import yaml from 'js-yaml';

import CoordinatesUtils from './CoordinatesUtils';
import IdentifyUtils from './IdentifyUtils';

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
                    title = translations[entry.class][entry.type];
                } catch (e) {
                    /* pass */
                }
                groups[entry.class] = {
                    id: "nominatimgroup" + (groupcounter++),
                    // capitalize class
                    title: title,
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
    }
};
