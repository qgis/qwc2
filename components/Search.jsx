/**
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {createSelector} from 'reselect';
import classnames from 'classnames';
import isEmpty from 'lodash.isempty';
import isEqual from 'lodash.isequal';
import ol from 'openlayers';
import Icon from './Icon';
import Spinner from './Spinner';
import MessageBar from './MessageBar';
import {LayerRole, addLayerFeatures, removeLayer, addLayer, addThemeSublayer, changeLayerProperty} from '../actions/layers';
import {zoomToPoint} from '../actions/map';
import {changeSearch, startSearch, searchMore, setCurrentSearchResult, SearchResultType} from '../actions/search';
import {setCurrentTask} from '../actions/task';
import {setCurrentTheme} from '../actions/theme';
import {showNotification} from '../actions/windows';
import searchProvidersSelector from '../selectors/searchproviders';
import displayCrsSelector from '../selectors/displaycrs';
import ConfigUtils from '../utils/ConfigUtils';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';
import {UrlParams} from '../utils/PermaLinkUtils';
import ThemeUtils from '../utils/ThemeUtils';
import VectorLayerUtils from '../utils/VectorLayerUtils';
import './style/Search.css';

class Search extends React.Component {
    static propTypes = {
        activeProviders: PropTypes.array, // The active provider keys
        addLayer: PropTypes.func,
        addLayerFeatures: PropTypes.func,
        addThemeSublayer: PropTypes.func,
        changeLayerProperty: PropTypes.func,
        changeSearch: PropTypes.func,
        currentResult: PropTypes.object,
        displaycrs: PropTypes.string,
        layers: PropTypes.array,
        map: PropTypes.object,
        panToResult: PropTypes.func,
        pendingProviders: PropTypes.array, // Providers for which results are pending
        removeLayer: PropTypes.func,
        results: PropTypes.array,
        searchMore: PropTypes.func,
        searchOptions: PropTypes.object,
        searchProviders: PropTypes.object, // All available search providers
        searchText: PropTypes.string,
        setCurrentSearchResult: PropTypes.func,
        setCurrentTask: PropTypes.func,
        setCurrentTheme: PropTypes.func,
        showNotification: PropTypes.func,
        startSearch: PropTypes.func,
        startupParams: PropTypes.object,
        startupSearch: PropTypes.bool,
        theme: PropTypes.object,
        themes: PropTypes.object
    }
    state = {
        focused: false,
        showfields: false,
        providerSelectionVisible: false
    }
    componentDidMount() {
        this.input = null;
        this.searchTimer = 0;
        this.preventBlur = false;
        this.blurred = false;

        const sp = UrlParams.getParam('sp');
        this.props.changeSearch(UrlParams.getParam('st') || "", sp ? sp.split(",") : null);
    }
    componentDidUpdate(prevProps, prevState) {
        // If search text changed, clear result
        if (this.props.searchText !== prevProps.searchText) {
            prevProps.removeLayer('searchselection');
        }
        // If the theme changed, reset search and select provider
        if (this.props.theme && (this.props.theme !== prevProps.theme || !isEqual(Object.keys(this.props.searchProviders), Object.keys(prevProps.searchProviders)))) {
            // Only reset search text if the theme was changed (as opposed to the initial theme loaded)
            const searchText = prevProps.theme ? "" : this.props.searchText;

            // Ensure search providers references valid providers
            let activeProviders = this.props.activeProviders;
            if (!this.props.searchOptions.showProviderSelection || isEmpty(this.props.searchProviders)) {
                activeProviders = null;
            } else {
                activeProviders = (activeProviders || []).filter(key => this.props.searchProviders[key] !== undefined);
                if (isEmpty(activeProviders)) {
                    activeProviders = this.props.searchOptions.providerSelectionAllowAll ? null : [Object.keys(this.props.searchProviders)[0]];
                }
            }

            this.props.changeSearch(searchText, activeProviders);

            // If initial theme loaded and a search text is defined, fire off the search
            if (!prevProps.theme) {
                this.search({...this.props, ...activeProviders}, true);
            }
        } else if (this.props.results && this.props.results !== prevProps.results && isEmpty(this.props.pendingProviders)) {
            // If results changed and a unique result is returned, select it automatically if it is a Place result
            if (this.props.results.length === 1 && this.props.results[0].items.length === 1) {
                const item = this.props.results[0].items[0];
                if ((item.type || SearchResultType.PLACE) === SearchResultType.PLACE) {
                    this.showResult(item, this.props.startupSearch, this.props.startupSearch);
                }
            } else if (this.input && !this.blurred) {
                // If multiple results are available and search field is not focused, focus it (unless explicitly blurred before)
                this.input.focus();
            }
        }
    }
    killEvent = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
    }
    search = (props, startup = false)  => {
        if (props.searchText) {
            this.setState({invisibleLayerQuery: null});
            props.startSearch(props.searchText, {displaycrs: props.displaycrs}, this.activeProviders(props), startup);
        }
    }
    resetSearch = () => {
        this.setState({focused: false, showfields: false, invisibleLayerQuery: null});
        this.props.changeSearch("", this.props.activeProviders);
    }
    onChange = (ev) => {
        this.props.changeSearch(ev.target.value, this.props.activeProviders);
        clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => this.search(this.props), 500);
    }
    checkShowFields = (ev) => {
        if ((this.props.activeProviders || []).length === 1 && this.props.searchProviders[this.props.activeProviders[0]].fields) {
            this.setState({showfields: true, focused: false});
            ev.preventDefault();
        }
    }
    onFocus = () => {
        if (!this.state.showfields && this.props.searchText && !this.props.results) {
            this.search(this.props);
        }
        this.setState({focused: true});
        this.blurred = false;
    }
    onBlur = () => {
        if (this.preventBlur && this.input) {
            this.input.focus();
        } else {
            this.setState({focused: false});
        }
        this.blurred = true;
    }
    onKeyDown = (ev) => {
        if (ev.keyCode === 13) {
            this.search(this.props);
        } else if (ev.keyCode === 27) {
            ev.target.blur();
        }
    }
    activeProviders = (props) => {
        const keys = isEmpty(props.activeProviders) ? Object.keys(props.searchProviders) : props.activeProviders;
        return keys.reduce((result, key) => {
            if (props.searchProviders[key]) {
                result[key] = props.searchProviders[key];
            }
            return result;
        }, {});
    }
    render() {
        let placeholder = "";
        if (this.props.searchOptions.showProvidersInPlaceholder || !isEmpty(this.props.activeProviders)) {
            placeholder = LocaleUtils.tr("search.search");
            const providers = this.activeProviders(this.props);
            if (!isEmpty(providers)) {
                placeholder +=  ": " + Object.values(providers).map(prov => {
                    return prov.labelmsgid ? LocaleUtils.tr(prov.labelmsgid) : prov.label;
                }).join(", ");
            }
        } else {
            placeholder = LocaleUtils.tr("search.searchall");
        }
        let addonAfter = null;
        let addonAfterTooltip = null;
        if (!this.props.searchText) {
            addonAfterTooltip = LocaleUtils.tr("search.search");
            addonAfter = (<Icon icon="search" title={addonAfterTooltip}/>);
        } else if(this.props.searchText && this.state.focused && this.props.pendingProviders && this.props.pendingProviders.length > 0) {
            addonAfterTooltip = LocaleUtils.tr("search.searchinprogress");
            addonAfter = (<Spinner/>);
        } else {
            addonAfterTooltip = LocaleUtils.tr("search.searchreset");
            addonAfter = (<Icon icon="remove" onClick={this.resetSearch} title={addonAfterTooltip}/>);
        }
        let providerSelection = null;
        let providerSelectionTooltip = LocaleUtils.tr("search.providerselection");
        if (this.props.searchOptions.showProviderSelection) {
            let providerSelectionMenu = null;
            if (this.state.providerSelectionVisible) {
                let allEntry = null;
                if (this.props.searchOptions.providerSelectionAllowAll) {
                    const itemClass = classnames({
                        'searchbar-provider-selection-all': true,
                        'searchbar-provider-selection-active': isEmpty(this.props.activeProviders)
                    });
                    allEntry = (
                        <li className={itemClass} key="all" onClick={() => this.props.changeSearch("", null)} title="">{LocaleUtils.tr("search.all")}</li>
                    );
                }
                providerSelectionMenu = (
                    <ul className="searchbar-provider-selection">
                        {allEntry}
                        {Object.entries(this.props.searchProviders).map(([key, prov]) => {
                            const itemClass = classnames({
                                'searchbar-provider-selection-active': (this.props.activeProviders || []).length === 1 && this.props.activeProviders[0] === key
                            });
                            return (
                                <li className={itemClass} key={key} onClick={() => this.props.changeSearch("", [key])} title="">
                                    {
                                        prov.labelmsgid ? LocaleUtils.tr(prov.labelmsgid) : prov.label
                                    }
                                </li>
                            );
                        })}
                    </ul>
                );
            }
            const addonClasses = classnames({
                'searchbar-addon': true,
                'searchbar-addon-active': this.state.providerSelectionVisible,
                'searchbar-addon-filter-active': !isEmpty(this.props.activeProviders)
            });
            providerSelection = (
                <span className={addonClasses} onClick={() => this.setState({providerSelectionVisible: !this.state.providerSelectionVisible})} title={providerSelectionTooltip}>
                    <Icon icon="filter" title={providerSelectionTooltip} />
                    <Icon className="searchbar-addon-menu-icon" icon="chevron-down" title={providerSelectionTooltip} />
                    {providerSelectionMenu}
                </span>
            );
        }
        let searchform = null;
        this.formfields = {};
        if (this.state.showfields) {
            const fields = this.props.searchProviders[UrlParams.getParam("sp")].fields;
            const values = {};
            this.props.searchText.split(/\s*AND\s*/).map(pair => {
                const parts = pair.split(/\s*=\s*/);
                if (parts.length === 2) {
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
                                    <td><input defaultValue={values[field.id] || ""} ref={el => { this.formfields[field.id] = el; }} type="text" /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="search-form-buttons">
                        <button className="button" onClick={this.submitFormSearch}><Icon icon="search"/> Search</button>
                        <button className="button" onClick={() => this.setState({showfields: false}) }><Icon icon="remove"/> Cancel</button>
                    </div>
                </div>
            );
        }
        let invisibleLayerQuery = null;
        if (this.state.invisibleLayerQuery) {
            invisibleLayerQuery = (
                <MessageBar className="searchbar-invisible-layer-notification" hideOnTaskChange
                    key="invisibleLayerQuery"
                    onHide={() => this.setState({invisibleLayerQuery: null})}
                >
                    <span role="body">{LocaleUtils.tr("search.invisiblelayer")} <button onClick={this.enableLayer}>{LocaleUtils.tr("search.enablelayer")}</button></span>
                </MessageBar>
            );
        }
        return [
            (
                <div id="Search" key="SearchBox" onTouchEnd={ev => ev.stopPropagation()} onTouchMove={ev => ev.stopPropagation()}  onTouchStart={ev => ev.stopPropagation()}>
                    <div className="searchbar-wrapper">
                        <div className="searchbar-container">
                            <input
                                className="searchbar"
                                onBlur={this.onBlur}
                                onChange={this.onChange}
                                onFocus={this.onFocus}
                                onKeyDown={this.onKeyDown}
                                onMouseDown={this.checkShowFields}
                                placeholder={placeholder}
                                ref={el => { this.input = el; }}
                                type="text"
                                value={this.props.searchText} />
                            <span className="searchbar-addon" title={addonAfterTooltip}>
                                {addonAfter}
                            </span>
                        </div>
                        {searchform}
                        {this.renderSearchResults()}
                    </div>
                    {providerSelection}
                </div>
            ), invisibleLayerQuery
        ];
    }
    enableLayer = () => {
        if (this.state.invisibleLayerQuery) {
            this.props.changeLayerProperty(this.state.invisibleLayerQuery.layer.uuid, "visibility", true, this.state.invisibleLayerQuery.sublayerpath, "both");
            this.setState({invisibleLayerQuery: null});
        }
    }
    submitFormSearch = () => {
        const comp = this.props.searchProviders[UrlParams.getParam("sp")].comparator;
        const filters = Object.keys(this.formfields).map(key => {
            return  key + "=" + this.formfields[key].value;
        });
        const searchText = filters.join(" AND ");
        if (searchText !== this.props.searchText || !this.props.results) {
            this.props.changeSearch(searchText, this.props.activeProviders);
            this.props.startSearch(searchText, {displaycrs: this.props.displaycrs}, this.activeProviders(this.props));
        }
        this.input.focus();
        this.setState({showfields: false});
    }
    renderSearchResults = () => {
        if (!this.props.results || this.props.results.length === 0 || !this.state.focused) {
            return null;
        }
        return (
            <ul className="search-results" onMouseDown={this.setPreventBlur} ref={this.setupKillTouchEvents}>
                {this.props.results.map(category => this.renderCategory(category))}
            </ul>
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
    renderCategory = (category) => {
        const title = category.titlemsgid ? LocaleUtils.tr(category.titlemsgid) : category.title;
        return (
            <li key={category.id} onMouseDown={this.killEvent}>
                <span className="search-results-category-title">{title}</span>
                <ul>{category.items.map(item => this.renderItem(item))}</ul>
            </li>
        );
    }
    renderItem = (item) => {
        if (item.more) {
            return (
                <li key={item.id}
                    onClick={() => this.props.searchMore(item, this.props.searchText, this.activeProviders(this.props))}
                    onMouseDown={this.killEvent}>
                    <i>{LocaleUtils.tr("search.more")}</i>
                </li>
            );
        }
        const addTitle = LocaleUtils.tr("themeswitcher.addtotheme");
        const addThemes = ConfigUtils.getConfigProp("allowAddingOtherThemes", this.props.theme);
        return (
            <li key={item.id} onClick={() => {this.showResult(item); this.input.blur(); }} onMouseDown={this.killEvent}
                title={item.text}
            >
                {item.thumbnail ? (<img src={item.thumbnail} />) : null}
                <span dangerouslySetInnerHTML={{__html: item.text}} />
                {item.theme && addThemes ? (<Icon icon="plus" onClick={(ev) => {this.addThemeLayers(ev, item.theme); this.input.blur();}} title={addTitle}/>) : null}
            </li>
        );
    }
    showResult = (item, zoom=true, startupSearch=false) => {
        const resultType = item.type || SearchResultType.PLACE;
        if (resultType !== SearchResultType.PLACE && !this.props.searchOptions.zoomToLayers) {
            zoom = false;
        }
        if (zoom) {
            const bbox = item.bbox ? item.bbox.slice(0) : [];
            let crs = item.crs;
            let x = !isEmpty(item.bbox) ? 0.5 * (item.bbox[0] + item.bbox[2]) : item.x;
            let y = !isEmpty(item.bbox) ? 0.5 * (item.bbox[1] + item.bbox[3]) : item.y;

            // find max zoom level greater than min scale
            const maxZoom = MapUtils.computeZoom(this.props.map.scales, this.props.theme.minSearchScaleDenom || this.props.searchOptions.minScaleDenom);

            if (resultType !== SearchResultType.PLACE && item.layer) {
                const maxbbox = (layer, bounds) => {
                    if (layer.sublayers) {
                        for (const sublayer of layer.sublayers) {
                            maxbbox(sublayer, bounds);
                        }
                    } else {
                        const newbounds = CoordinatesUtils.reprojectBbox(layer.bbox.bounds, layer.bbox.crs, this.props.map.projection);
                        if (bounds.length) {
                            bounds[0] = Math.min(newbounds[0], bounds[0]);
                            bounds[1] = Math.min(newbounds[1], bounds[1]);
                            bounds[2] = Math.max(newbounds[2], bounds[2]);
                            bounds[3] = Math.max(newbounds[3], bounds[3]);
                        } else {
                            bounds.push(...newbounds);
                        }
                    }
                };
                maxbbox(item.layer, bbox);
                crs = this.props.map.projection;
                x = 0.5 * (bbox[0] + bbox[2]);
                y = 0.5 * (bbox[3] + bbox[1]);
            }

            // zoom to result using max zoom level
            let newZoom;
            if (!isEmpty(bbox) && bbox[0] !== bbox[2] && bbox[1] !== bbox[3]) {
                const mapbbox = CoordinatesUtils.reprojectBbox(bbox, crs, this.props.map.projection)
                newZoom = Math.max(0, MapUtils.getZoomForExtent(mapbbox, this.props.map.resolutions, this.props.map.size, 0, maxZoom + 1) - 1);
            } else {
                newZoom = MapUtils.computeZoom(this.props.map.scales, item.scale || 0);
                newZoom = Math.max(0, Math.min(newZoom, maxZoom));
            }
            if (startupSearch) {
                if (this.props.startupParams.s) {
                    newZoom = MapUtils.computeZoom(this.props.map.scales, this.props.startupParams.s);
                }
            }
            this.props.panToResult([x, y], newZoom, crs);
        }
        if (resultType === SearchResultType.PLACE) {
            this.props.removeLayer("searchselection");
            let text = item.label !== undefined ? item.label : item.text;
            text = text.replace(/<[^>]*>/g, '');
            if (item.provider && this.props.searchProviders[item.provider].getResultGeometry) {
                this.props.searchProviders[item.provider].getResultGeometry(item, (itm, geometry, crs) => { this.showFeatureGeometry(itm, geometry, crs, text); });
            } else {
                const layer = {
                    id: "searchselection",
                    role: LayerRole.SELECTION
                };
                const marker = this.createMarker([item.x, item.y], item.crs, text);
                this.props.addLayerFeatures(layer, [marker], true);
            }
            this.props.setCurrentSearchResult(item);
        } else if (resultType === SearchResultType.THEMELAYER) {
            this.props.addThemeSublayer(item.layer);
            // Show layer tree to notify user that something has happened
            this.props.setCurrentTask('LayerTree');
        } else if (resultType === SearchResultType.EXTERNALLAYER) {
            // Check if layer is already in the LayerTree
            const sublayers = LayerUtils.getSublayerNames(item.layer);
            const existing = this.props.layers.find(l => {
                return l.type === item.layer.type && l.url === item.layer.url && !isEmpty(LayerUtils.getSublayerNames(l).filter(v => sublayers.includes(v)))
            });
            if (existing) {
                const text = LocaleUtils.tr("search.existinglayer") + ":" + item.layer.title;
                this.props.showNotification("existinglayer", text);
            }
            this.props.addLayer(item.layer);
            // Show layer tree to notify user that something has happened
            this.props.setCurrentTask('LayerTree');
        } else if (resultType === SearchResultType.THEME) {
            this.props.setCurrentTheme(item.theme, this.props.themes);
        }

        // if item specifies a layer, query user to make it visible if not visible
        let invisibleLayerQuery = null;
        if (resultType === SearchResultType.PLACE && item.layer) {
            let sublayerpath = null;
            let sublayer = null;
            const layer = this.props.layers.find(l => {
                sublayerpath = [];
                sublayer = LayerUtils.searchSubLayer(l, 'name', item.layer, sublayerpath);
                return sublayer !== null;
            });
            if (sublayer && !sublayer.visibility) {
                invisibleLayerQuery = {layer, sublayerpath};
            }
        }
        this.setState({invisibleLayerQuery});
    }
    showFeatureGeometry = (item, geometry, crs, text) => {
        if (item === this.props.currentResult && !isEmpty(geometry)) {
            let features = [];
            const highlightFeature = VectorLayerUtils.wktToGeoJSON(geometry, crs, this.props.map.projection);
            if (highlightFeature) {
                const center = this.getFeatureCenter(highlightFeature);
                features = [highlightFeature, this.createMarker(center, item.crs, text)];
            } else {
                features = [this.createMarker([item.x, item.y], item.crs, text)];
            }
            const layer = {
                id: "searchselection",
                role: LayerRole.SELECTION
            };
            this.props.addLayerFeatures(layer, features, true);
        }
    }
    createMarker = (center, crs, text) => {
        return {
            geometry: {type: 'Point', coordinates: center},
            styleName: 'marker',
            id: 'searchmarker',
            crs: crs,
            properties: { label: text }
        };
    }
    getFeatureCenter = (feature) => {
        const geojson = new ol.format.GeoJSON().readFeature(feature);
        const geometry = geojson.getGeometry();
        const type = geometry.getType();
        let center = null;
        switch (type) {
        case "Polygon":
            center = geometry.getInteriorPoint().getCoordinates();
            break;
        case "MultiPolygon":
            center = geometry.getInteriorPoints().getClosestPoint(ol.extent.getCenter(geometry.getExtent()));
            break;
        case "Point":
            center = geometry.getCoordinates();
            break;
        case "MultiPoint":
            center = geometry.getClosestPoint(ol.extent.getCenter(geometry.getExtent()));
            break;
        case "LineString":
            center = geometry.getCoordinateAt(0.5);
            break;
        case "MultiLineString":
            center = geometry.getClosestPoint(ol.extent.getCenter(geometry.getExtent()));
            break;
        case "Circle":
            center = geometry.getCenter();
            break;
        default:
            break;
        }
        return center;
    }
    addThemeLayers = (ev, theme) => {
        ev.stopPropagation();
        this.props.addLayer(ThemeUtils.createThemeLayer(theme, this.props.themes, LayerRole.USERLAYER));
        // Show layer tree to notify user that something has happened
        this.props.setCurrentTask('LayerTree');
    }
}

export default (searchProviders, providerFactory = () => { return null; }) => {
    const providersSelector = searchProvidersSelector(searchProviders, providerFactory);
    return connect(
        createSelector([state => state, displayCrsSelector, providersSelector], (state, displaycrs, providers) => ({
            searchText: state.search.text,
            activeProviders: state.search.providers,
            pendingProviders: state.search.pendingProviders,
            startupSearch: state.search.startup,
            results: state.search.results,
            currentResult: state.search.currentResult,
            map: state.map,
            displaycrs: displaycrs,
            theme: state.theme.current,
            themes: state.theme.themes,
            layers: state.layers.flat,
            searchProviders: providers,
            startupParams: state.localConfig.startupParams
        })),
        {
            changeSearch: changeSearch,
            startSearch: startSearch,
            searchMore: searchMore,
            setCurrentSearchResult: setCurrentSearchResult,
            panToResult: zoomToPoint,
            addLayerFeatures: addLayerFeatures,
            removeLayer: removeLayer,
            addLayer: addLayer,
            addThemeSublayer: addThemeSublayer,
            changeLayerProperty: changeLayerProperty,
            setCurrentTask: setCurrentTask,
            setCurrentTheme: setCurrentTheme,
            showNotification: showNotification
        }
    )(Search);
};
