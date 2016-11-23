/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const {connect} = require('react-redux');
const Message = require('../../MapStore2/web/client/components/I18N/Message');
const SearchBar = require('../../MapStore2/web/client/components/mapcontrols/search/SearchBar');
const {resultsPurge, resetSearch, searchTextChanged, addMarker} = require("../../MapStore2/web/client/actions/search");
const {changeMapView} = require('../../MapStore2/web/client/actions/map');
const mapUtils = require('../../MapStore2/web/client/utils/MapUtils');
const CoordinatesUtils = require('../../MapStore2/web/client/utils/CoordinatesUtils');
const {startSearch} = require("../actions/search");
require('./style/Search.css');

const Search = React.createClass({
    propTypes: {
        searchText: React.PropTypes.string,
        results: React.PropTypes.array,
        mapConfig: React.PropTypes.object,
        displaycrs: React.PropTypes.string,
        onSearch: React.PropTypes.func,
        onPurgeResults: React.PropTypes.func,
        onSearchReset: React.PropTypes.func,
        onSearchTextChange: React.PropTypes.func,
        panToResult: React.PropTypes.func,
        addMarker: React.PropTypes.func,
        searchProviders: React.PropTypes.object
    },
    getDefaultProps() {
        return {
            searchText: "",
            results: [],
            mapConfig: undefined
        }
    },
    renderSearchResults() {
        if(!this.props.results || this.props.results.length === 0) {
            return null;
        }
        return (
            <ul className="search-results">
                {this.props.results.map(category => this.renderCategory(category))}
            </ul>
        );
    },
    render() {
        console.log(this.props.searchProviders);
        return (
            <div id="Search">
                <SearchBar
                    searchText={this.props.searchText}
                    onSearch={this.onSearch}
                    onPurgeResults={this.props.onPurgeResults}
                    onSearchReset={this.props.onSearchReset}
                    onSearchTextChange={this.props.onSearchTextChange}
                    delay={500}
                    searchOptions={{displaycrs: this.props.displaycrs}} />
                {this.renderSearchResults()}
            </div>
        )
    },
    renderCategory(category) {
        return (
            <li key={category.key}>
                <span className="search-results-category-title"><Message msgId={category.title}/></span>
                <ul>{category.items.map(item => this.renderItem(item))}</ul>
            </li>
        )
    },
    renderItem(item) {
        return (
            <li key={item.id} title={item.text} onClick={() => this.itemClicked(item.x, item.y, item.crs, item.bbox)} dangerouslySetInnerHTML={{__html: item.text}}></li>
        )
    },
    itemClicked(x, y, crs, bbox) {
        this.props.addMarker({lat: y, lng: x});
        if(this.props.mapConfig !== undefined) {
            let newZoom = mapUtils.getZoomForExtent(CoordinatesUtils.reprojectBbox(bbox, crs, this.props.mapConfig.projection), this.props.mapConfig.size, 0, 21, null);
            this.props.panToResult(
                {x, y, crs},
                newZoom,
                {
                    bounds: {
                        minx: bbox[0],
                        miny: bbox[1],
                        maxx: bbox[2],
                        maxy: bbox[3]
                    },
                    crs: crs,
                    rotation: 0
                },
                this.props.mapConfig.size,
                null,
                this.props.mapConfig.projection);
        }
    },
    onSearch(text, searchOptions) {
        this.props.onSearch(text, searchOptions, this.props.searchProviders);
    }
});

const selector = (state) => ({
    searchText: state.search ? state.search.searchText : "",
    results: state.search ? state.search.results : [],
    mapConfig: state.map ? state.map.present : undefined,
    displaycrs: state.mousePosition ? state.mousePosition.crs : "EPSG:4326"
});

module.exports = {
    Search: connect(selector, {
        onSearch: startSearch,
        onPurgeResults: resultsPurge,
        onSearchReset: resetSearch,
        onSearchTextChange: searchTextChanged,
        panToResult: changeMapView,
        addMarker: addMarker
    })(Search)
};
