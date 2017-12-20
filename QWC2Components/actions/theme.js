/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {addLayer,removeAllLayers} = require("./layers");
const {changeMapScales, zoomToExtent, zoomToPoint, changeMapCrs} = require("../../MapStore2Components/actions/map");

const SET_CURRENT_THEME = 'SET_CURRENT_THEME';
const SET_THEME_SWITCHER_FILTER = 'SET_THEME_FILTER';

function setCurrentTheme(theme, layer, backgroundLayers, zoomExtent, centerZoom) {
    return (dispatch) => {
        dispatch(removeAllLayers());

        // add theme layers
        let activebglayer = undefined;
        for (let backgroundLayer of backgroundLayers) {
            if (backgroundLayer.visibility) {
                activebglayer = backgroundLayer.name;
            }
            dispatch(addLayer(backgroundLayer));
        }
        dispatch(addLayer(layer));

        // update map crs
        const p1 = new Promise((resolve) => {
            resolve(dispatch(changeMapCrs(theme.mapCrs)));
        });
        p1.then(() => {
            // then update map scales
            const p2 = new Promise((resolve) => {
                resolve(dispatch(changeMapScales(theme.scales)));
            });
            p2.then(() => {
                // then update zoom to extent
                if(centerZoom) {
                    dispatch(zoomToPoint(centerZoom.center, centerZoom.zoom, centerZoom.crs));
                } else {
                    dispatch(zoomToExtent(zoomExtent.bounds, zoomExtent.crs));
                }
            });
        });

        dispatch({
            type: SET_CURRENT_THEME,
            theme: theme,
            layer: layer.id
        });
    };
}

function setThemeSwitcherFilter(filter) {
    return {
        type: SET_THEME_SWITCHER_FILTER,
        filter: filter
    };
}

module.exports = {
    SET_CURRENT_THEME,
    SET_THEME_SWITCHER_FILTER,
    setCurrentTheme,
    setThemeSwitcherFilter
};
