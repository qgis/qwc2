/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const UrlParams = require("../utils/UrlParams");
const {addLayer,removeLayer} = require("../../MapStore2/web/client/actions/layers");
const {changeMapScales, zoomToExtent, zoomToPoint} = require("../../MapStore2/web/client/actions/map");

const SET_CURRENT_THEME = 'SET_CURRENT_THEME';
const SET_THEME_SWITCHER_FILTER = 'SET_THEME_FILTER';

function setCurrentTheme(theme, layer, backgroundLayers, prevlayerid, prevBackgroundLayerIds, scales, zoomExtent, centerZoom) {
    UrlParams.updateParams({t: theme.id, l: undefined, bl: undefined});
    return (dispatch) => {
        // remove previous layers
        for (let backgroundLayerId of prevBackgroundLayerIds) {
            dispatch(removeLayer(backgroundLayerId));
        }
        if(prevlayerid) {
            dispatch(removeLayer(prevlayerid));
        }

        // add theme layers
        for (let backgroundLayer of backgroundLayers) {
            if (backgroundLayer.visibility) {
                UrlParams.updateParams({bl: backgroundLayer.name});
            }
            dispatch(addLayer(backgroundLayer));
        }
        dispatch(addLayer(layer));

        // update map scales
        const p = new Promise((resolve) => {
            resolve(dispatch(changeMapScales(scales)));
        });
        p.then(() => {
            // zoom to extent only after new scales have been set
            if(centerZoom) {
                dispatch(zoomToPoint(centerZoom.center, centerZoom.zoom, centerZoom.crs));
            } else {
                dispatch(zoomToExtent(zoomExtent.bounds, zoomExtent.crs));
            }
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
