/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const {connect} = require('react-redux');
const {Glyphicon} = require('react-bootstrap');
const Spinner = require('react-spinkit');
const {createSelector} = require('reselect');
const classnames = require('classnames');
const Message = require('../../MapStore2/web/client/components/I18N/Message');
const {resultsPurge, resetSearch, searchTextChanged, addMarker, setHighlightedFeature} = require("../../MapStore2/web/client/actions/search");
const LocaleUtils = require('../../MapStore2/web/client/utils/LocaleUtils');
const mapUtils = require('../../MapStore2/web/client/utils/MapUtils');
const CoordinatesUtils = require('../../MapStore2/web/client/utils/CoordinatesUtils');
const {addLayer, removeLayer} = require('../../MapStore2/web/client/actions/layers');
const {changeMapView} = require('../actions/map');
const {startSearch,searchMore} = require("../actions/search");
const displayCrsSelector = require('../selectors/displaycrs');
const IdentifyUtils = require('../utils/IdentifyUtils');
const UrlParams = require("../utils/UrlParams");
require('./style/Search.css');

const Search = React.createClass({
    propTypes: {
        searchText: React.PropTypes.string,
        results: React.PropTypes.array,
        mapConfig: React.PropTypes.object,
        displaycrs: React.PropTypes.string,
        onSearch: React.PropTypes.func,
        searchMore: React.PropTypes.func,
        purgeResults: React.PropTypes.func,
        onSearchReset: React.PropTypes.func,
        onSearchTextChange: React.PropTypes.func,
        panToResult: React.PropTypes.func,
        addMarker: React.PropTypes.func,
        searchProviders: React.PropTypes.object,
        addLayer: React.PropTypes.func,
        removeLayer: React.PropTypes.func,
        theme: React.PropTypes.object,
        showFilterCombo: React.PropTypes.bool,
        searchOptions: React.PropTypes.object,
        setHighlightGeometry: React.PropTypes.func
    },
    getDefaultProps() {
        return {
            searchText: "",
            results: null,
            mapConfig: undefined,
            showFilterCombo: false
        }
    },
    getInitialState() {
        return {currentResult: null, showfields: false, showproviderselection: false}
    },
    contextTypes: {
        messages: React.PropTypes.object
    },
    componentDidMount() {
        this.searchTimer = 0;
    },
    componentWillReceiveProps(newProps) {
        if(newProps.theme && newProps.theme !== this.props.theme) {
            let found = false;
            if(newProps.searchOptions.showProviderSelection && newProps.searchProviders) {
                if(UrlParams.getParam("sp") && newProps.theme.searchProviders.includes("sp")) {
                    found = true;
                } else {
                    for(let key of Object.keys(newProps.searchProviders)) {
                        if(newProps.theme.searchProviders.includes(key)) {
                            UrlParams.updateParams({sp: key});
                            found = true;
                            break;
                        }
                    }
                }
            }
            if(!found) {
                UrlParams.updateParams({sp: undefined});
            }
            this.resetSearch();
        }
    },
    killEvent(ev) {
        ev.preventDefault();
        ev.stopPropagation();
    },
    search() {
        if(this.props.searchText) {
            this.props.purgeResults();
            this.props.onSearch(
                this.props.searchText, {displaycrs: this.props.displaycrs},
                this.activeProviers());
        } else {
            this.resetSearch();
        }
    },
    resetSearch() {
        this.setState({currentResult: null, focused: false, showfields: false});
        UrlParams.updateParams({st: undefined});
        this.props.onSearchReset();
        this.props.removeLayer("searchselection");
    },
    onChange(ev) {
        this.props.onSearchTextChange(ev.target.value);
        clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(this.search, 500);
    },
    checkShowFields(ev) {
        if(UrlParams.getParam("sp") && this.props.searchProviders[UrlParams.getParam("sp")].fields) {
            this.setState({showfields: true, focused: false});
            ev.preventDefault();
        }
    },
    onFocus() {
        if(!this.state.showfields && this.props.searchText && !this.props.results) {
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
    providerChanged(ev) {
        this.resetSearch();
        UrlParams.updateParams({sp: ev.target.value});
    },
    activeProviers() {
        let keys = UrlParams.getParam("sp") ? [UrlParams.getParam("sp")] : this.props.theme.searchProviders;
        return keys.reduce((result, key) => {
            result[key] = this.props.searchProviders[key];
            return result;
        }, {});
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
        let providerSelection = null;
        if(this.props.searchOptions.showProviderSelection) {
            let providerSelectionMenu = null;
            if(this.state.showproviderselection) {
                providerSelectionMenu = (
                    <ul className="searchbar-provider-selection">
                        {Object.keys(this.props.searchProviders).map(key => {
                            if(this.props.theme && this.props.theme.searchProviders.includes(key)) {
                                return (<li key={key} onClick={() => UrlParams.updateParams({sp: key})}>{this.props.searchProviders[key].label}</li>);
                            }
                        })}
                    </ul>
                );
            }
            let addonClasses = classnames({
                'searchbar-addon': true,
                'searchbar-addon-active': this.state.showproviderselection
            });
            providerSelection = (
                <span className={addonClasses} onClick={() => this.setState({showproviderselection: !this.state.showproviderselection})}><Glyphicon glyph="chevron-down" />
                    {providerSelectionMenu}
                </span>
            );
            if(UrlParams.getParam("sp")) {
                placeholder += ": " + this.props.searchProviders[UrlParams.getParam("sp")].label;
            }
        }
        let searchform = null;
        this.formfields = {};
        if(this.state.showfields) {
            let fields = this.props.searchProviders[UrlParams.getParam("sp")].fields;
            let values = {};
            this.props.searchText.split(/\s*AND\s*/).map(pair => {
                let parts = pair.split(/\s*=\s*/);
                if(parts.length === 2) {
                    values[parts[0]] = parts[1];
                }
            });
            searchform = (
                <div className="search-form">
                    <table>
                        <tbody>
                            {fields.map(field => (
                                <tr key={field.id}>
                                    <td>{field.label}</td>
                                    <td><input ref={el => this.formfields[field.id] = el} type="text" defaultValue={values[field.id] || ""} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="search-form-buttons">
                        <button onClick={this.submitFormSearch}><Glyphicon glyph="search"/> Search</button>
                        <button onClick={() => this.setState({showfields: false}) }><Glyphicon glyph="remove"/> Cancel</button>
                    </div>
                </div>
            );
        }
        return (
            <div id="Search">
                <div className="searchbar-wrapper">
                    <div className="searchbar-container">
                        <input
                            className="searchbar"
                            placeholder={placeholder}
                            type="text"
                            ref={el => this.input = el}
                            value={this.props.searchText}
                            onBlur={() => this.setState({focused: false})}
                            onMouseDown={this.checkShowFields}
                            onFocus={this.onFocus}
                            onKeyDown={this.onKeyDown}
                            onChange={this.onChange} />
                        <span className="searchbar-addon">
                            {addonAfter}
                        </span>
                    </div>
                    {searchform}
                    {this.renderSearchResults()}
                </div>
                {providerSelection}
            </div>
        )
    },
    submitFormSearch() {
        let comp = this.props.searchProviders[UrlParams.getParam("sp")].comparator;
        let filters = Object.keys(this.formfields).map(key => {
            return  key + "=" + this.formfields[key].value;
        });
        let searchText = filters.join(" AND ");
        if(searchText !== this.props.searchText || !this.props.results) {
            this.props.purgeResults();
            this.props.onSearchTextChange(searchText);
            this.props.onSearch(searchText, {displaycrs: this.props.displaycrs}, this.activeProviers());
        }
        this.input.focus();
        this.setState({showfields: false});
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
        this.props.purgeResults();
        this.props.searchMore(item, this.props.searchText, this.activeProviers())
    },
    itemClicked(item) {
        this.props.removeLayer("searchselection");
        let wgscenterlatlon = CoordinatesUtils.reproject(item, item.crs, "EPSG:4326");
        let wgsextent = CoordinatesUtils.reprojectBbox(item.bbox, item.crs, "EPSG:4326");
        this.props.addMarker({lat: wgscenterlatlon.y, lng: wgscenterlatlon.x}, item.text);
        if(this.props.mapConfig !== undefined) {
            // find max zoom level greater than min scale
            let maxZoom = 0;
            const scales = mapUtils.getScales(this.props.mapConfig.projection);
            for (let i in scales) {
                if (scales[i] < this.props.searchOptions.minScale) {
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
            this.props.setHighlightGeometry(null);
            return;
        }
        let feature = IdentifyUtils.wktToGeoJSON(geometry);
        feature.geometry = IdentifyUtils.reprojectFeatureGeometry(feature.geometry, crs, this.props.mapConfig.projection);
        this.props.setHighlightedFeature(feature);
        let layer = {
            id: "searchselection",
            name: "Search selection",
            title: "Selection",
            type: "vector",
            features: [feature],
            featuresCrs: this.props.mapConfig.projection,
            visibility: true,
            queryable: false,
            crs: this.props.mapConfig.projection,
            layertreehidden: true
        };
        this.props.addLayer(layer, true);
    }
});

module.exports = (searchProviders) => connect(createSelector([state => state, displayCrsSelector], (state, displaycrs) => ({
    searchText: state.search ? state.search.searchText : "",
    results: state.search ? state.search.results : null,
    mapConfig: state.map ? state.map.present : undefined,
    displaycrs: displaycrs,
    theme: state.theme ? state.theme.current : null,
    searchProviders: searchProviders
})), {
    onSearch: startSearch,
    searchMore: searchMore,
    purgeResults: resultsPurge,
    onSearchReset: resetSearch,
    onSearchTextChange: searchTextChanged,
    panToResult: changeMapView,
    addMarker: addMarker,
    addLayer: addLayer,
    removeLayer: removeLayer,
    setHighlightedFeature: setHighlightedFeature
})(Search);
