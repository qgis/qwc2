/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {connect} = require('react-redux');
const {createSelector} = require('reselect');
const {changeMapView} = require('../../MapStore2/web/client/actions/map');
const {resultsPurge, addMarker} = require("../../MapStore2/web/client/actions/search");
const {mapSelector} = require('../../MapStore2/web/client/selectors/map');

// SEARCH RESULTS
const resultListSelector = createSelector([
    mapSelector,
    (state) => state.search || null
], (mapConfig, searchState) => ({
    mapConfig,
    results: searchState ? searchState.results : null
}));

const SearchResultList = connect(resultListSelector, {
    onItemClick: changeMapView,
    addMarker: addMarker,
    afterItemClick: resultsPurge
})(require('../../MapStore2/web/client/components/mapcontrols/search/geocoding/NominatimResultList'));

module.exports = {
    SearchResultListPlugin: SearchResultList,
    reducers: {
        search: require('../../MapStore2/web/client/reducers/search')
    }
};
