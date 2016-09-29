/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const {connect} = require('react-redux');
const {AppMenu} = require("../components/AppMenu");
const {SearchBar} = require("../components/SearchBar");
const {resultsPurge, resetSearch, searchTextChanged} = require("../../MapStore2/web/client/actions/search");
const {qwc2TextSearch} = require("../actions/search");
require('./style/TopBar.css');

const TopBar = React.createClass({
    propTypes: {
        searchActions: React.PropTypes.shape({
            onSearch: React.PropTypes.func,
            onPurgeResults: React.PropTypes.func,
            onSearchReset: React.PropTypes.func,
            onSearchTextChange: React.PropTypes.func
        }),
        searchText: React.PropTypes.string,
        menuItems: React.PropTypes.array
    },
    getDefaultProps() {
        return {
        }
    },
    render() {
        return (
            <div id="topbar">
                <img className="logo" src="assets/img/logo.svg" />
                <SearchBar {...this.props.searchActions} searchText={this.props.searchText} />
                <AppMenu menuItems={this.props.menuItems} />
            </div>
         );
     }
});

module.exports = {
    TopBarPlugin: TopBar,
    reducers: {
        appmenu: require("../reducers/AppMenu"),
        search: require('../../MapStore2/web/client/reducers/search')
    }
};
