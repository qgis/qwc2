/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {addLayer,removeLayer,removeAllLayers} = require("./layers");
const ConfigUtils = require("../../MapStore2Components/utils/ConfigUtils");
const {changeMapScales, zoomToExtent, zoomToPoint, changeMapCrs} = require("../../MapStore2Components/actions/map");

const SET_CURRENT_THEME = 'SET_CURRENT_THEME';

function setCurrentTheme(theme, layer, backgroundLayers, zoomExtent, centerZoom) {
    return (dispatch, getState) => {
        if(ConfigUtils.getConfigProp("preserveNonThemeLayersOnThemeSwitch") === true) {
            let removeLayers = [];
            for(let layer of getState().layers.flat || []) {
                if(layer.group === "background" || layer.isThemeLayer) {
                    removeLayers.push(layer.id);
                }
            }
            for(let layerId of removeLayers) {
                dispatch(removeLayer(layerId));
            }
        } else {
            dispatch(removeAllLayers());
        }

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

module.exports = {
    SET_CURRENT_THEME,
    setCurrentTheme
};
