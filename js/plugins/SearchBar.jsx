/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {connect} = require('react-redux');
const assign = require('object-assign');

// TODO
const {textSearch, resultsPurge, resetSearch, addMarker, searchTextChanged} = require("../../MapStore2/web/client/actions/search");

 const SearchBar = connect(() => ({}), {
     onSearch: textSearch,
     onPurgeResults: resultsPurge,
     onSearchReset: resetSearch,
     onSearchTextChange: searchTextChanged
 })(require("../../MapStore2/web/client/components/mapcontrols/search/SearchBar"));

 module.exports = {
     SearchBarPlugin: assign(SearchBar, {
         OmniBar: {
             name: 'search',
             position: 1,
             tool: true,
             priority: 1
         }
     }),
     reducers: {
         search: require('../../MapStore2/web/client/reducers/search')
     }
 };
