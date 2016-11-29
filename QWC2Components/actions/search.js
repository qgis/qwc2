/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {TEXT_SEARCH_RESULTS_LOADED, resultsPurge} = require("../../MapStore2/web/client/actions/search");
const CoordinatesUtils = require('../../MapStore2/web/client/utils/CoordinatesUtils');
const UrlParams = require("../utils/UrlParams");

function startSearch(text, searchOptions, searchProviders, activeProviders) {
    UrlParams.updateParams({s: text});
    return (dispatch) => {
        dispatch(resultsPurge());
        coordinatesSearch(text, searchOptions.displaycrs || "EPSG:4326", dispatch);
        if(searchProviders) {
            Object.keys(searchProviders).map(provider => {
                if(activeProviders.indexOf(provider) >= 0) {
                    searchProviders[provider].onSearch(text, searchOptions, dispatch)
                }
            });
        }
    }
}

function searchMore(moreItem, text, searchProviders) {
    return (dispatch) => {
        if(moreItem.provider && searchProviders[moreItem.provider].getMoreResults) {
            searchProviders[moreItem.provider].getMoreResults(moreItem, text, dispatch);
        }
    };
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

module.exports = {startSearch, searchMore};
