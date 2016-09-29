/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {connect} = require('react-redux');
const SearchBar = require("../../MapStore2/web/client/components/mapcontrols/search/SearchBar");
const {resultsPurge, resetSearch, searchTextChanged} = require("../../MapStore2/web/client/actions/search");
const {qwc2TextSearch} = require("../actions/search");
require("./style/SearchBar.css");

const selector = (state) => ({
     searchText: state && state.search ? state.search.searchText : ""
 });

module.exports = {
    SearchBar: connect(selector, {
        onSearch: qwc2TextSearch,
        onPurgeResults: resultsPurge,
        onSearchReset: resetSearch,
        onSearchTextChange: searchTextChanged
    })(SearchBar)
};
