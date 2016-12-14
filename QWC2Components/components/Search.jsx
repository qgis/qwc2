/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const {connect} = require('react-redux');
const {Input, Glyphicon} = require('react-bootstrap');
const Spinner = require('react-spinkit');
const Message = require('../../MapStore2/web/client/components/I18N/Message');
const {resultsPurge, resetSearch, searchTextChanged, addMarker} = require("../../MapStore2/web/client/actions/search");
const LocaleUtils = require('../../MapStore2/web/client/utils/LocaleUtils');
const mapUtils = require('../../MapStore2/web/client/utils/MapUtils');
const CoordinatesUtils = require('../../MapStore2/web/client/utils/CoordinatesUtils');
const {addLayer, removeLayer} = require('../../MapStore2/web/client/actions/layers');
const {changeMapView} = require('../actions/map');
const {startSearch,searchMore} = require("../actions/search");
const IdentifyUtils = require('../utils/IdentifyUtils');
require('./style/Search.css');

const Search = React.createClass({
    propTypes: {
        searchText: React.PropTypes.string,
        results: React.PropTypes.array,
        mapConfig: React.PropTypes.object,
        displaycrs: React.PropTypes.string,
        minScale: React.PropTypes.number,
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
            results: null,
            mapConfig: undefined,
            minScale: 1000
        }
    },
    getInitialState() {
        return {currentResult: null}
    },
    contextTypes: {
        messages: React.PropTypes.object
    },
    componentDidMount() {
        this.searchTimer = 0;
    },
    componentWillReceiveProps(newProps) {
        if(this.props.theme && newProps.theme !== this.props.theme) {
            this.resetSearch();
        }
    },
    killEvent(ev) {
        ev.preventDefault();
        ev.stopPropagation();
    },
    search() {
        if(this.props.searchText) {
            this.props.onPurgeResults();
            this.props.onSearch(
                this.props.searchText, {displaycrs: this.props.displaycrs},
                this.props.searchProviders, this.props.theme.searchProviders);
        } else {
            this.resetSearch();
        }
    },
    resetSearch() {
        this.setState({currentResult: null, focused: false});
        this.props.onSearchReset();
        this.props.removeLayer("searchselection");
    },
    onChange(ev) {
        this.props.onSearchTextChange(ev.target.value);
        clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(this.search, 500);
    },
    onFocus() {
        if(this.props.searchText && !this.props.results) {
            this.search();
        }
        this.setState({focused: true});
    },
    onKeyDown(ev) {
        if(ev.keyCode === 13) {
            this.search();
        } else if(ev.keyCode === 27) {
            ev.target.blur();
        }
    },
    render() {
        let placeholder = LocaleUtils.getMessageById(this.context.messages, "search.placeholder");
        if(!this.props.searchText) {
            var addonAfter = (<Glyphicon glyph="search"/>);
        } else if(this.props.searchText && !this.props.results && this.state.focused) {
            var addonAfter = (<Spinner spinnerName="circle" noFadeIn/>);
        } else {
            var addonAfter = (<Glyphicon glyph="remove" onClick={this.resetSearch}/>);
        }

        return (
            <div id="Search">
                <Input
                    className="search-bar"
                    placeholder={placeholder}
                    type="text"
                    ref="input"
                    value={this.props.searchText}
                    addonAfter={addonAfter}
                    onBlur={() => this.setState({focused: false})}
                    onFocus={this.onFocus}
                    onKeyDown={this.onKeyDown}
                    onChange={this.onChange} />
                {this.renderSearchResults()}
            </div>
        )
    },
    renderSearchResults() {
        if(!this.props.results || this.props.results.length === 0 || !this.state.focused) {
            return null;
        }
        return (
            <ul className="search-results">
                {this.props.results.map(category => this.renderCategory(category))}
            </ul>
        );
    },
    renderCategory(category) {
        let title = category.titlemsgid ? (<Message msgId={category.titlemsgid} />) : category.title;
        return (
            <li key={category.id}>
                <span className="search-results-category-title">{title}</span>
                <ul>{category.items.map(item => this.renderItem(item))}</ul>
            </li>
        )
    },
    renderItem(item) {
        if(item.more) {
            return (
                <li key={item.id}
                    onMouseDown={this.killEvent}
                    onClick={() => this.moreClicked(item)}>
                    <i><Message msgId="search.more" /></i>
                </li>
            );
        }
        return (
            <li key={item.id} title={item.text}
                onMouseDown={() => this.itemClicked(item)}
                dangerouslySetInnerHTML={{__html: item.text}}></li>
        );
    },
    moreClicked(item) {
        this.props.searchMore(item, this.props.searchText, this.props.searchProviders, this.props.theme.searchProviders)
    },
    itemClicked(item) {
        this.props.removeLayer("searchselection");
        let wgscenterlatlon = CoordinatesUtils.reproject(item, item.crs, "EPSG:4326");
        let wgsextent = CoordinatesUtils.reprojectBbox(item.bbox, item.crs, "EPSG:4326");
        this.props.addMarker({lat: wgscenterlatlon.y, lng: wgscenterlatlon.x});
        if(this.props.mapConfig !== undefined) {
            // find max zoom level greater than min scale
            let maxZoom = 0;
            const scales = mapUtils.getScales(this.props.mapConfig.projection);
            for (let i in scales) {
                if (scales[i] < this.props.minScale) {
                    break;
                } else {
                    maxZoom = i;
                }
            }

            // zoom to result using max zoom level
            const newZoom = mapUtils.getZoomForExtent(CoordinatesUtils.reprojectBbox(item.bbox, item.crs, this.props.mapConfig.projection), this.props.mapConfig.size, 0, maxZoom, null);
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
            visibility: true,
            queryable: false
        };
        this.props.addLayer(layer, true);
    }
});

const selector = (state) => {
    let mapcrs = state && state.map && state.map.present ? state.map.present.projection : undefined;
    let mousecrs = state && state.mousePosition && state.mousePosition ? state.mousePosition.crs : undefined;
    return {
        searchText: state.search ? state.search.searchText : "",
        results: state.search ? state.search.results : null,
        mapConfig: state.map ? state.map.present : undefined,
        displaycrs: mousecrs || mapcrs || "EPSG:4326",
        theme: state.theme ? state.theme.current : null
    }
};

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
