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
const {changeMapView} = require('../actions/map');
const mapUtils = require('../../MapStore2/web/client/utils/MapUtils');
const CoordinatesUtils = require('../../MapStore2/web/client/utils/CoordinatesUtils');
const {addLayer, removeLayer} = require('../../MapStore2/web/client/actions/layers');
const {startSearch,searchMore} = require("../actions/search");
const IdentifyUtils = require('../utils/IdentifyUtils');
require('./style/Search.css');

const Search = React.createClass({
    propTypes: {
        searchText: React.PropTypes.string,
        results: React.PropTypes.array,
        mapConfig: React.PropTypes.object,
        displaycrs: React.PropTypes.string,
        onSearch: React.PropTypes.func,
        searchMore: React.PropTypes.func,
        onPurgeResults: React.PropTypes.func,
        onSearchReset: React.PropTypes.func,
        onSearchTextChange: React.PropTypes.func,
        panToResult: React.PropTypes.func,
        addMarker: React.PropTypes.func,
        searchProviders: React.PropTypes.object,
        addLayer: React.PropTypes.func,
        removeLayer: React.PropTypes.func,
        theme: React.PropTypes.object
    },
    getDefaultProps() {
        return {
            searchText: "",
            results: [],
            mapConfig: undefined
        }
    },
    getInitialState() {
        return {currentResult: null}
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
        return (
            <div id="Search">
                <SearchBar
                    searchText={this.props.searchText}
                    onSearch={this.onSearch}
                    onPurgeResults={this.props.onPurgeResults}
                    onSearchReset={this.resetSearch}
                    onSearchTextChange={this.props.onSearchTextChange}
                    delay={500}
                    searchOptions={{displaycrs: this.props.displaycrs}} />
                {this.renderSearchResults()}
            </div>
        )
    },
    renderCategory(category) {
        return (
            <li key={category.id}>
                <span className="search-results-category-title">{category.title}</span>
                <ul>{category.items.map(item => this.renderItem(item))}</ul>
            </li>
        )
    },
    renderItem(item) {
        if(item.more) {
            return (
                <li key={item.id} onClick={() => this.props.searchMore(item, this.props.searchText, this.props.searchProviders, this.props.theme.searchProviders)}><i><Message msgId="search.more" /></i></li>
            );
        }
        return (
            <li key={item.id} title={item.text} onClick={() => this.itemClicked(item)} dangerouslySetInnerHTML={{__html: item.text}}></li>
        );
    },
    itemClicked(item) {
        this.props.removeLayer("searchselection");
        let wgscenterlatlon = CoordinatesUtils.reproject(item, item.crs, "EPSG:4326");
        let wgsextent = CoordinatesUtils.reprojectBbox(item.bbox, item.crs, "EPSG:4326");
        this.props.addMarker({lat: wgscenterlatlon.y, lng: wgscenterlatlon.x});
        if(this.props.mapConfig !== undefined) {
            let newZoom = mapUtils.getZoomForExtent(CoordinatesUtils.reprojectBbox(item.bbox, item.crs, this.props.mapConfig.projection), this.props.mapConfig.size, 0, 21, null);
            this.props.panToResult(
                {x: wgscenterlatlon.x, y: wgscenterlatlon.y, crs: "EPSG:4326"},
                newZoom,
                {
                    bounds: {
                        minx: wgsextent[0],
                        miny: wgsextent[1],
                        maxx: wgsextent[2],
                        maxy: wgsextent[3]
                    },
                    crs: item.crs,
                    rotation: 0
                },
                this.props.mapConfig.size,
                null,
                this.props.mapConfig.projection);
        }
        if(item.provider && this.props.searchProviders[item.provider].getResultGeometry) {
            this.props.searchProviders[item.provider].getResultGeometry(item, this.showFeatureGeometry);
        }
        this.setState({currentResult: item});
    },
    showFeatureGeometry(item, geometry, crs) {
        if(item !== this.state.currentResult) {
            return;
        }
        let layer = {
            id: "searchselection",
            name: "Search selection",
            title: "Selection",
            type: "vector",
            features: [IdentifyUtils.wktToGeoJSON(geometry)],
            featuresCrs: crs,
            visibility: true
        };
        this.props.addLayer(layer, true);
    },
    onSearch(text, searchOptions) {
        this.props.onSearch(text, searchOptions, this.props.searchProviders, this.props.theme.searchProviders);
    },
    resetSearch() {
        this.setState({currentResult: null});
        this.props.onSearchReset();
        this.props.removeLayer("searchselection");
    }
});

const selector = (state) => ({
    searchText: state.search ? state.search.searchText : "",
    results: state.search ? state.search.results : null,
    mapConfig: state.map ? state.map.present : undefined,
    displaycrs: state.mousePosition ? state.mousePosition.crs : "EPSG:4326",
    theme: state.theme ? state.theme.current : null
});

module.exports = {
    Search: connect(selector, {
        onSearch: startSearch,
        searchMore: searchMore,
        onPurgeResults: resultsPurge,
        onSearchReset: resetSearch,
        onSearchTextChange: searchTextChanged,
        panToResult: changeMapView,
        addMarker: addMarker,
        addLayer: addLayer,
        removeLayer: removeLayer
    })(Search)
};
