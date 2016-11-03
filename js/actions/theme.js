/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const UrlParams = require("../utils/UrlParams");
const {addLayer,removeLayer} = require("../../MapStore2/web/client/actions/layers");

const SET_CURRENT_THEME = 'SET_CURRENT_THEME';
const SET_THEME_SWITCHER_FILTER = 'SET_THEME_FILTER';
const SET_THEME_SWITCHER_VISIBILITY = 'SET_THEME_SWITCHER_VISIBILITY';

function setCurrentTheme(theme, layer, backgroundLayers, prevlayerid, prevBackgroundLayerIds) {
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

        dispatch({
            type: SET_CURRENT_THEME,
            theme: theme,
            layer: layer.id
        });
    }
}

function setThemeSwitcherFilter(filter) {
    return {
        type: SET_THEME_SWITCHER_FILTER,
        filter: filter
    };
}

function setThemeSwitcherVisibility(visible)
{
    return {
        type: SET_THEME_SWITCHER_VISIBILITY,
        visible: visible
    }
}

module.exports = {
    SET_CURRENT_THEME,
    SET_THEME_SWITCHER_FILTER,
    SET_THEME_SWITCHER_VISIBILITY,
    setCurrentTheme,
    setThemeSwitcherFilter,
    setThemeSwitcherVisibility
}
