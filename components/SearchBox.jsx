/**
 * Copyright 2019-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {createSelector} from 'reselect';
import isEmpty from 'lodash.isempty';
import axios from 'axios';
import uuid from 'uuid';
import {SearchResultType} from '../actions/search';
import {logAction} from '../actions/logging';
import {panTo, zoomToPoint} from '../actions/map';
import {LayerRole, addLayerFeatures, addThemeSublayer, removeLayer} from '../actions/layers';
import {setCurrentTheme} from '../actions/theme';
import {setCurrentTask} from '../actions/task';
import Icon from './Icon';
import displayCrsSelector from '../selectors/displaycrs';
import searchProvidersSelector from '../selectors/searchproviders';
import ConfigUtils from '../utils/ConfigUtils';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import VectorLayerUtils from '../utils/VectorLayerUtils';
import MapUtils from '../utils/MapUtils';
import MiscUtils from '../utils/MiscUtils';
import {UrlParams} from '../utils/PermaLinkUtils';
import './style/SearchBox.css';

class SearchBox extends React.Component {
    static propTypes = {
        addLayer: PropTypes.func,
        addLayerFeatures: PropTypes.func,
        addThemeSublayer: PropTypes.func,
        displaycrs: PropTypes.string,
        layers: PropTypes.array,
        localConfig: PropTypes.object,
        logAction: PropTypes.func,
        map: PropTypes.object,
        panTo: PropTypes.func,
        removeLayer: PropTypes.func,
        searchFilter: PropTypes.string,
        searchOptions: PropTypes.shape({
            minScaleDenom: PropTypes.number,
            resultLimit: PropTypes.number
        }),
        searchProviders: PropTypes.object,
        setCurrentTask: PropTypes.func,
        setCurrentTheme: PropTypes.func,
        theme: PropTypes.object,
        themes: PropTypes.object,
        zoomToPoint: PropTypes.func
    }
    state = {
        searchText: "",
        searchSession: null,
        pendingSearches: [],
        recentSearches: [],
        searchResults: {},
        resultsVisible: false,
        collapsedSections: {},
        expandedLayerGroup: null,
        activeLayerInfo: null
    }
    constructor(props) {
        super(props);
        this.searchBox = null;
        this.searchTimeout = null;
        this.preventBlur = false;
        this.state.searchText = UrlParams.getParam('st') || "";
        UrlParams.updateParams({st: undefined});
    }
    componentDidUpdate(prevProps, prevState) {
        // Restore highlight from URL as soon as theme is loaded
        if (this.props.theme && !prevProps.theme) {
            const hc = UrlParams.getParam('hc');
            const hp = UrlParams.getParam('hp');
            const hf = UrlParams.getParam('hf');
            if (hp && hf) {
                const DATA_URL = ConfigUtils.getConfigProp("searchDataServiceUrl").replace(/\/$/g, "");
                axios.get(DATA_URL + "/" + hp + "/?filter=" + hf).then(response => {
                    this.showFeatureGeometry(response.data, prevProps.localConfig.startupParams.s);
                });
            } else if (typeof(hc) === "string" && (hc.toLowerCase() === "true" || hc === "1")) {
                this.selectProviderResult({
                    label: "",
                    x: this.props.map.center[0],
                    y: this.props.map.center[1],
                    crs: this.props.displaycrs
                }, false);
            }
            UrlParams.updateParams({hp: undefined, hf: undefined, hc: undefined});
        }
    }
    renderRecentResults = () => {
        const recentSearches = this.state.recentSearches.filter(entry => entry.toLowerCase().includes(this.state.searchText.toLowerCase()));
        if (isEmpty(recentSearches) || (recentSearches.length === 1 && recentSearches[0].toLowerCase() === this.state.searchText.toLowerCase())) {
            return null;
        }
        return (
            <div key="recent">
                <div className="searchbox-results-section-title" onClick={() => this.toggleSection("recent")} onMouseDown={this.killEvent}>
                    <Icon icon={this.state.collapsedSections.recent ? "expand" : "collapse"} />{LocaleUtils.tr("searchbox.recent")}
                </div>
                {!this.state.collapsedSections.recent ? (
                    <div className="searchbox-results-section-body">
                        {recentSearches.map((entry, idx) => (
                            <div className="searchbox-result" key={"r" + idx} onClick={() => this.searchTextChanged(null, entry)} onMouseDown={this.killEvent}>
                                {entry}
                            </div>
                        ))}
                    </div>
                ) : null}
            </div>
        );
    }
    renderFilters = (searchResults) => {
        if (isEmpty(searchResults.result_counts) || searchResults.result_counts.length < 2) {
            return null;
        }
        const minResultsExanded = ConfigUtils.getConfigProp("minResultsExanded");
        const initialCollapsed = searchResults.tot_result_count < minResultsExanded;
        const collapsed = (this.state.collapsedSections.filter === undefined) ? initialCollapsed : this.state.collapsedSections.filter;
        const values = searchResults.result_counts.map(entry => entry.filterword + ": " + searchResults.query_text);
        values.sort((a, b) => a.localeCompare(b));
        return (
            <div key="filter">
                <div className="searchbox-results-section-title" onClick={() => this.toggleSection("filter")} onMouseDown={this.killEvent}>
                    <Icon icon={collapsed ? "expand" : "collapse"} />{LocaleUtils.tr("searchbox.filter")}
                </div>
                {!collapsed ? (
                    <div className="searchbox-results-section-body">
                        {values.map((value, idx) => {
                            return (
                                <div className="searchbox-result" key={"f" + idx} onClick={() => this.searchTextChanged(null, value)} onMouseDown={this.killEvent}>
                                    <span className="searchbox-result-label">{value}</span>
                                </div>
                            );
                        })}
                    </div>
                ) : null}
            </div>
        );
    }
    renderProviderResults = () => {
        const results = Object.keys(this.props.searchProviders).reduce((result, provider) => {
            if (!this.state.searchResults[provider]) {
                return result;
            }
            return result.concat(this.state.searchResults[provider].results.map(group => {
                const sectionId = provider + ":" + group.id;
                return {
                    priority: group.priority || 0,
                    tree: (
                        <div key={sectionId}>
                            <div className="searchbox-results-section-title" onClick={() => this.toggleSection(sectionId)} onMouseDown={this.killEvent}>
                                <Icon icon={this.state.collapsedSections[sectionId] ? "expand" : "collapse"} />
                                {group.titlemsgid ? LocaleUtils.tr(group.titlemsgid) : (<span>{group.title}</span>)}
                            </div>
                            {!this.state.collapsedSections[sectionId] ? (
                                <div className="searchbox-results-section-body">
                                    {group.items.map((entry, idx) => (
                                        <div className="searchbox-result" key={"c" + idx} onClick={() => {this.selectProviderResult(entry); this.blur(); }} onMouseDown={this.killEvent}>
                                            <span className="searchbox-result-label" dangerouslySetInnerHTML={{__html: entry.text}} title={entry.label || entry.text} />
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    )
                };
            }));
        }, []);
        results.sort((a, b) => (b.priority - a.priority));
        return isEmpty(results) ? null : results.map(entry => entry.tree);
    }
    renderPlaces = (searchResults) => {
        const features = (searchResults.results || []).filter(result => result.feature);
        if (isEmpty(features)) {
            return null;
        }
        const featureResultCount = (searchResults.result_counts || []).reduce((res, entry) => res + (entry.dataproduct_id !== 'dataproduct' ? (entry.count || 0) : 0), 0);
        const additionalResults = featureResultCount - features.length;
        const iconPath = ConfigUtils.getAssetsPath() + '/img/search/';
        return (
            <div key="places">
                <div className="searchbox-results-section-title" onClick={() => this.toggleSection("places")} onMouseDown={this.killEvent}>
                    <Icon icon={this.state.collapsedSections.places ? "expand" : "collapse"} />{LocaleUtils.tr("searchbox.places")}
                </div>
                {!this.state.collapsedSections.places ? (
                    <div className="searchbox-results-section-body">
                        {features.map((entry, idx) => (
                            <div className="searchbox-result" key={"p" + idx} onClick={() => { this.selectFeatureResult(entry.feature); this.blur(); }} onMouseDown={this.killEvent}>
                                <img onError={ev => { ev.target.src = iconPath + "feature.svg";}} src={iconPath + entry.feature.dataproduct_id + ".svg"} />
                                <span className="searchbox-result-label">{entry.feature.display}</span>
                            </div>
                        ))}
                        {additionalResults > 0 && (
                            <div className="searchbox-more-results">
                                {additionalResults}&nbsp;{LocaleUtils.tr("searchbox.more")}
                            </div>
                        )}
                    </div>
                ) : null}
            </div>
        );
    }
    renderLayers = (searchResults) => {
        const layers = (searchResults.results || []).filter(result => result.dataproduct);
        if (isEmpty(layers)) {
            return null;
        }
        const additionalLayerResults = !isEmpty((searchResults.result_counts || []).filter(entry => entry.dataproduct_id === 'dataproduct'));
        return (
            <div key="layers">
                <div className="searchbox-results-section-title" onClick={() => this.toggleSection("layers")} onMouseDown={this.killEvent}>
                    <Icon icon={this.state.collapsedSections.layers ? "expand" : "collapse"} />{LocaleUtils.tr("searchbox.layers")}
                </div>
                {!this.state.collapsedSections.layers ? (
                    <div className="searchbox-results-section-body">
                        {layers.map((entry, idx) => !isEmpty(entry.dataproduct.sublayers) ? this.renderLayerGroup(entry.dataproduct, idx) : this.renderLayer(entry.dataproduct, idx))}
                        {additionalLayerResults ? (
                            <div className="searchbox-more-results">
                                {LocaleUtils.tr("searchbox.morelayers")}
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>
        );
    }
    renderLayer = (dataproduct, idx) => {
        const iconPath = ConfigUtils.getAssetsPath() + '/img/search/';
        const showAbstract = dataproduct.dataproduct_id in (this.state.activeLayerInfo || {});
        return (
            <div key={"p" + idx}>
                <div className={"searchbox-result " + (showAbstract ? "searchbox-result-expandedinfo" : "")} onClick={() => { this.selectLayerResult(dataproduct); this.blur(); }} onMouseDown={this.killEvent}>
                    <img src={iconPath + "dataproduct.svg"} />
                    <span className="searchbox-result-label">{dataproduct.display}</span>
                    {dataproduct.dset_info ? (<Icon icon="info-sign" onClick={ev => {this.killEvent(ev); this.selectLayerResult(dataproduct, true); }} />) : null}
                </div>
                {showAbstract ? (
                    <div className="searchbox-result-abstract"
                        dangerouslySetInnerHTML={{__html: this.getLayerDescription(this.state.activeLayerInfo[dataproduct.dataproduct_id][0])}}
                    />
                ) : null}
            </div>
        );
    }
    renderLayerGroup = (dataproduct, idx) => {
        const iconPath = ConfigUtils.getAssetsPath() + '/img/search/';
        const showAbstract = dataproduct.dataproduct_id in (this.state.activeLayerInfo || {});
        return [(
            <div key={"g" + idx}>
                <div className={"searchbox-result " + (showAbstract ? "searchbox-result-expandedinfo" : "")} onClick={() => { this.selectLayerResult(dataproduct); this.blur(); }} onMouseDown={this.killEvent}>
                    <img onClick={ev => this.toggleLayerGroup(ev, dataproduct.dataproduct_id)} src={iconPath + (this.state.expandedLayerGroup === dataproduct.dataproduct_id ? "layergroup_close" : "layergroup_open") + ".svg"} />
                    <span className="searchbox-result-label">{dataproduct.display}</span>
                    {dataproduct.dset_info ? (<Icon icon="info-sign" onClick={ev => {this.killEvent(ev); this.selectLayerResult(dataproduct, true); }} />) : null}
                </div>
                {showAbstract ? (
                    <div className="searchbox-result-abstract"
                        dangerouslySetInnerHTML={{__html: this.getLayerDescription(this.state.activeLayerInfo[dataproduct.dataproduct_id][0])}}
                    />
                ) : null}
            </div>
        ),
        this.state.expandedLayerGroup === dataproduct.dataproduct_id ? (
            <div className="searchbox-result-group" key={"eg" + idx}>{dataproduct.sublayers.map(this.renderLayer)}</div>
        ) : null
        ];
    }
    getLayerDescription = (layer) => {
        if (isEmpty(layer.abstract)) {
            return LocaleUtils.tr("searchbox.nodescription");
        } else {
            return MiscUtils.addLinkAnchors(layer.abstract);
        }
    }
    toggleLayerGroup = (ev, dataproductId) => {
        this.killEvent(ev);
        this.setState({expandedLayerGroup: this.state.expandedLayerGroup === dataproductId ? null : dataproductId});
    }
    renderSearchResults = () => {
        if (!this.state.resultsVisible) {
            return false;
        }
        const fulltextResults = this.state.searchResults.__fulltext || {};
        const children = [
            this.renderRecentResults(),
            this.renderFilters(fulltextResults),
            this.renderProviderResults(),
            this.renderPlaces(fulltextResults),
            this.renderLayers(fulltextResults)
        ].filter(element => element);
        if (isEmpty(children)) {
            return null;
        }
        return (
            <div className="searchbox-results" onMouseDown={this.setPreventBlur} ref={this.setupKillTouchEvents}>
                {children}
            </div>
        );
    }
    setPreventBlur = () => {
        this.preventBlur = true;
        setTimeout(() => {this.preventBlur = false; return false;}, 100);
    }
    setupKillTouchEvents = (el) => {
        if (el) {
            el.addEventListener('touchmove', ev => ev.stopPropagation(), { passive: false });
        }
    }
    killEvent = (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
    }
    toggleSection = (key) => {
        const newCollapsedSections = {...this.state.collapsedSections};
        newCollapsedSections[key] = !newCollapsedSections[key];
        this.setState({collapsedSections: newCollapsedSections});
    }
    render() {
        const placeholder = LocaleUtils.tr("searchbox.placeholder");
        return (
            <div className="SearchBox">
                <div className="searchbox-field">
                    <Icon icon="search" />
                    <input onBlur={this.onBlur} onChange={ev => this.searchTextChanged(ev.target, ev.target.value)}
                        onFocus={this.onFocus} onKeyDown={this.onKeyDown}
                        onPaste={ev => ev.target.setAttribute('__pasted', 1)}
                        placeholder={placeholder} ref={el => { this.searchBox = el; }}
                        type="text" value={this.state.searchText} />
                    <Icon icon="remove" onClick={this.clear} />
                </div>
                {this.renderSearchResults()}
            </div>
        );
    }
    searchTextChanged = (el, text) => {
        let pasted = false;
        if (el) {
            pasted = el.getAttribute('__pasted');
            el.removeAttribute('__pasted');
        }
        if (this.props.layers.find(layer => layer.id === 'searchselection')) {
            this.props.removeLayer('searchselection');
        }
        this.setState({searchText: text, expandedLayerGroup: null, activeLayerInfo: null});
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => this.startSearch(pasted), 250);
    }
    onFocus = () => {
        this.setState({resultsVisible: true});
        if (this.searchBox) {
            this.searchBox.select();
        }
        if (isEmpty(this.state.searchResults)) {
            this.startSearch(false);
        }
    }
    onBlur = () => {
        if (this.preventBlur && this.searchBox) {
            this.searchBox.focus();
        } else {
            this.setState({resultsVisible: false, collapsedSections: {}, expandedLayerGroup: null, activeLayerInfo: null});
        }
    }
    onKeyDown = (ev) => {
        if (ev.keyCode === 27 && this.searchBox) {
            if (this.searchBox.selectionStart !== this.searchBox.selectionEnd) {
                this.searchBox.setSelectionRange(this.searchBox.value.length, this.searchBox.value.length);
            } else {
                this.searchBox.blur();
            }
        }
    }
    clear = () => {
        if (this.searchBox) {
            this.searchBox.blur();
        }
        this.setState({searchText: '', searchResults: {}});
        this.props.removeLayer('searchselection');
    }
    startSearch = () => {
        const service = ConfigUtils.getConfigProp("searchServiceUrl").replace(/\/$/g, "") + '/';
        const searchText = this.state.searchText.trim();
        if (isEmpty(searchText)) {
            this.setState({searchResults: {}});
            return;
        }
        const searchSession = uuid.v1();
        this.setState({searchResults: {query_text: searchText}, searchSession: searchSession, pendingSearches: Object.keys(this.props.searchProviders).concat(["__fulltext"])});
        // Fulltext search
        const params = {
            searchtext: searchText,
            filter: this.props.searchFilter,
            limit: this.props.searchOptions.resultLimit
        };
        axios.get(service, {params}).then(response => {
            const searchResults = {...response.data, query_text: searchText};
            searchResults.tot_result_count = (searchResults.result_counts || []).reduce((res, entry) => res + (entry.count || 0), 0);
            this.addSearchResults(searchSession, "__fulltext", searchResults);
        }).catch(e => {
            console.warn("Search failed: " + e);
            this.addSearchResults(searchSession, "__fulltext", {results: [], tot_result_count: 0});
        });
        // Additional provider searches
        const searchOptions = {displaycrs: this.props.displaycrs};
        Object.entries(this.props.searchProviders).forEach(entry => {
            const key = entry[0];
            const provider = entry[1];
            provider.onSearch(searchText, null, searchOptions, (response) => {
                const data = response.results;
                const count = data.data.reduce((tot, cur) => (tot + cur.items.length), 0);
                this.addSearchResults(searchSession, key, {results: data.data, tot_result_count: count});
            });
        });
    }
    addSearchResults = (searchSession, searchId, results) => {
        if (searchSession !== this.state.searchSession) {
            return;
        }
        const pendingSearches = this.state.pendingSearches.filter(entry => entry == searchId);
        const searchResults = {...this.state.searchResults, [searchId]: results};
        this.setState({
            searchResults:searchResults ,
            pendingSearches: pendingSearches
        });
        if (isEmpty(pendingSearches)) {
            const uniqueResults = Object.entries(searchResults).filter((key, value) => { value.tot_result_count === 1; });
            // If a single result is returned, select it immediately if it is a feature or provider result
            if (uniqueResults.length === 1) {
                const uniqueResult = uniqueResults[0];
                if (uniqueResult[0] === "__fulltext" && uniqueResult[1].feature) {
                    this.selectFeatureResult(uniqueResult[1].feature);
                    this.blur();
                } else if (uniqueResults[0] !== "__fulltext" && uniqueResults[1][0].items[0].bbox) {
                    this.selectProviderResult(uniqueResults[1][0].items[0]);
                    this.blur();
                }
            }
        }
    }
    updateRecentSearches = () => {
        if (!this.state.searchResults || !this.state.searchResults.query_text) {
            return;
        }
        const text = this.state.searchResults.query_text;
        if (!this.state.recentSearches.includes(text)) {
            this.setState({recentSearches: [text, ...this.state.recentSearches.slice(0, 4)]});
        }
    }
    blur = () => {
        if (this.searchBox) {
            this.searchBox.blur();
        }
    }
    selectProviderResult = (result, zoom = true) => {
        this.updateRecentSearches();
        const resultType = result.type || SearchResultType.PLACE;
        if (resultType === SearchResultType.PLACE) {
            if (zoom) {
                const maxZoom = MapUtils.computeZoom(this.props.map.scales, this.props.theme.minSearchScaleDenom || this.props.searchOptions.minScaleDenom);
                this.props.zoomToPoint([result.x, result.y], maxZoom, result.crs);
            } else {
                this.props.panTo([result.x, result.y], result.crs);
            }
            const feature = {
                geometry: {type: 'Point', coordinates: [result.x, result.y]},
                properties: { label: result.label !== undefined ? result.label : result.text },
                styleName: 'marker',
                crs: result.crs,
                id: 'searchmarker'
            };
            const layer = {
                id: "searchselection",
                role: LayerRole.SELECTION
            };
            this.props.addLayerFeatures(layer, [feature], true);
            UrlParams.updateParams({hp: undefined, hf: undefined, hc: "1"});
            this.props.logAction("SEARCH_TEXT", {searchText: this.state.searchText});
            this.props.logAction("SEARCH_RESULT_SELECTED", {place: result.text});
        } else if (resultType === SearchResultType.THEMELAYER) {
            this.props.addThemeSublayer(result.layer);
            // Show layer tree to notify user that something has happened
            this.props.setCurrentTask('LayerTree');
        } else if (resultType === SearchResultType.EXTERNALLAYER) {
            // Check if layer is already in the LayerTree
            const sublayers = LayerUtils.getSublayerNames(result.layer);
            const existing = this.props.layers.find(l => {
                return l.type === result.layer.type && l.url === result.layer.url && !isEmpty(LayerUtils.getSublayerNames(l).filter(v => sublayers.includes(v)));
            });
            if (!existing) {
                this.props.addLayer(result.layer);
            }
            // Show layer tree to notify user that something has happened
            this.props.setCurrentTask('LayerTree');
        } else if (resultType === SearchResultType.THEME) {
            this.props.setCurrentTheme(result.theme, this.props.themes);
        }
    }
    selectFeatureResult = (result) => {
        this.updateRecentSearches();
        // URL example: /api/data/v1/ch.so.afu.fliessgewaesser.netz/?filter=[["gewissnr","=",1179]]
        let filter = `[["${result.id_field_name}","=",`;
        if (typeof(result.feature_id) === 'string') {
            filter += `"${result.feature_id}"]]`;
        } else {
            filter += `${result.feature_id}]]`;
        }
        const DATA_URL = ConfigUtils.getConfigProp("searchDataServiceUrl").replace(/\/$/g, "");
        axios.get(DATA_URL + "/" + result.dataproduct_id + "/?filter=" + filter).then(response => this.showFeatureGeometry(response.data));
        UrlParams.updateParams({hp: result.dataproduct_id, hf: filter, hc: undefined});

        this.props.logAction("SEARCH_TEXT", {searchText: this.state.searchText});
        this.props.logAction("SEARCH_RESULT_SELECTED", {feature: result.display});
    }
    showFeatureGeometry = (data, scale = undefined) => {
        // Zoom to bbox
        const bbox = CoordinatesUtils.reprojectBbox(data.bbox, data.crs.properties.name, this.props.map.projection);
        let zoom = 0;
        if (scale) {
            zoom = MapUtils.computeZoom(this.props.map.scales, scale);
        } else {
            const maxZoom = MapUtils.computeZoom(this.props.map.scales, this.props.theme.minSearchScaleDenom || this.props.searchOptions.minScaleDenom);
            zoom = Math.max(0, MapUtils.getZoomForExtent(bbox, this.props.map.resolutions, this.props.map.size, 0, maxZoom + 1) - 1);
        }
        const x = 0.5 * (bbox[0] + bbox[2]);
        const y = 0.5 * (bbox[1] + bbox[3]);
        this.props.zoomToPoint([x, y], zoom, this.props.map.projection);

        // Add result geometry
        const layer = {
            id: "searchselection",
            role: LayerRole.SELECTION
        };
        for (const feature of data.features) {
            feature.geometry = VectorLayerUtils.reprojectGeometry(feature.geometry, data.crs.properties.name, this.props.map.projection);
        }
        this.props.addLayerFeatures(layer, data.features, true);

    }
    selectLayerResult = (result, info = false) => {
        if (!info) {
            this.updateRecentSearches();
        } else if (result.dataproduct_id in (this.state.activeLayerInfo || {})) {
            this.setState({activeLayerInfo: null});
            return;
        }
        const DATAPRODUCT_URL = ConfigUtils.getConfigProp("dataproductServiceUrl").replace(/\/$/g, "");
        const params = {
            filter: result.dataproduct_id
        };
        axios.get(DATAPRODUCT_URL + "/weblayers", {params}).then(response => {
            if (info) {
                this.setState({activeLayerInfo: response.data});
            } else {
                this.props.logAction("SEARCH_TEXT", {searchText: this.state.searchText});
                this.props.logAction("SEARCH_RESULT_SELECTED", {layer: result.dataproduct_id});
                this.addLayer(result, response.data);
            }
        });
        UrlParams.updateParams({hp: undefined, hf: undefined, hc: undefined});
    }
    addLayer = (item, data) => {
        if (!isEmpty(data[item.dataproduct_id])) {
            this.props.addThemeSublayer({sublayers: data[item.dataproduct_id]});
            // Show layer tree to notify user that something has happened
            this.props.setCurrentTask('LayerTree');
        }
    }
}

const searchFilterSelector = createSelector([state => state.theme, state => state.layers.flat], (theme, layers) => {
    let searchFilter = [];
    // default filter from themes.json
    if (theme && theme.current) {
        const provider = theme.current.searchProviders.find(entry => entry.provider === "solr");
        if (provider) {
            searchFilter = provider.default;
        }
    }
    // searchterms of active layers
    for (const layer of layers) {
        if (layer.role === LayerRole.THEME) {
            for (const entry of LayerUtils.explodeLayers([layer])) {
                if (entry.sublayer.visibility === true) {
                    searchFilter = searchFilter.concat(entry.sublayer.searchterms || []);
                }
            }
        }
    }
    return [...new Set(searchFilter)].join(",");
});

export default (searchProviders, providerFactory = () => { return null; }) => {
    const providersSelector = searchProvidersSelector(searchProviders, providerFactory);
    return connect(
        createSelector([state => state, searchFilterSelector, displayCrsSelector, providersSelector], (state, searchFilter, displaycrs, searchproviders) => ({
            map: state.map,
            layers: state.layers.flat,
            theme: state.theme.current,
            themes: state.theme.themes,
            localConfig: state.localConfig,
            searchFilter: searchFilter,
            displaycrs: displaycrs,
            searchProviders: searchproviders
        })), {
            addThemeSublayer: addThemeSublayer,
            addLayerFeatures: addLayerFeatures,
            removeLayer: removeLayer,
            setCurrentTask: setCurrentTask,
            zoomToPoint: zoomToPoint,
            panTo: panTo,
            logAction: logAction,
            setCurrentTheme: setCurrentTheme
        }
    )(SearchBox);
};
