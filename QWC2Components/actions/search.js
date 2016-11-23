/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const axios = require('axios');
const {TEXT_SEARCH_RESULTS_LOADED, resultsPurge} = require("../../MapStore2/web/client/actions/search");
const ConfigUtils = require("../../MapStore2/web/client/utils/ConfigUtils");
const CoordinatesUtils = require('../../MapStore2/web/client/utils/CoordinatesUtils');
const UrlParams = require("../utils/UrlParams");

function startSearch(text, searchOptions, searchProviders) {
    UrlParams.updateParams({s: text});
    return (dispatch) => {
        dispatch(resultsPurge());
        coordinatesSearch(text, searchOptions.displaycrs || "EPSG:4326", dispatch);
        geoAdminLocationSearch(text, dispatch);
    }
}

function coordinatesSearch(text, displaycrs, dispatch) {
    let matches = text.match(/^\s*(\d+\.?\d*),?\s*(\d+\.?\d*)\s*$/);
    if(matches && matches.length >= 3) {
        let x = parseFloat(matches[1]);
        let y = parseFloat(matches[2]);
        let items = [];
        if(displaycrs !== "EPSG:4326") {
            let coord = CoordinatesUtils.reproject([x, y], displaycrs, "EPSG:4326");
            items.push({
                id: "coord0",
                text: x + ", " + y + " (" + displaycrs + ")",
                x: coord.x,
                y: coord.y,
                crs: "EPSG:4326",
                bbox: [x, y, x, y]
            });
        }
        if(x >= -180 && x <= 180 && y >= -90 && y <= 90) {
            let title = Math.abs(x) + (x >= 0 ? "°E" : "°W") + ", "
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
        if(x >= -90 && x <= 90 && y >= -180 && y <= 180 && x != y) {
            let title = Math.abs(y) + (y >= 0 ? "°E" : "°W") + ", "
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
        dispatch({
                type: TEXT_SEARCH_RESULTS_LOADED,
                results: [{
                    id: "coords",
                    title: "search.coordinates",
                    items: items
                }],
                append: true
        })
    }
}

function geoAdminLocationSearch(text, dispatch) {
    axios.get("http://api3.geo.admin.ch/rest/services/api/SearchServer?searchText="+ encodeURIComponent(text) + "&type=locations&limit=20")
    .then(response => dispatch(geoAdminLocationSearchResults(response.data)));
}

function parseItemBBox(bboxstr) {
    if(bboxstr === undefined) {
        return null;
    }
    let matches = bboxstr.match(/^BOX\s*\(\s*(\d+\.?\d*)\s*(\d+\.?\d*)\s*,\s*(\d+\.?\d*)\s*(\d+\.?\d*)\s*\)$/);
    if(matches && matches.length < 5) {
        return null;
    }
    let xmin = parseFloat(matches[1]);
    let ymin = parseFloat(matches[2]);
    let xmax = parseFloat(matches[3]);
    let ymax = parseFloat(matches[4]);
    return CoordinatesUtils.reprojectBbox([xmin, ymin, xmax, ymax], "EPSG:21781", "EPSG:4326");
}

function geoAdminLocationSearchResults(obj)
{
    let resultGroups = {};
    (obj.results || []).map(entry => {
        if(resultGroups[entry.attrs.origin] == undefined) {
            resultGroups[entry.attrs.origin] = {
                id: entry.attrs.origin,
                title: "search.geoadmin." + entry.attrs.origin,
                items: []
            }
        }
        resultGroups[entry.attrs.origin] .items.push({
            id: entry.id,
            text: entry.attrs.label,
            x: entry.attrs.lon,
            y: entry.attrs.lat,
            crs: "EPSG:4326",
            bbox: parseItemBBox(entry.attrs.geom_st_box2d)
        });
    });
    let results = [];
    for(let key in resultGroups) {
        results.push(resultGroups[key]);
    }
    return {
        type: TEXT_SEARCH_RESULTS_LOADED,
        results: results,
        append: true
    };
}

module.exports = {startSearch};
