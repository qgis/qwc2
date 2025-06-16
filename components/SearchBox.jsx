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

import {LayerRole, addLayerFeatures, addThemeSublayer, changeLayerProperty, removeLayer, addLayer} from '../actions/layers';
import {logAction} from '../actions/logging';
import {panTo, zoomToExtent, zoomToPoint} from '../actions/map';
import {setCurrentTask} from '../actions/task';
import {setCurrentTheme} from '../actions/theme';
import {openExternalUrl, showNotification} from '../actions/windows';
import searchProvidersSelector from '../selectors/searchproviders';
import ConfigUtils from '../utils/ConfigUtils';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';
import MiscUtils from '../utils/MiscUtils';
import {UrlParams} from '../utils/PermaLinkUtils';
import {FulltextSearch, SearchResultType} from '../utils/SearchProviders';
import VectorLayerUtils from '../utils/VectorLayerUtils';
import Icon from './Icon';
import MapSelection from './MapSelection';
import ButtonBar from './widgets/ButtonBar';
import ComboBox from './widgets/ComboBox';
import InputContainer from './widgets/InputContainer';
import NumberInput from './widgets/NumberInput';
import Spinner from './widgets/Spinner';

import './style/SearchBox.css';

class SearchBox extends React.Component {
    static propTypes = {
        addLayer: PropTypes.func,
        addLayerFeatures: PropTypes.func,
        addThemeSublayer: PropTypes.func,
        changeLayerProperty: PropTypes.func,
        layers: PropTypes.array,
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
            showHighlightMarker: PropTypes.bool,
            showLayerAfterChangeTheme: PropTypes.bool,
            showLayerResultsBeforePlaces: PropTypes.bool,
            showResultInSearchText: PropTypes.bool,
            zoomToLayers: PropTypes.bool
        }),
        searchProviders: PropTypes.object,
        setCurrentTask: PropTypes.func,
        setCurrentTheme: PropTypes.func,
        showNotification: PropTypes.func,
        startupParams: PropTypes.object,
        theme: PropTypes.object,
        themes: PropTypes.object,
        zoomToExtent: PropTypes.func,
        zoomToPoint: PropTypes.func
    };
    state = {
        searchText: "",
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
            const hp = this.props.startupParams.hp;
            const hf = this.props.startupParams.hf;
            const st = this.props.startupParams.st || this.props.startupParams.ht || "";
            if (hp && (hf || st)) {
                this.setState({searchText: st});
                FulltextSearch.handleHighlightParameters(hp, hf, st, (item, result) => {
                    this.showResultGeometry(item, result, this.props.startupParams.s);
                });
            } else {
                this.setState({searchText: st}, () => this.startSearch(null, true));
            }
            UrlParams.updateParams({hp: undefined, hf: undefined, ht: undefined, st: undefined});
        } else if (this.props.theme !== prevProps.theme) {
            this.clear();
        }
        // Trigger search when closing filter options
        if (!this.state.filterOptionsVisible && prevState.filterOptionsVisible) {
            this.searchTextChanged(this.state.searchText);
        }
    }
    renderFilterOptions = () => {
        if (!this.state.filterOptionsVisible) {
            return null;
        }
        const providerSelection = (
            <ComboBox onChange={value => this.setState({selectedProvider: value})} value={this.state.selectedProvider}>
                <div value="">{LocaleUtils.tr("search.all")}</div>
                {Object.entries(this.props.searchProviders).map(([key, prov]) => (
                    <div key={key} value={key}>{prov?.params?.title || (prov.label ?? LocaleUtils.tr(prov.labelmsgid))}</div>
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
            {key: "Polygon", tooltip: LocaleUtils.tr("redlining.polygon"), icon: "polygon", label: LocaleUtils.tr("redlining.polygon")},
            {key: "Circle", tooltip: LocaleUtils.tr("redlining.circle"), icon: "circle", label: LocaleUtils.tr("redlining.circle")}
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
                                <div className="searchbox-filter-options-geometry controlgroup">
                                    <ButtonBar active={this.state.filterGeomType} buttons={filterButtons} onClick={this.setFilterGeomType} />
                                    {searchRegionSelection}
                                    <button className="button" onClick={this.clearFilter} title={LocaleUtils.tr("search.clearfilter")}>
                                        <Icon icon="clear" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                        {this.state.filterGeomType === 'Circle' ? (
                            <tr>
                                <td>{LocaleUtils.tr("search.circleradius")}:</td>
                                <td><NumberInput disabled={!this.state.filterGeometry} min={1} mobile onChange={this.setCircleRadius} suffix=" m" value={this.state.filterGeometry?.radius || 0}/></td>
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
    renderResultsMenu = () => {
        if (!this.state.resultsVisible) {
            return false;
        }
        let children = [
            this.renderRecentResults(),
            this.renderFilters(),
            this.renderResults()
        ];
        children = children.filter(child => !isEmpty(child));
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
    renderRecentResults = () => {
        const recentSearches = this.state.recentSearches.filter(entry => entry.toLowerCase().includes(this.state.searchText.toLowerCase()));
        if (isEmpty(recentSearches) || (recentSearches.length === 1 && recentSearches[0].toLowerCase() === this.state.searchText.toLowerCase())) {
            return null;
        }
        return (
            <div key="recent">
                <div className="searchbox-results-section-title" onClick={() => this.toggleSection("recent")} onMouseDown={MiscUtils.killEvent}>
                    <Icon icon={this.isCollapsed("recent") ? "expand" : "collapse"} />{LocaleUtils.tr("search.recent")}
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
    renderFilters = () => {
        return Object.entries(this.state.searchResults).map(([provider, results]) => {
            if (isEmpty(results.result_counts) || results.result_counts.length < 2) {
                return null;
            }
            const collapsed = this.isCollapsed('filter', false);
            const values = results.result_counts.map(entry => entry.filterword + ": " + this.state.searchResults.query_text);
            values.sort((a, b) => a.localeCompare(b));
            return (
                <div key="filter">
                    <div className="searchbox-results-section-title" onClick={() => this.toggleSection("filter")} onMouseDown={MiscUtils.killEvent}>
                        <Icon icon={collapsed ? "expand" : "collapse"} />{LocaleUtils.tr("search.filter")}
                    </div>
                    {!collapsed ? (
                        <div className="searchbox-results-section-body">
                            {values.map((value, idx) => {
                                return (
                                    <div className="searchbox-result" key={"f" + idx} onClick={() => this.searchTextChanged(value, true, provider)} onMouseDown={MiscUtils.killEvent}>
                                        <span className="searchbox-result-label">{value}</span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : null}
                </div>
            );
        }).filter(Boolean);
    };
    renderResults = () => {
        const resultRenderers = {
            [SearchResultType.PLACE]: this.renderPlaceResult,
            [SearchResultType.THEMELAYER]: this.renderThemeLayerResult,
            [SearchResultType.THEME]: this.renderThemeResult
        };
        const layersBeforePlaces = this.props.searchOptions.showLayerResultsBeforePlaces;
        const priorities = {
            [SearchResultType.PLACE]: layersBeforePlaces ? 0 : 2,
            [SearchResultType.THEMELAYER]: layersBeforePlaces ? 2 : 1,
            [SearchResultType.THEME]: layersBeforePlaces ? 1 : 0
        };
        const results = Object.keys(this.props.searchProviders).reduce((result, provider) => {
            if (!this.state.searchResults[provider]) {
                return result;
            }
            return result.concat(this.state.searchResults[provider].results.map(group => {
                const sectionId = provider + ":" + group.id;
                let moreLabel = null;
                if (group.resultCount > 0 && group.resultCount > group.items.length) {
                    moreLabel = LocaleUtils.tr("search.more", group.resultCount - group.items.length);
                } else if (group.resultCount === -1) {
                    moreLabel = LocaleUtils.tr("search.unknownmore");
                }
                if (group.items.length === 0) {
                    return null;
                }
                const renderer = resultRenderers[group.type ?? SearchResultType.PLACE];
                if (!renderer) {
                    return null;
                }
                const priority = priorities[group.type ?? SearchResultType.PLACE];
                return {
                    priority: priority * 1000000 + (group.priority || 0),
                    title: group.title ?? LocaleUtils.tr(group.titlemsgid),
                    tree: (
                        <div key={sectionId}>
                            <div className="searchbox-results-section-title" onClick={() => this.toggleSection(sectionId)} onMouseDown={MiscUtils.killEvent}>
                                <Icon icon={this.isCollapsed(sectionId) ? "expand" : "collapse"} />
                                <span>{group.title ?? LocaleUtils.tr(group.titlemsgid)}</span>
                            </div>
                            {!this.isCollapsed(sectionId) ? (
                                <div className="searchbox-results-section-body">
                                    {group.items.map((entry) => renderer(provider, group, entry))}
                                    {moreLabel ? (
                                        <div className="searchbox-more-results">
                                            {moreLabel}
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                    )
                };
            }));
        }, []).filter(Boolean);
        results.sort((a, b) => {
            if (b.priority !== a.priority) {
                return (b.priority - a.priority);
            } else {
                return b.title.localeCompare(a.title);
            }
        });
        return isEmpty(results) ? null : results.map(entry => entry.tree);
    };
    renderPlaceResult = (provider, group, result) => {
        const key = provider + ":" + group.id + ":" + result.id;
        return (
            <div className="searchbox-result" key={key} onClick={() => {this.selectPlaceResult(provider, group, result); this.blur(); }} onMouseDown={MiscUtils.killEvent}>
                {result.thumbnail ? (<img className="searchbox-result-thumbnail" onError={(ev) => this.loadFallbackResultImage(ev, result)} src={result.thumbnail} />) : null}
                <span className="searchbox-result-label" dangerouslySetInnerHTML={{__html: result.text.replace(/<br\s*\/>/ig, ' ')}} title={result.label ?? result.text} />
                {result.externalLink ? <Icon icon="info-sign" onClick={ev => {MiscUtils.killEvent(ev); this.openUrl(result.externalLink, result.target, result.label ?? result.text);} } /> : null}
            </div>
        );
    };
    renderThemeLayerResult = (provider, group, result, parent = null) => {
        const key = provider + ":" + group.id + ":" + result.id;
        const addThemes = ConfigUtils.getConfigProp("allowAddingOtherThemes", this.props.theme);
        let icon = null;
        if (result.sublayers) {
            const toggleLayerGroup = () => {
                this.setState((state) => ({expandedLayerGroup: state.expandedLayerGroup === key ? null : key}));
            };
            icon = (<Icon className="searchbox-result-thumbnail" icon={this.state.expandedLayerGroup === key ? "minus" : "plus"} onClick={ev => {MiscUtils.killEvent(ev); toggleLayerGroup();}} />);
        } else if (result.thumbnail) {
            icon = (<img className="searchbox-result-thumbnail" onError={(ev) => this.loadFallbackResultImage(ev, result)} src={result.thumbnail} />);
        }
        const selectResult = result.theme ? this.selectThemeResult : this.selectThemeLayerResult;
        return (
            <div key={key}>
                <div className="searchbox-result" onClick={() => {selectResult(provider, group, result); this.blur(); }} onMouseDown={MiscUtils.killEvent}>
                    {icon}
                    {result.theme ? (<Icon className="searchbox-result-openicon" icon="open" />) : null}
                    <span className="searchbox-result-label" dangerouslySetInnerHTML={{__html: result.text.replace(/<br\s*\/>/ig, ' ')}} title={result.label ?? result.text} />
                    {result.theme && addThemes ? (<Icon icon="plus" onClick={(ev) => {MiscUtils.killEvent(ev); this.selectThemeLayerResult(provider, group, result); this.blur(); }} title={LocaleUtils.tr("themeswitcher.addtotheme")}/>) : null}
                    {result.info ? <Icon icon="info-sign" onClick={ev => {MiscUtils.killEvent(ev); this.toggleLayerInfo(provider, group, result, key, parent);} } /> : null}
                </div>
                {this.state.activeLayerInfo === key ? (
                    <div className="searchbox-result-abstract"
                        dangerouslySetInnerHTML={{__html: MiscUtils.addLinkAnchors(result.layer?.abstract || "") || LocaleUtils.tr("search.nodescription")}}
                    />
                ) : null}
                {this.state.expandedLayerGroup === key ? (
                    <div className="searchbox-result-group">{result.sublayers.map(sublayer => this.renderThemeLayerResult(provider, group, sublayer, result.id))}</div>
                ) : null}
            </div>
        );
    };
    renderThemeResult = (provider, group, result) => {
        const addThemes = ConfigUtils.getConfigProp("allowAddingOtherThemes", this.props.theme);
        return (
            <div className="searchbox-result" key={provider + ":" + group.id + ":" + result.id} onClick={() => {this.selectThemeResult(provider, group, result); this.blur();}} onMouseDown={MiscUtils.killEvent}>
                {result.thumbnail ? (<img className="searchbox-result-thumbnail" onError={(ev) => this.loadFallbackResultImage(ev, result)} src={result.thumbnail} />) : null}
                <Icon className="searchbox-result-openicon" icon="open" />
                <span className="searchbox-result-label" dangerouslySetInnerHTML={{__html: result.text.replace(/<br\s*\/>/ig, ' ')}} title={result.label ?? result.text} />
                {result.theme && addThemes ? (<Icon icon="plus" onClick={(ev) => {MiscUtils.killEvent(ev); this.addThemeLayers(result.layer); this.blur();}} title={LocaleUtils.tr("themeswitcher.addtotheme")}/>) : null}
            </div>
        );
    };
    selectPlaceResult = (provider, group, result) => {
        const resultText = result.text.replace(/<\/?\w+\s*\/?>/g, '');
        if (this.props.searchOptions.showResultInSearchText !== false) {
            // Show selected result text in search field
            this.setState({
                searchText: resultText,
                searchResults: {
                    query_text: resultText,
                    [provider]: {
                        results: [{...group, items: [result]}],
                        tot_result_count: 1
                    }
                }
            });
        }
        this.updateRecentSearches();
        if (this.props.searchProviders[provider].getResultGeometry) {
            this.props.searchProviders[provider].getResultGeometry(result, (response) => { this.showResultGeometry(result, response); }, axios);
        } else {
            // Display marker
            this.showResultGeometry(result, {feature: {type: "Feature", geometry: {type: "Point", coordinates: [result.x, result.y]}}, crs: result.crs});
        }
        if (result.dataproduct_id) {
            const quot = typeof(result.id) === 'string' ? '"' : '';
            const filter = `[["${result.id_field_name}","=", ${quot}${result.id}${quot}]]`;
            UrlParams.updateParams({hp: result.dataproduct_id, hf: filter, st: resultText});
        } else {
            UrlParams.updateParams({hp: undefined, hf: undefined, st: resultText});
        }
        this.props.logAction("SEARCH_TEXT", {searchText: this.state.searchText});
        this.props.logAction("SEARCH_RESULT_SELECTED", {place: resultText});

        // Enable layer
        if (result.layername) {
            const path = [];
            let sublayer = null;
            const layer = this.props.layers.find(l => {
                return l.role === LayerRole.THEME && (sublayer = LayerUtils.searchSubLayer(l, 'name', result.layername, path));
            });
            if (layer && sublayer) {
                this.props.changeLayerProperty(layer.id, "visibility", true, path, 'both');
            }
        }

    };
    selectThemeLayerResult = (provider, group, result) => {
        if (result.layer) {
            if (result.theme) {
                this.addThemeLayers(result.layer);
            } else {
                this.props.addThemeSublayer(result.layer);
            }
            // Show layer tree to notify user that something has happened
            this.props.setCurrentTask('LayerTree');
        } else if (this.props.searchProviders[provider].getLayerDefinition) {
            this.props.searchProviders[provider].getLayerDefinition(result, (layer) => {
                if (layer) {
                    if (result.theme) {
                        this.addThemeLayers(layer);
                    } else {
                        this.props.addThemeSublayer({sublayers: [layer]});
                    }
                    // Show layer tree to notify user that something has happened
                    this.props.setCurrentTask('LayerTree');
                }
            }, axios);
        }
    };
    selectThemeResult = (provider, group, result) => {
        this.props.setCurrentTheme(result.theme, this.props.themes);
        if (this.props.searchOptions.showLayerAfterChangeTheme) {
            this.props.setCurrentTask('LayerTree');
        }
    };
    loadFallbackResultImage = (ev, item) => {
        if ((item.type ?? SearchResultType.PLACE) === SearchResultType.PLACE) {
            const iconPath = ConfigUtils.getAssetsPath() + '/img/search/';
            if (!ev.target.src.endsWith(iconPath + "feature.svg")) {
                ev.target.src = iconPath + "feature.svg";
            }
        }
    };
    toggleLayerInfo = (provider, group, result, key, parent) => {
        const setResultLayerAndActiveInfo = (layer) => {
            // Embed returned layer into result item, so that layer info is read from item.layer.abstract
            this.setState((state) => ({
                searchResults: {
                    ...state.searchResults,
                    [provider]: {
                        ...state.searchResults[provider],
                        results: state.searchResults[provider].results.map(g => {
                            if (g.id === group.id) {
                                return {...g, items: g.items.map(item => {
                                    if (item.id === result.id) {
                                        return {...item, layer: layer};
                                    } else if (item.id === parent) {
                                        return {
                                            ...item,
                                            sublayers: item.sublayers.map(sublayer => {
                                                if (sublayer.id === result.id) {
                                                    return {...sublayer, layer: layer};
                                                } else {
                                                    return sublayer;
                                                }
                                            })
                                        };
                                    } else {
                                        return item;
                                    }
                                })};
                            } else {
                                return g;
                            }
                        })
                    }
                },
                activeLayerInfo: key
            }));
        };
        this.setState((state) => {
            if (state.activeLayerInfo === key) {
                return {activeLayerInfo: null};
            } else {
                if (!result.layer && this.props.searchProviders[provider].getLayerDefinition) {
                    this.props.searchProviders[provider].getLayerDefinition(result, setResultLayerAndActiveInfo, axios);
                    return {};
                } else {
                    return {activeLayerInfo: key};
                }
            }
        });
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
        const placeholder = LocaleUtils.tr("search.placeholder");
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
                            onFocus={this.onFocus}
                            placeholder={placeholder} ref={el => { this.searchBox = el; }}
                            role="input"
                            type="text" value={this.state.searchText} />
                        {this.state.pendingSearches.length > 0 ? (<Spinner role="suffix" />) : (<Icon icon="clear" onClick={this.clear} role="suffix" />)}
                    </InputContainer>
                    {this.props.searchOptions.allowSearchFilters ? (
                        <button className={filterButtonClasses} onClick={() => this.toggleFilterOptions(!this.state.filterOptionsVisible)} title={LocaleUtils.tr("search.filter")}>
                            <Icon icon="filter" />
                            <Icon icon="chevron-down" />
                        </button>
                    ) : null}
                    {this.renderResultsMenu()}
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
    searchTextChanged = (text, expandSections = false, provider = null) => {
        if (this.props.layers.find(layer => layer.id === 'searchselection')) {
            this.props.removeLayer('searchselection');
        }
        const newState = {searchText: text, expandedLayerGroup: null, activeLayerInfo: null, pendingSearches: [], searchSession: null};
        if (expandSections) {
            newState.collapsedSections = {};
        }
        this.setState(newState);
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => this.startSearch(provider), 250);
    };
    onFocus = () => {
        this.setState({resultsVisible: true});
        if (this.searchBox) {
            this.searchBox.select();
        }
        if (isEmpty(this.state.searchResults) && this.props.theme) {
            this.startSearch();
        }
        if (this.props.searchOptions.allowSearchFilters) {
            this.toggleFilterOptions(false);
        }
    };
    onBlur = () => {
        if (this.preventBlur && this.searchBox) {
            this.searchBox.focus();
        } else {
            this.setState({resultsVisible: false, collapsedSections: {}, expandedLayerGroup: null, activeLayerInfo: null});
        }
    };
    clear = () => {
        this.blur();
        this.setState({searchText: '', searchResults: {}, selectedProvider: '', filterRegionName: "", filterGeometry: null});
        this.props.removeLayer('searchselection');
        UrlParams.updateParams({hp: undefined, hf: undefined, st: undefined});
    };
    startSearch = (provider = null, uniquePlaceResult = false) => {
        let availableProviders = this.props.searchProviders;
        const selectedProvider = provider ?? this.state.selectedProvider;
        if (selectedProvider) {
            availableProviders = {
                [selectedProvider]: this.props.searchProviders[selectedProvider]
            };
        }
        // eslint-disable-next-line
        const searchText = this.state.searchText.trim();
        if (isEmpty(searchText)) {
            this.setState({searchResults: {}});
            return;
        }
        const searchSession = uuidv1();
        this.setState({
            searchResults: {query_text: searchText},
            searchSession: searchSession,
            pendingSearches: Object.keys(availableProviders)
        });
        const searchParams = {
            mapcrs: this.props.map.projection,
            displaycrs: this.props.map.displayCrs,
            lang: LocaleUtils.lang(),
            limit: this.props.searchOptions.resultLimit,
            filterPoly: this.state.filterGeometry?.coordinates?.[0],
            filterBBox: this.state.filterGeometry ? VectorLayerUtils.computeFeatureBBox(this.state.filterGeometry) : null
        };
        Object.entries(availableProviders).forEach(([provKey, prov]) => {
            prov.onSearch(searchText, {
                cfgParams: prov.cfgParams,
                ...prov.params,
                ...searchParams
            }, (response) => {
                let results = prov.handlesGeomFilter ? response.results : this.filterProviderResults(response.results);
                const totResultCount = results.reduce((tot, group) => (tot + (group.resultCount ?? group.items.length)), 0);
                if (uniquePlaceResult) {
                    // If looking for unique place result, filter non-place results
                    results = results.filter(group => (group.type ?? SearchResultType.PLACE) === SearchResultType.PLACE);
                }
                this.setState((state) => {
                    if (searchSession !== state.searchSession) {
                        return {};
                    }
                    const searchResults = {...state.searchResults, [provKey]: {
                        results: results,
                        result_counts: response.result_counts,
                        tot_result_count: totResultCount
                    }};
                    const newPendingSearches = state.pendingSearches.filter(entry => entry !== provKey);
                    if (isEmpty(newPendingSearches) && uniquePlaceResult) {
                        const providersWithResults = Object.entries(searchResults).filter(([_, providerResults]) => providerResults.tot_result_count > 0);
                        if (providersWithResults.length === 1 && providersWithResults[0][1].tot_result_count === 1) {
                            const group = providersWithResults[0][1].results[0];
                            // Avoid warning about setState called in setState
                            setTimeout(() => {
                                this.selectPlaceResult(providersWithResults[0][0], group, group.items[0]);
                            }, 0);
                        }
                    }
                    return {
                        searchResults: searchResults,
                        pendingSearches: newPendingSearches
                    };
                });

            }, axios);
        });
    };
    filterProviderResults = (results) => {
        if (!this.state.filterGeometry) {
            return results;
        }
        const filterPolygon = this.state.filterGeometry.coordinates[0];
        return results.map(group => {
            const resultType = group.type ?? SearchResultType.PLACE;
            if (resultType !== SearchResultType.PLACE) {
                return group;
            }
            const newItems = group.items.filter(item => {
                let geometry = null;
                const itemCrs = item.crs ?? this.props.map.projection;
                if (item.geometry) {
                    geometry = VectorLayerUtils.reprojectGeometry(item.geometry, itemCrs, this.props.map.projection);
                } else {
                    geometry = {type: 'Point', coordinates: CoordinatesUtils.reproject([item.x, item.y], itemCrs, this.props.map.projection)};
                }
                if (geometry.type === 'Polygon') {
                    return polygonIntersectTest(geometry.coordinates[0], filterPolygon);
                } else if (item.bbox) {
                    const [xmin, ymin, xmax, ymax] = CoordinatesUtils.reprojectBbox(item.bbox, itemCrs, this.props.map.projection);
                    return polygonIntersectTest([[xmin, ymin], [xmax, ymin], [xmax, ymax], [xmin, ymax], [xmin, ymin]], filterPolygon);
                } else if (geometry.type === 'Point') {
                    return pointInPolygon(geometry.coordinates, filterPolygon);
                }
                return true;
            });
            return newItems.length > 0 ? {...group, items: newItems} : null;
        }).filter(Boolean);
    };
    updateRecentSearches = () => {
        const text = this.state.searchResults.query_text;
        if (text && !this.state.recentSearches.includes(text)) {
            this.setState((state) => ({recentSearches: [text, ...state.recentSearches.slice(0, 4)]}));
        }
    };
    blur = () => {
        if (this.searchBox) {
            this.searchBox.blur();
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
            this.props.addLayer({...layer, role: LayerRole.USERLAYER});
        }
        if (this.props.searchOptions.zoomToLayers && layer.bbox) {
            this.props.zoomToExtent(layer.bbox.bounds, layer.bbox.crs);
        }
        // Show layer tree to notify user that something has happened
        this.props.setCurrentTask('LayerTree');
    };
    showResultGeometry = (item, response, scale = undefined) => {
        const mapCrs = this.props.map.projection;
        const feature = response?.geometry ? {type: "Feature", geometry: response.geometry} : response?.feature;
        const layer = {
            id: "searchselection",
            role: LayerRole.SELECTION
        };
        if (feature) {
            const features = feature.features ?? [feature];
            features.forEach(feat => {
                feat.geometry = VectorLayerUtils.reprojectGeometry(feat.geometry, response.crs ?? mapCrs, mapCrs);
                feat.styleName = feat.geometry?.type === 'Point' && this.props.searchOptions.showHighlightMarker ? 'marker' : 'default';
                feat.styleOptions = this.props.searchOptions.highlightStyle || {};
                if (feat.crs?.properties?.name) {
                    feat.crs = CoordinatesUtils.fromOgcUrnCrs(feat.crs.properties.name);
                }
            });
            // If first feature is not a point(=marker), add a marker
            if (features[0].styleName !== "marker" && !response.hidemarker && this.props.searchOptions.showHighlightMarker) {
                const center = response.center ? CoordinatesUtils.reproject(
                    response.center, response.crs ?? mapCrs, mapCrs
                ) : CoordinatesUtils.reproject(
                    [item.x, item.y], item.crs ?? mapCrs, mapCrs
                );
                features.unshift({
                    geometry: {type: 'Point', coordinates: center},
                    styleName: 'marker'
                });
            }
            // Label first feature
            if (!this.props.searchOptions.hideResultLabels) {
                const label = (item.label ?? item.text ?? '').replace(/<\/?\w+\s*\/?>/g, '');
                features[0].properties = {...features[0].properties, label: label};
            }
            // Mark first feature as searchmarker
            features[0].id = 'searchmarker';
            this.props.addLayerFeatures(layer, features, true);
        } else {
            const center = CoordinatesUtils.reproject([item.x, item.y], item.crs ?? mapCrs, mapCrs);
            const marker = {
                type: "Feature",
                geometry: {type: "Point", coordinates: center},
                styleName: 'marker'
            };
            if (!this.props.searchOptions.hideResultLabels) {
                const label = (item.label ?? item.text ?? '').replace(/<\/?\w+\s*\/?>/g, '');
                marker.properties = {label: label};
            }
            this.props.addLayerFeatures(layer, [marker], true);
        }
        const bbox = response?.bbox ? CoordinatesUtils.reprojectBbox(
            response.bbox, response.crs ?? mapCrs, mapCrs
        ) : CoordinatesUtils.reprojectBbox(
            item.bbox ?? [item.x, item.y, item.x, item.y], item.crs ?? mapCrs, mapCrs
        );
        this.zoomToResultBBox(bbox, scale);
    };
    zoomToResultBBox = (bbox, scale) => {
        let zoom = 0;
        if (scale) {
            zoom = MapUtils.computeZoom(this.props.map.scales, scale);
        } else {
            const maxZoom = MapUtils.computeZoom(this.props.map.scales, this.props.theme.minSearchScaleDenom || this.props.searchOptions.minScaleDenom);
            if (bbox[0] !== bbox[2] && bbox[1] !== bbox[3]) {
                zoom = Math.max(0, MapUtils.getZoomForExtent(bbox, this.props.map.resolutions, this.props.map.size, 0, maxZoom + 1) - 1);
            } else {
                zoom = maxZoom;
            }
        }
        const x = 0.5 * (bbox[0] + bbox[2]);
        const y = 0.5 * (bbox[1] + bbox[3]);
        this.props.zoomToPoint([x, y], zoom, this.props.map.projection);
    };
    openUrl = (url, target, title) => {
        if (target === "iframe") {
            target = ":iframedialog:externallinkiframe";
        }
        this.props.openExternalUrl(url, target, {title: title});
    };
}

export default connect(
    createSelector([state => state, searchProvidersSelector], (state, searchProviders) => ({
        map: state.map,
        layers: state.layers.flat,
        theme: state.theme.current,
        themes: state.theme.themes,
        selection: state.selection,
        searchProviders: searchProviders,
        startupParams: state.localConfig.startupParams
    })), {
        addThemeSublayer: addThemeSublayer,
        addLayer: addLayer,
        addLayerFeatures: addLayerFeatures,
        changeLayerProperty: changeLayerProperty,
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
