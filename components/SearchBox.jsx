/**
 * Copyright 2019-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import axios from 'axios';
import classnames from 'classnames';
import isEmpty from 'lodash.isempty';
import pointInPolygon from 'point-in-polygon';
import polygonIntersectTest from 'polygon-intersect-test';
import PropTypes from 'prop-types';
import {createSelector} from 'reselect';
import {v1 as uuidv1} from 'uuid';

import {LayerRole, addLayerFeatures, addThemeSublayer, removeLayer, addLayer} from '../actions/layers';
import {logAction} from '../actions/logging';
import {panTo, zoomToExtent, zoomToPoint} from '../actions/map';
import {SearchResultType} from '../actions/search';
import {openExternalUrl, setCurrentTask} from '../actions/task';
import {setCurrentTheme} from '../actions/theme';
import {showNotification} from '../actions/windows';
import displayCrsSelector from '../selectors/displaycrs';
import searchProvidersSelector from '../selectors/searchproviders';
import ConfigUtils from '../utils/ConfigUtils';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';
import MiscUtils from '../utils/MiscUtils';
import {UrlParams} from '../utils/PermaLinkUtils';
import VectorLayerUtils from '../utils/VectorLayerUtils';
import Icon from './Icon';
import InputContainer from './InputContainer';
import MapSelection from './MapSelection';
import Spinner from './Spinner';
import ButtonBar from './widgets/ButtonBar';
import ComboBox from './widgets/ComboBox';
import NumberInput from './widgets/NumberInput';

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
        openExternalUrl: PropTypes.func,
        panTo: PropTypes.func,
        removeLayer: PropTypes.func,
        searchOptions: PropTypes.shape({
            allowSearchFilters: PropTypes.bool,
            hideResultLabels: PropTypes.bool,
            highlightStyle: PropTypes.object,
            minScaleDenom: PropTypes.number,
            resultLimit: PropTypes.number,
            sectionsDefaultCollapsed: PropTypes.bool,
            showLayerAfterChangeTheme: PropTypes.bool,
            zoomToLayers: PropTypes.bool
        }),
        searchProviders: PropTypes.object,
        setCurrentTask: PropTypes.func,
        setCurrentTheme: PropTypes.func,
        showNotification: PropTypes.func,
        theme: PropTypes.object,
        themes: PropTypes.object,
        zoomToExtent: PropTypes.func,
        zoomToPoint: PropTypes.func
    };
    state = {
        searchText: "",
        searchFilter: [],
        searchSession: null,
        pendingSearches: [],
        recentSearches: [],
        searchResults: {},
        resultsVisible: false,
        collapsedSections: {},
        expandedLayerGroup: null,
        activeLayerInfo: null,
        filterOptionsVisible: false,
        selectedProvider: "",
        filterRegionName: "",
        filterGeomType: null,
        filterGeometry: null
    };
    constructor(props) {
        super(props);
        this.searchBox = null;
        this.searchTimeout = null;
        this.preventBlur = false;
    }
    componentDidUpdate(prevProps, prevState) {
        // Restore highlight from URL as soon as theme is loaded
        if (this.props.theme && !prevProps.theme) {
            const hp = UrlParams.getParam('hp');
            const hf = UrlParams.getParam('hf');
            const ht = UrlParams.getParam('ht') || "";
            const st = UrlParams.getParam('st');
            if (hp && hf) {
                const DATA_URL = ConfigUtils.getConfigProp("searchDataServiceUrl").replace(/\/$/g, "");
                axios.get(DATA_URL + "/" + hp + "/?filter=" + hf).then(response => {
                    this.showFeatureGeometry(response.data, prevProps.localConfig.startupParams.s, ht);
                }).catch(() => {});
            } else if (hp && ht) {
                const params = {
                    searchtext: ht,
                    filter: hp,
                    limit: 1
                };
                const service = (ConfigUtils.getConfigProp("searchServiceUrl") || "").replace(/\/$/g, "") + '/';
                axios.get(service, {params}).then(response => {
                    if (response.data.results && response.data.results.length === 1) {
                        const result = response.data.results[0].feature;
                        let filter = `[["${result.id_field_name}","=",`;
                        if (typeof(result.feature_id) === 'string') {
                            filter += `"${result.feature_id}"]]`;
                        } else {
                            filter += `${result.feature_id}]]`;
                        }
                        const DATA_URL = ConfigUtils.getConfigProp("searchDataServiceUrl").replace(/\/$/g, "");
                        axios.get(DATA_URL + "/" + result.dataproduct_id + "/?filter=" + filter).then(r => this.showFeatureGeometry(r.data, undefined, result.display)).catch(() => {});
                    } else {
                        this.setState({searchText: ht});
                    }
                }).catch(() => {});
            } else if (st) {
                this.setState({searchText: st}, () => this.startSearch(true));
            }
            UrlParams.updateParams({hp: undefined, hf: undefined, ht: undefined, st: undefined});
        } else if (this.props.theme !== prevProps.theme) {
            this.clear();
        }
        // Trigger search when closing filter options
        if (!this.state.filterOptionsVisible && prevState.filterOptionsVisible) {
            this.searchTextChanged(this.state.searchText);
        }
        // Compute search filter
        if (this.props.theme !== prevProps.theme || this.props.layers !== prevProps.layers) {
            let searchFilter = [];
            // default filter from themes.json
            if (this.props.theme && this.props.theme.searchProviders) {
                const provider = this.props.theme.searchProviders.find(entry => entry.provider === "solr");
                if (provider) {
                    searchFilter = provider.default;
                }
            }
            // searchterms of active layers
            for (const entry of LayerUtils.explodeLayers(this.props.layers)) {
                if (entry.layer.role === LayerRole.THEME && entry.sublayer.visibility === true) {
                    searchFilter = searchFilter.concat(entry.sublayer.searchterms || []);
                }
            }
            this.setState({searchFilter: [...new Set(searchFilter)].join(",")});
        }
        // Select single search result
        if (this.state.pendingSearches.length === 0 && prevState.pendingSearches.length > 0 && this.state.searchResults.zoomToUniqueResult) {
            const uniqueResults = Object.entries(this.state.searchResults).filter(([key, value]) => value.tot_result_count === 1);
            // If a single result is returned, select it immediately if it is a feature or provider result
            if (uniqueResults.length === 1) {
                const uniqueResult = uniqueResults[0];
                if (uniqueResult[0] === "__fulltext" && uniqueResult[1].results[0].feature) {
                    this.selectFeatureResult(uniqueResult[1].results[0].feature);
                } else if (uniqueResults[0] !== "__fulltext" && uniqueResult[1].results[0].items[0].bbox) {
                    this.selectProviderResult(uniqueResult[1].results[0], uniqueResult[1].results[0].items[0], uniqueResult[0]);
                }
            }
        }
    }
    renderFilterOptions = () => {
        if (!this.state.filterOptionsVisible) {
            return null;
        }
        const haveFulltext = (this.props.theme.searchProviders || []).find(entry => entry.provider === "solr");
        const providerSelection = (
            <ComboBox onChange={value => this.setState({selectedProvider: value})} value={this.state.selectedProvider}>
                <div value="">{LocaleUtils.tr("search.all")}</div>
                {haveFulltext ? (<option value="__fulltext">{LocaleUtils.tr("search.solr")}</option>) : null}
                {Object.entries(this.props.searchProviders).map(([key, prov]) => (
                    <div key={key} value={key}>{prov?.params?.title || (prov.labelmsgid ? LocaleUtils.tr(prov.labelmsgid) : prov.label)}</div>
                ))}
            </ComboBox>
        );
        let searchRegionSelection = null;
        const searchRegions = ConfigUtils.getConfigProp("searchFilterRegions", this.props.theme);
        if (!isEmpty(searchRegions)) {
            searchRegionSelection = (
                <ComboBox onChange={value => this.setFilterRegion(value, searchRegions)} value={this.state.filterRegionName}>
                    <div value="">{LocaleUtils.tr("search.none")}</div>
                    {searchRegions.map((group, gidx) => ([
                        (<div data-group-header={gidx} disabled key={"group" + gidx}>{group.name}</div>),
                        ...group.items.map((item, idx) => (
                            <div data-group={gidx} key={item.name} value={gidx + ":" + idx + ":" + item.name}>{item.name}</div>
                        ))
                    ]))}
                </ComboBox>
            );
        }
        const filterButtons = [
            {key: "Polygon", tooltip: LocaleUtils.trmsg("redlining.polygon"), icon: "polygon", label: LocaleUtils.trmsg("redlining.polygon")},
            {key: "Circle", tooltip: LocaleUtils.trmsg("redlining.circle"), icon: "circle", label: LocaleUtils.trmsg("redlining.circle")}
        ];
        return (
            <div className="searchbox-filter-options">
                <table>
                    <tbody>
                        <tr>
                            <td>{LocaleUtils.tr("search.providerselection")}:</td>
                            <td>{providerSelection}</td>
                        </tr>
                        <tr>
                            <td>{LocaleUtils.tr("search.limittoarea")}:</td>
                            <td>
                                <div className="searchbox-filter-options-geometry">
                                    <ButtonBar active={this.state.filterGeomType} buttons={filterButtons} onClick={this.setFilterGeomType} />
                                    {searchRegionSelection}
                                    <button className="button" onClick={this.clearFilter}>
                                        <Icon icon="clear" />&nbsp;{LocaleUtils.tr("search.clearfilter")}
                                    </button>
                                </div>
                            </td>
                        </tr>
                        {this.state.filterGeomType === 'Circle' ? (
                            <tr>
                                <td>{LocaleUtils.tr("search.circleradius")}:</td>
                                <td><NumberInput disabled={!this.state.filterGeometry} min={1} onChange={this.setCircleRadius} type="text" value={this.state.filterGeometry?.radius || 0}/> m</td>
                            </tr>
                        ) : null}
                    </tbody>
                </table>
            </div>
        );
    };
    setFilterGeomType = (geomType) => {
        this.setState({filterGeomType: geomType, filterRegionName: "", filterGeometry: null});
    };
    setFilterRegion = (value, searchRegions) => {
        if (value) {
            const parts = value.split(":");
            const item = searchRegions[parts[0]].items[parts[1]];
            const geometry = {
                type: "Polygon",
                coordinates: [item.coordinates]
            };
            const mapGeometry = VectorLayerUtils.reprojectGeometry(geometry, item.crs, this.props.map.projection);
            this.setState({filterGeomType: null, filterRegionName: value, filterGeometry: mapGeometry});
        } else {
            this.setState({filterGeomType: null, filterRegionName: "", filterGeometry: null});
        }
    };
    setCircleRadius = (value) => {
        this.setState((state) => ({filterGeometry: {
            ...state.filterGeometry,
            radius: value
        }}));
    };
    clearFilter = () => {
        this.setState({filterGeomType: null, filterRegionName: "", filterGeometry: null});
    };
    renderRecentResults = () => {
        const recentSearches = this.state.recentSearches.filter(entry => entry.toLowerCase().includes(this.state.searchText.toLowerCase()));
        if (isEmpty(recentSearches) || (recentSearches.length === 1 && recentSearches[0].toLowerCase() === this.state.searchText.toLowerCase())) {
            return null;
        }
        return (
            <div key="recent">
                <div className="searchbox-results-section-title" onClick={() => this.toggleSection("recent")} onMouseDown={MiscUtils.killEvent}>
                    <Icon icon={this.isCollapsed("recent") ? "expand" : "collapse"} />{LocaleUtils.tr("searchbox.recent")}
                </div>
                {!this.isCollapsed("recent") ? (
                    <div className="searchbox-results-section-body">
                        {recentSearches.map((entry, idx) => (
                            <div className="searchbox-result" key={"r" + idx} onClick={() => this.searchTextChanged(entry)} onMouseDown={MiscUtils.killEvent}>
                                {entry}
                            </div>
                        ))}
                    </div>
                ) : null}
            </div>
        );
    };
    renderFilters = (searchResults) => {
        if (isEmpty(searchResults.result_counts) || searchResults.result_counts.length < 2) {
            return null;
        }
        const minResultsExanded = ConfigUtils.getConfigProp("minResultsExanded");
        const initialCollapsed = searchResults.tot_result_count < minResultsExanded;
        const collapsed = this.isCollapsed('filter', initialCollapsed);
        const values = searchResults.result_counts.map(entry => entry.filterword + ": " + searchResults.query_text);
        values.sort((a, b) => a.localeCompare(b));
        return (
            <div key="filter">
                <div className="searchbox-results-section-title" onClick={() => this.toggleSection("filter")} onMouseDown={MiscUtils.killEvent}>
                    <Icon icon={collapsed ? "expand" : "collapse"} />{LocaleUtils.tr("searchbox.filter")}
                </div>
                {!collapsed ? (
                    <div className="searchbox-results-section-body">
                        {values.map((value, idx) => {
                            return (
                                <div className="searchbox-result" key={"f" + idx} onClick={() => this.searchTextChanged(value, true)} onMouseDown={MiscUtils.killEvent}>
                                    <span className="searchbox-result-label">{value}</span>
                                </div>
                            );
                        })}
                    </div>
                ) : null}
            </div>
        );
    };
    renderProviderResults = () => {
        const addTitle = LocaleUtils.tr("themeswitcher.addtotheme");
        const addThemes = ConfigUtils.getConfigProp("allowAddingOtherThemes", this.props.theme);
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
                            <div className="searchbox-results-section-title" onClick={() => this.toggleSection(sectionId)} onMouseDown={MiscUtils.killEvent}>
                                <Icon icon={this.isCollapsed(sectionId) ? "expand" : "collapse"} />
                                {group.titlemsgid ? LocaleUtils.tr(group.titlemsgid) : (<span>{group.title}</span>)}
                            </div>
                            {!this.isCollapsed(sectionId) ? (
                                <div className="searchbox-results-section-body">
                                    {group.items.map((entry, idx) => (
                                        <div className="searchbox-result" key={"c" + idx} onClick={() => {this.selectProviderResult(group, entry, provider); this.blur(); }} onMouseDown={MiscUtils.killEvent}>
                                            {entry.thumbnail ? (<img className="searchbox-result-thumbnail" src={entry.thumbnail} />) : null}
                                            {entry.theme ? (<Icon className="searchbox-result-openicon" icon="open" />) : null}
                                            <span className="searchbox-result-label" dangerouslySetInnerHTML={{__html: entry.text.replace(/<br\s*\/>/ig, ' ')}} title={entry.label ?? entry.text} />
                                            {entry.externalLink ? <Icon icon="info-sign" onClick={ev => { MiscUtils.killEvent(ev); this.openUrl(entry.externalLink, entry.target, entry.label ?? entry.text); } } /> : null}
                                            {entry.theme && addThemes ? (<Icon icon="plus" onClick={(ev) => { MiscUtils.killEvent(ev); this.addThemeLayers(entry.layer); this.searchBox.blur(); }} title={addTitle}/>) : null}
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
    };
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
                <div className="searchbox-results-section-title" onClick={() => this.toggleSection("places")} onMouseDown={MiscUtils.killEvent}>
                    <Icon icon={this.isCollapsed("places") ? "expand" : "collapse"} />{LocaleUtils.tr("searchbox.places")}
                </div>
                {!this.isCollapsed("places") ? (
                    <div className="searchbox-results-section-body">
                        {features.map((entry, idx) => (
                            <div className="searchbox-result" key={"p" + idx} onClick={() => { this.selectFeatureResult(entry.feature); this.blur(); }} onMouseDown={MiscUtils.killEvent}>
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
    };
    renderLayers = (searchResults) => {
        const layers = (searchResults.results || []).filter(result => result.dataproduct);
        if (isEmpty(layers)) {
            return null;
        }
        const additionalLayerResults = !isEmpty((searchResults.result_counts || []).filter(entry => entry.dataproduct_id === 'dataproduct'));
        return (
            <div key="layers">
                <div className="searchbox-results-section-title" onClick={() => this.toggleSection("layers")} onMouseDown={MiscUtils.killEvent}>
                    <Icon icon={this.isCollapsed("layers") ? "expand" : "collapse"} />{LocaleUtils.tr("searchbox.layers")}
                </div>
                {!this.isCollapsed("layers") ? (
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
    };
    renderLayer = (dataproduct, idx) => {
        const iconPath = ConfigUtils.getAssetsPath() + '/img/search/';
        const showAbstract = dataproduct.dataproduct_id in (this.state.activeLayerInfo || {});
        return (
            <div key={"p" + idx}>
                <div className={"searchbox-result " + (showAbstract ? "searchbox-result-expandedinfo" : "")} onClick={() => { this.selectLayerResult(dataproduct); this.blur(); }} onMouseDown={MiscUtils.killEvent}>
                    <img src={iconPath + "dataproduct.svg"} />
                    <span className="searchbox-result-label">{dataproduct.display}</span>
                    {dataproduct.dset_info ? (<Icon icon="info-sign" onClick={ev => {MiscUtils.killEvent(ev); this.selectLayerResult(dataproduct, true); }} />) : null}
                </div>
                {showAbstract ? (
                    <div className="searchbox-result-abstract"
                        dangerouslySetInnerHTML={{__html: this.getLayerDescription(this.state.activeLayerInfo[dataproduct.dataproduct_id][0])}}
                    />
                ) : null}
            </div>
        );
    };
    renderLayerGroup = (dataproduct, idx) => {
        const iconPath = ConfigUtils.getAssetsPath() + '/img/search/';
        const showAbstract = dataproduct.dataproduct_id in (this.state.activeLayerInfo || {});
        return [(
            <div key={"g" + idx}>
                <div className={"searchbox-result " + (showAbstract ? "searchbox-result-expandedinfo" : "")} onClick={() => { this.selectLayerResult(dataproduct); this.blur(); }} onMouseDown={MiscUtils.killEvent}>
                    <img onClick={ev => this.toggleLayerGroup(ev, dataproduct.dataproduct_id)} src={iconPath + (this.state.expandedLayerGroup === dataproduct.dataproduct_id ? "layergroup_close" : "layergroup_open") + ".svg"} />
                    <span className="searchbox-result-label">{dataproduct.display}</span>
                    {dataproduct.dset_info ? (<Icon icon="info-sign" onClick={ev => {MiscUtils.killEvent(ev); this.selectLayerResult(dataproduct, true); }} />) : null}
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
    };
    getLayerDescription = (layer) => {
        if (isEmpty(layer.abstract)) {
            return LocaleUtils.tr("searchbox.nodescription");
        } else {
            return MiscUtils.addLinkAnchors(layer.abstract);
        }
    };
    toggleLayerGroup = (ev, dataproductId) => {
        MiscUtils.killEvent(ev);
        this.setState((state) => ({expandedLayerGroup: state.expandedLayerGroup === dataproductId ? null : dataproductId}));
    };
    renderSearchResults = () => {
        if (!this.state.resultsVisible) {
            return false;
        }
        const fulltextResults = this.state.searchResults.__fulltext || {};
        let children = [
            this.renderRecentResults(),
            this.renderFilters(fulltextResults),
            this.renderProviderResults(),
            this.renderPlaces(fulltextResults),
            this.renderLayers(fulltextResults)
        ].filter(element => element);
        if (isEmpty(children)) {
            if (isEmpty(this.state.pendingSearches) && this.state.searchResults.query_text) {
                children = (
                    <div className="searchbox-noresults">{LocaleUtils.tr("search.noresults")}</div>
                );
            } else {
                return null;
            }
        }
        return (
            <div className="searchbox-results" onMouseDown={this.setPreventBlur} ref={MiscUtils.setupKillTouchEvents}>
                {children}
            </div>
        );
    };
    setPreventBlur = () => {
        this.preventBlur = true;
        setTimeout(() => {this.preventBlur = false; return false;}, 100);
    };
    toggleSection = (key) => {
        return this.setState((state) => {
            const newCollapsedSections = {...state.collapsedSections};
            const deflt = (this.props.searchOptions.sectionsDefaultCollapsed || false);
            newCollapsedSections[key] = !(newCollapsedSections[key] ?? deflt);
            return {collapsedSections: newCollapsedSections};
        });
    };
    isCollapsed = (section, deflt = null) => {
        deflt = deflt ?? (this.props.searchOptions.sectionsDefaultCollapsed || false);
        return this.state.collapsedSections[section] ?? deflt;
    };
    render() {
        const placeholder = LocaleUtils.tr("searchbox.placeholder");
        const filterButtonClasses = classnames({
            "button": true,
            "searchbox-filter-button": true,
            "pressed": this.state.filterOptionsVisible || this.state.selectedProvider || this.state.filterGeometry
        });
        return [
            (
                <div className="SearchBox" key="SearchBox">
                    <InputContainer className="searchbox-field">
                        <Icon icon="search" role="prefix" />
                        <input onBlur={this.onBlur} onChange={ev => this.searchTextChanged(ev.target.value)}
                            onFocus={this.onFocus} onKeyDown={this.onKeyDown}
                            placeholder={placeholder} ref={el => { this.searchBox = el; }}
                            role="input"
                            type="text" value={this.state.searchText} />
                        {this.state.pendingSearches.length > 0 ? (<Spinner role="suffix" />) : (<Icon icon="remove" onClick={this.clear} role="suffix" />)}
                    </InputContainer>
                    {this.props.searchOptions.allowSearchFilters ? (
                        <button className={filterButtonClasses} onClick={() => this.toggleFilterOptions(!this.state.filterOptionsVisible)} title={LocaleUtils.tr("search.filter")}>
                            <Icon icon="filter" />
                            <Icon icon="chevron-down" />
                        </button>
                    ) : null}
                    {this.renderSearchResults()}
                    {this.renderFilterOptions()}
                </div>
            ),
            (
                <MapSelection
                    active={this.state.filterOptionsVisible && this.state.filterGeomType !== null}
                    geomType={this.state.filterGeomType} geometry={this.state.filterGeometry}
                    geometryChanged={(geom) => this.setState({filterGeometry: geom})}
                    key="MapSelection" measure={this.state.filterGeomType === "Circle"}
                />
            )
        ];
    }
    toggleFilterOptions = (visible) => {
        this.setState({filterOptionsVisible: visible});
    };
    searchTextChanged = (text, expandSections = false) => {
        if (this.props.layers.find(layer => layer.id === 'searchselection')) {
            this.props.removeLayer('searchselection');
        }
        const newState = {searchText: text, expandedLayerGroup: null, activeLayerInfo: null, pendingSearches: [], searchSession: null};
        if (expandSections) {
            newState.collapsedSections = {};
        }
        this.setState(newState);
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(this.startSearch, 250);
    };
    onFocus = () => {
        this.setState({resultsVisible: true});
        if (this.searchBox) {
            this.searchBox.select();
        }
        if (isEmpty(this.state.searchResults) && this.props.theme) {
            this.startSearch();
        }
        this.toggleFilterOptions(false);
    };
    onBlur = () => {
        if (this.preventBlur && this.searchBox) {
            this.searchBox.focus();
        } else {
            this.setState({resultsVisible: false, collapsedSections: {}, expandedLayerGroup: null, activeLayerInfo: null});
        }
    };
    onKeyDown = (ev) => {
        if (ev.keyCode === 27 && this.searchBox) {
            if (this.searchBox.selectionStart !== this.searchBox.selectionEnd) {
                this.searchBox.setSelectionRange(this.searchBox.value.length, this.searchBox.value.length);
            } else {
                this.searchBox.blur();
            }
        }
    };
    clear = () => {
        if (this.searchBox) {
            this.searchBox.blur();
        }
        this.setState({searchText: '', searchResults: {}, selectedProvider: '', filterRegionName: "", filterGeometry: null});
        this.props.removeLayer('searchselection');
        UrlParams.updateParams({hp: undefined, hf: undefined, hc: undefined});
    };
    startSearch = (zoomToUniqueResult = false) => {
        let availableProviders = this.props.searchProviders;
        let fulltextSearchEnabled = (this.props.theme.searchProviders || []).find(entry => entry.provider === "solr");
        if (this.state.selectedProvider) {
            if (this.state.selectedProvider === "__fulltext") {
                fulltextSearchEnabled = true;
                availableProviders = {};
            } else {
                fulltextSearchEnabled = false;
                availableProviders = {
                    [this.state.selectedProvider]: this.props.searchProviders[this.state.selectedProvider]
                };
            }
        }
        const service = (ConfigUtils.getConfigProp("searchServiceUrl") || "").replace(/\/$/g, "") + '/';
        // eslint-disable-next-line
        const searchText = this.state.searchText.trim();
        if (isEmpty(searchText)) {
            this.setState({searchResults: {}});
            return;
        }
        const searchSession = uuidv1();
        const pendingSearches = [];
        // Collect pending searches
        if (fulltextSearchEnabled) {
            pendingSearches.push("__fulltext");
        }
        pendingSearches.push(...Object.keys(availableProviders));
        this.setState({
            searchResults: {query_text: searchText, zoomToUniqueResult: zoomToUniqueResult},
            searchSession: searchSession,
            pendingSearches: pendingSearches
        });
        // Fulltext search
        if (fulltextSearchEnabled) {
            const params = {
                searchtext: searchText,
                filter: this.state.searchFilter,
                limit: this.props.searchOptions.resultLimit
            };
            axios.get(service, {params}).then(response => {
                const results = this.filterFulltextResults(response.data);
                const searchResults = {...results, query_text: searchText};
                searchResults.tot_result_count = (searchResults.result_counts || []).reduce((res, entry) => res + (entry.count || 0), 0);
                this.addSearchResults(searchSession, "__fulltext", searchResults);
            }).catch(e => {
                // eslint-disable-next-line
                console.warn("Search failed: " + e);
                this.addSearchResults(searchSession, "__fulltext", {results: [], tot_result_count: 0});
            });
        }
        // Additional provider searches
        const searchParams = {
            mapcrs: this.props.map.projection,
            displaycrs: this.props.displaycrs,
            lang: LocaleUtils.lang(),
            theme: this.props.theme,
            filterPoly: this.state.filterGeometry?.coordinates?.[0],
            filterBBox: this.state.filterGeometry ? VectorLayerUtils.computeFeatureBBox(this.state.filterGeometry) : null
        };
        Object.entries(availableProviders).forEach(([key, entry]) => {
            entry.onSearch(searchText, {...searchParams, cfgParams: entry.params}, (response) => {
                const results = entry.handlesGeomFilter ? response.results : this.filterProviderResults(response.results);
                const count = response.results.reduce((tot, cur) => (tot + cur.items.length), 0);
                this.addSearchResults(searchSession, key, {results: results, tot_result_count: count});
            }, axios);
        });
    };
    filterFulltextResults = (data) => {
        if (!this.state.filterGeometry) {
            return data;
        }
        const filterPolygon = this.state.filterGeometry.coordinates[0];
        data.results = data.results.filter(result => {
            if (!result.feature || !result.feature.bbox) {
                return true;
            }
            const [xmin, ymin, xmax, ymax] = CoordinatesUtils.reprojectBbox(result.feature.bbox, "EPSG:" + result.feature.srid, this.props.map.projection);
            const intersects = polygonIntersectTest([[xmin, ymin], [xmax, ymin], [xmax, ymax], [xmin, ymax], [xmin, ymin]], filterPolygon);
            if (!intersects) {
                data.result_counts.find(entry => entry.dataproduct_id === result.feature.dataproduct_id).count -= 1;
            }
            return intersects;
        });
        return data;
    };
    filterProviderResults = (results) => {
        if (!this.state.filterGeometry) {
            return results;
        }
        const filterPolygon = this.state.filterGeometry.coordinates[0];
        return results.map(group => {
            const newItems = group.items.filter(item => {
                const resultType = item.type || SearchResultType.PLACE;
                if (resultType !== SearchResultType.PLACE) {
                    return true;
                }
                let geometry = null;
                if (item.geometry) {
                    geometry = VectorLayerUtils.reprojectGeometry(item.geometry, item.crs, this.props.map.projection);
                } else {
                    geometry = {type: 'Point', coordinates: CoordinatesUtils.reproject([item.x, item.y], item.crs, this.props.map.projection)};
                }
                if (geometry.type === 'Polygon') {
                    return polygonIntersectTest(geometry.coordinates[0], filterPolygon);
                } else if (item.bbox) {
                    const [xmin, ymin, xmax, ymax] = CoordinatesUtils.reprojectBbox(item.bbox, item.crs, this.props.map.projection);
                    return polygonIntersectTest([[xmin, ymin], [xmax, ymin], [xmax, ymax], [xmin, ymax], [xmin, ymin]], filterPolygon);
                } else if (geometry.type === 'Point') {
                    return pointInPolygon(geometry.coordinates, filterPolygon);
                }
                return true;
            });
            if (newItems.length > 0) {
                return {...group, items: newItems};
            }
            return null;
        }).filter(Boolean);
    };
    addSearchResults = (searchSession, searchId, results) => {
        this.setState((state) => {
            if (searchSession !== state.searchSession) {
                return {};
            }
            const pendingSearches = state.pendingSearches.filter(entry => entry !== searchId);
            const searchResults = {...state.searchResults, [searchId]: results};
            return {
                searchResults: searchResults,
                pendingSearches: pendingSearches
            };
        });
    };
    updateRecentSearches = () => {
        if (!this.state.searchResults || !this.state.searchResults.query_text) {
            return;
        }
        const text = this.state.searchResults.query_text;
        if (!this.state.recentSearches.includes(text)) {
            this.setState((state) => ({recentSearches: [text, ...state.recentSearches.slice(0, 4)]}));
        }
    };
    blur = () => {
        if (this.searchBox) {
            this.searchBox.blur();
        }
    };
    setProviderResult = (text, provider, group, result) => {
        const results = {
            query_text: text,
            [provider]: {
                results: [{...group, items: [result]}],
                tot_result_count: 1
            }
        };
        this.setState({
            searchText: text,
            searchResults: results
        });
    };
    selectProviderResult = (group, result, provider, zoom = true) => {
        this.setProviderResult(result.text.replace(/<\/?\w+\s*\/?>/g, ''), provider, group, result);
        this.updateRecentSearches();
        const resultType = result.type || SearchResultType.PLACE;
        if (resultType === SearchResultType.PLACE) {
            const label = this.props.searchOptions.hideResultLabels ? '' : (result.label ?? result.text ?? '').replace(/<\/?\w+\s*\/?>/g, '');
            if (this.props.searchProviders[provider].getResultGeometry) {
                this.props.searchProviders[provider].getResultGeometry(result, (response) => { this.showProviderResultGeometry(result, response, label, zoom); }, axios);
            } else {
                this.zoomToResult(result, zoom);
                const geometry = result.geometry || {type: 'Point', coordinates: [result.x, result.y]};
                const feature = {
                    geometry: geometry,
                    properties: { label: label },
                    styleName: geometry.type === 'Point' ? 'marker' : 'default',
                    styleOptions: this.props.searchOptions.highlightStyle || {},
                    crs: result.crs,
                    id: 'searchmarker'
                };
                const layer = {
                    id: "searchselection",
                    role: LayerRole.SELECTION
                };
                this.props.addLayerFeatures(layer, [feature], true);
            }
            UrlParams.updateParams({hp: undefined, hf: undefined, hc: "1"});
            this.props.logAction("SEARCH_TEXT", {searchText: this.state.searchText});
            this.props.logAction("SEARCH_RESULT_SELECTED", {place: result.text});
        } else if (resultType === SearchResultType.THEMELAYER) {
            this.props.addThemeSublayer(result.layer);
            // Show layer tree to notify user that something has happened
            this.props.setCurrentTask('LayerTree');
        } else if (resultType === SearchResultType.EXTERNALLAYER) {
            if (result.theme) {
                if (this.props.searchOptions.showLayerAfterChangeTheme) {
                    this.props.setCurrentTask('LayerTree');
                }
                this.props.setCurrentTheme(result.theme, this.props.themes);
            } else {
                this.addThemeLayers(result.layer);
            }
        } else if (resultType === SearchResultType.THEME) {
            if (this.props.searchOptions.showLayerAfterChangeTheme) {
                this.props.setCurrentTask('LayerTree');
            }
            this.props.setCurrentTheme(result.theme, this.props.themes);
        }
    };
    addThemeLayers = (layer) => {
        // Check if layer is already in the LayerTree
        const sublayers = LayerUtils.getSublayerNames(layer);
        const existing = this.props.layers.find(l => {
            return l.type === layer.type && l.url === layer.url && !isEmpty(LayerUtils.getSublayerNames(l).filter(v => sublayers.includes(v)));
        });
        if (existing) {
            const existingLayerName = (layer.sublayers || []).length === 1 ? layer.sublayers[0].title : layer.title;
            const text = LocaleUtils.tr("search.existinglayer") + ": " + existingLayerName;
            this.props.showNotification("existinglayer", text);
        } else {
            this.props.addLayer(layer);
        }
        if (this.props.searchOptions.zoomToLayers && layer.bbox) {
            this.props.zoomToExtent(layer.bbox.bounds, layer.bbox.crs);
        }
        // Show layer tree to notify user that something has happened
        this.props.setCurrentTask('LayerTree');
    };
    showProviderResultGeometry = (item, response, text, zoom) => {
        if (!isEmpty(response.geometry)) {
            let features = [];
            const highlightFeature = response.geometry.coordinates ? {
                type: "Feature", geometry: response.geometry
            } : VectorLayerUtils.wktToGeoJSON(response.geometry, response.crs, this.props.map.projection);
            if (highlightFeature) {
                const isPoint = response.geometry.type === 'Point';
                highlightFeature.styleName = isPoint ? 'marker' : 'default';
                highlightFeature.styleOptions = this.props.searchOptions.highlightStyle || {};
                const center = VectorLayerUtils.getFeatureCenter(highlightFeature);
                if (!item.x || !item.y) {
                    item.x = center[0];
                    item.y = center[1];
                }
                if (!item.bbox) {
                    item.bbox = VectorLayerUtils.computeFeatureBBox(highlightFeature);
                }

                features = [highlightFeature];
                if (!isPoint && !response.hidemarker) {
                    features.push(this.createMarker(center, this.props.map.projection, text));
                }
            } else {
                features = [this.createMarker([item.x, item.y], item.crs, text)];
            }
            this.zoomToResult(item, zoom);

            const layer = {
                id: "searchselection",
                role: LayerRole.SELECTION
            };
            this.props.addLayerFeatures(layer, features, true);
        }
    };
    zoomToResult = (result, zoom) => {
        if (zoom) {
            if (result.bbox && !(result.bbox[0] === result.bbox[2] && result.bbox[1] === result.bbox[3])) {
                this.props.zoomToExtent(result.bbox, result.crs);
            } else {
                const maxZoom = MapUtils.computeZoom(this.props.map.scales, this.props.theme.minSearchScaleDenom || this.props.searchOptions.minScaleDenom);
                this.props.zoomToPoint([result.x, result.y], maxZoom, result.crs);
            }
        } else {
            this.props.panTo([result.x, result.y], result.crs);
        }
    };
    createMarker = (center, crs, text) => {
        return {
            geometry: {type: 'Point', coordinates: center},
            styleName: 'marker',
            id: 'searchmarker',
            crs: crs,
            properties: { label: text }
        };
    };
    setFeatureResult = (text, result) => {
        this.setState(state => {
            const results = {
                query_text: text,
                __fulltext: {
                    result_counts: [{
                        ...state.searchResults.__fulltext.result_counts.find(entry => entry.dataproduct_id === result.dataproduct_id),
                        count: 1
                    }],
                    tot_result_count: 1,
                    results: [{feature: result}]
                }
            };
            return {
                searchText: text,
                searchResults: results
            };
        });
    };
    selectFeatureResult = (result) => {
        this.setFeatureResult(result.display, result);
        this.updateRecentSearches();
        // URL example: /api/data/v1/ch.so.afu.fliessgewaesser.netz/?filter=[["gewissnr","=",1179]]
        let filter = `[["${result.id_field_name}","=",`;
        if (typeof(result.feature_id) === 'string') {
            filter += `"${result.feature_id}"]]`;
        } else {
            filter += `${result.feature_id}]]`;
        }
        const DATA_URL = ConfigUtils.getConfigProp("searchDataServiceUrl").replace(/\/$/g, "");
        axios.get(DATA_URL + "/" + result.dataproduct_id + "/?filter=" + filter).then(response => this.showFeatureGeometry(response.data, undefined, result.display));
        UrlParams.updateParams({hp: result.dataproduct_id, hf: filter, hc: undefined, ht: result.display});

        this.props.logAction("SEARCH_TEXT", {searchText: this.state.searchText});
        this.props.logAction("SEARCH_RESULT_SELECTED", {feature: result.display});
    };
    showFeatureGeometry = (data, scale = undefined, label = "") => {
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
        if (!isEmpty(data.features)) {
            const styleName = data.features[0].geometry?.type === 'Point' ? 'marker' : 'default';
            data.features[0].properties = {...data.features[0].properties, label: label};
            data.features[0].id = 'searchmarker';
            data.features[0].styleName = styleName;
            data.features[0].styleOptions = this.props.searchOptions.highlightStyle || {};
        }
        this.props.addLayerFeatures(layer, data.features, true);
    };
    setLayerResult = (text, result) => {
        const results = {
            query_text: text,
            __fulltext: {
                result_counts: [],
                tot_result_count: 0,
                results: [{dataproduct: result}]
            }
        };
        this.setState({
            searchText: text,
            searchResults: results
        });
    };
    selectLayerResult = (result, info = false) => {
        if (!info) {
            this.setLayerResult(result.display, result);
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
    };
    addLayer = (item, data) => {
        if (!isEmpty(data[item.dataproduct_id])) {
            this.props.addThemeSublayer({sublayers: data[item.dataproduct_id]});
            // Show layer tree to notify user that something has happened
            this.props.setCurrentTask('LayerTree');
        }
    };
    openUrl = (url, target, title) => {
        if (target === "iframe") {
            target = ":iframedialog:externallinkiframe";
        }
        this.props.openExternalUrl(url, target, {title: title});
    };
}

export default (searchProviders) => {
    const providersSelector = searchProvidersSelector(searchProviders);
    return connect(
        createSelector([state => state, displayCrsSelector, providersSelector], (state, displaycrs, searchproviders) => ({
            map: state.map,
            layers: state.layers.flat,
            theme: state.theme.current,
            themes: state.theme.themes,
            localConfig: state.localConfig,
            selection: state.selection,
            displaycrs: displaycrs,
            searchProviders: searchproviders
        })), {
            addThemeSublayer: addThemeSublayer,
            addLayer: addLayer,
            addLayerFeatures: addLayerFeatures,
            removeLayer: removeLayer,
            setCurrentTask: setCurrentTask,
            zoomToExtent: zoomToExtent,
            zoomToPoint: zoomToPoint,
            panTo: panTo,
            logAction: logAction,
            setCurrentTheme: setCurrentTheme,
            showNotification: showNotification,
            openExternalUrl: openExternalUrl
        }
    )(SearchBox);
};
