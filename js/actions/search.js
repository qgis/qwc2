/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {TEXT_SEARCH_RESULTS_LOADED} = require("../../MapStore2/web/client/actions/search");
const ConfigUtils = require("../../MapStore2/web/client/utils/ConfigUtils");
const CoordinatesUtils = require('../../MapStore2/web/client/utils/CoordinatesUtils');
const UrlParams = require("../utils/UrlParams");

function geoAdminLocationSearch(text) {
    UrlParams.updateParams({s: text});
    return (dispatch) => {
        fetch("http://api3.geo.admin.ch/rest/services/api/SearchServer?searchText="+ encodeURIComponent(text) + "&type=locations&limit=20")
        .then(response => response.json())
        .then(result => dispatch(geoAdminLocationSearchResults(result)));
    }
}

function parseItemBBox(bboxstr) {
    if(bboxstr === undefined) {
        return null;
    }
    let matches = bboxstr.match(/^BOX\s*\(\s*(\d+\.?\d*)\s*(\d+\.?\d*)\s*,\s*(\d+\.?\d*)\s*(\d+\.?\d*)\s*\)$/);
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
        results: results
    };
}

module.exports = {geoAdminLocationSearch};
