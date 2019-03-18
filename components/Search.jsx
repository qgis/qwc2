/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const assign = require('object-assign');
const {createSelector} = require('reselect');
const classnames = require('classnames');
const isEmpty = require('lodash.isempty');
const isEqual = require('lodash.isequal');
const ol = require('openlayers');
const Icon = require('./Icon');
const Spinner = require('./Spinner');
const {MessageBar} = require('./MessageBar');
const Message = require('../components/I18N/Message');
const LocaleUtils = require('../utils/LocaleUtils');
const MapUtils = require('../utils/MapUtils');
const ConfigUtils = require('../utils/ConfigUtils');
const LayerUtils = require('../utils/LayerUtils');
const CoordinatesUtils = require('../utils/CoordinatesUtils');
const {LayerRole, addLayerFeatures, removeLayer, addLayer, addThemeSublayer, changeLayerProperties} = require('../actions/layers');
const {zoomToPoint} = require('../actions/map');
const {addSearchResults, changeSearch, startSearch, searchMore, setCurrentSearchResult, SearchResultType} = require("../actions/search");
const {setCurrentTask} = require('../actions/task');
const {setCurrentTheme} = require('../actions/theme');
const displayCrsSelector = require('../selectors/displaycrs');
const ThemeUtils = require('../utils/ThemeUtils');
const VectorLayerUtils = require('../utils/VectorLayerUtils');
const {UrlParams} = require("../utils/PermaLinkUtils");
require('./style/Search.css');

class Search extends React.Component {
    static propTypes = {
        searchText: PropTypes.string,
        activeProviders: PropTypes.array, // The active provider keys
        pendingProviders: PropTypes.array, // Providers for which results are pending
        searchProviders: PropTypes.object, // All available search providers
        startupSearch: PropTypes.bool,
        results: PropTypes.array,
        currentResult: PropTypes.object,
        theme: PropTypes.object,
        themes: PropTypes.object,
        map: PropTypes.object,
        displaycrs: PropTypes.string,
        changeSearch: PropTypes.func,
        startSearch: PropTypes.func,
        searchMore: PropTypes.func,
        panToResult: PropTypes.func,
        addLayerFeatures: PropTypes.func,
        removeLayer: PropTypes.func,
        addLayer: PropTypes.func,
        addThemeSublayer: PropTypes.func,
        setCurrentTask: PropTypes.func,
        setCurrentTheme: PropTypes.func,
        searchOptions: PropTypes.object,
        layers: PropTypes.array,
        changeLayerProperties: PropTypes.func
    }
    static contextTypes = {
        messages: PropTypes.object
    }
    state = {
        focused: false, showfields: false, providerSelectionVisible: false
    }
    componentDidMount() {
        this.input = null;
        this.searchTimer = 0;
        this.preventBlur = false;
        this.blurred = false;
    }
    componentWillReceiveProps(newProps) {
        // If search text changed, clear result
        if(newProps.searchText !== this.props.searchText) {
            this.props.removeLayer('searchselection');
        }
        // If the theme changed, reset search and select provider
        if(newProps.theme && (newProps.theme !== this.props.theme || !isEqual(Object.keys(newProps.searchProviders), Object.keys(this.props.searchProviders)))) {
            // Only reset search text if the theme was changed (as opposed to the initial theme loaded)
            let searchText = this.props.theme ? "" : newProps.searchText;

            // Ensure search providers references valid providers
            let activeProviders = newProps.activeProviders;
            if(!newProps.searchOptions.showProviderSelection || isEmpty(newProps.searchProviders)) {
                activeProviders = null;
            } else {
                activeProviders = (activeProviders || []).filter(key => newProps.searchProviders[key] !== undefined);
                if(isEmpty(activeProviders)) {
                    activeProviders = newProps.searchOptions.providerSelectionAllowAll ? null : [newProps.searchProviders[0].key];
                }
            }

            newProps.changeSearch(searchText, activeProviders);

            // If initial theme loaded and a search text is defined, fire off the search
            if(!this.props.theme) {
                this.search(assign({}, newProps, {activeProviders}), true);
            }
        }
        else if(newProps.results && newProps.results !== this.props.results && isEmpty(newProps.pendingProviders)) {
            // If results changed and a unique result is returned, select it automatically if it is a Place result
            if(newProps.results.length === 1 && newProps.results[0].items.length == 1) {
                let item = newProps.results[0].items[0];
                if((item.type || SearchResultType.PLACE) === SearchResultType.PLACE) {
                    this.showResult(item, newProps.startupSearch);
                }
            }
            // If multiple results are available and search field is not focused, focus it (unless explicitly blurred before)
            else if(this.input && !this.blurred) {
                this.input.focus();
            }
        }
    }
    killEvent = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
    }
    search = (props, startup=false)  => {
        if(props.searchText) {
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
        if((this.props.activeProviders || []).length === 1 && this.props.searchProviders[this.props.activeProviders[0]].fields) {
            this.setState({showfields: true, focused: false});
            ev.preventDefault();
        }
    }
    onFocus = () => {
        if(!this.state.showfields && this.props.searchText && !this.props.results) {
            this.search(this.props);
        }
        this.setState({focused: true});
        this.blurred = false;
    }
    onBlur = (ev) => {
        if(this.preventBlur && this.input) {
            this.input.focus();
        } else {
            this.setState({focused: false});
        }
        this.blurred = true;
    }
    onKeyDown = (ev) => {
        if(ev.keyCode === 13) {
            this.search(this.props);
        } else if(ev.keyCode === 27) {
            ev.target.blur();
        }
    }
    activeProviders = (props) => {
        let keys = isEmpty(props.activeProviders) ? Object.keys(props.searchProviders) : props.activeProviders;
        return keys.reduce((result, key) => {
            if(props.searchProviders[key]) {
                result[key] = props.searchProviders[key];
            }
            return result;
        }, {});
    }
    render() {
        let placeholder = "";
        if(this.props.searchOptions.showProvidersInPlaceholder || !isEmpty(this.props.activeProviders)) {
             placeholder = LocaleUtils.getMessageById(this.context.messages, "search.search");
            let providers = this.activeProviders(this.props);
            if(!isEmpty(providers)) {
                placeholder +=  ": " + Object.keys(providers).map(key => providers[key].label).join(", ");
            }
        } else {
            placeholder = LocaleUtils.getMessageById(this.context.messages, "search.searchall");
        }
        if(!this.props.searchText) {
            var addonAfter = (<Icon icon="search"/>);
        } else if(this.props.searchText && this.state.focused && this.props.pendingProviders && this.props.pendingProviders.length > 0) {
            var addonAfter = (<Spinner/>);
        } else {
            var addonAfter = (<Icon icon="remove" onClick={this.resetSearch}/>);
        }
        let providerSelection = null;
        if(this.props.searchOptions.showProviderSelection) {
            let providerSelectionMenu = null;
            if(this.state.providerSelectionVisible) {
                let allEntry = null;
                if(this.props.searchOptions.providerSelectionAllowAll) {
                    let itemClass = classnames({
                        'searchbar-provider-selection-all': true,
                        'searchbar-provider-selection-active': isEmpty(this.props.activeProviders)
                    });
                    allEntry = (
                        <li className={itemClass} key="all" onClick={() => this.props.changeSearch("", null)}><Message msgId="search.all" /></li>
                    );
                }
                providerSelectionMenu = (
                    <ul className="searchbar-provider-selection">
                        {allEntry}
                        {Object.keys(this.props.searchProviders).map(key => {
                            let itemClass = classnames({
                                'searchbar-provider-selection-active': (this.props.activeProviders || []).length === 1 && this.props.activeProviders[0] === key
                            });
                            return (
                                <li className={itemClass} key={key} onClick={() => this.props.changeSearch("", [key])}>{this.props.searchProviders[key].label}</li>
                            );
                        })}
                    </ul>
                );
            }
            let addonClasses = classnames({
                'searchbar-addon': true,
                'searchbar-addon-active': this.state.providerSelectionVisible,
                'searchbar-addon-filter-active': !isEmpty(this.props.activeProviders)
            });
            providerSelection = (
                <span className={addonClasses} onClick={() => this.setState({providerSelectionVisible: !this.state.providerSelectionVisible})}>
                    <Icon icon="filter" />
                    <Icon icon="chevron-down" className="searchbar-addon-menu-icon" />
                    {providerSelectionMenu}
                </span>
            );
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
                        <button className="button" onClick={this.submitFormSearch}><Icon icon="search"/> Search</button>
                        <button className="button" onClick={() => this.setState({showfields: false}) }><Icon icon="remove"/> Cancel</button>
                    </div>
                </div>
            );
        }
        let invisibleLayerQuery = null;
        if(this.state.invisibleLayerQuery) {
            invisibleLayerQuery = (
                <MessageBar key="invisibleLayerQuery" className="searchbar-invisible-layer-notification"
                    onHide={() => this.setState({invisibleLayerQuery: null})}
                    hideOnTaskChange={true}
                >
                    <span role="body"><Message msgId="search.invisiblelayer" /> <button onClick={this.enableLayer}><Message msgId="search.enablelayer" /></button></span>
                </MessageBar>
            );
        }
        return [
            (
                <div id="Search" key="SearchBox" onTouchStart={ev => ev.stopPropagation()} onTouchMove={ev => ev.stopPropagation()}  onTouchEnd={ev => ev.stopPropagation()}>
                    <div className="searchbar-wrapper">
                        <div className="searchbar-container">
                            <input
                                className="searchbar"
                                placeholder={placeholder}
                                type="text"
                                ref={el => this.input = el}
                                value={this.props.searchText}
                                onMouseDown={this.checkShowFields}
                                onFocus={this.onFocus}
                                onBlur={this.onBlur}
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
            ), invisibleLayerQuery
        ];
    }
    enableLayer = () => {
        if(this.state.invisibleLayerQuery) {
            let layer = this.state.invisibleLayerQuery.layer;
            let sublayerpath = this.state.invisibleLayerQuery.sublayerpath;
            let {newlayer, newsublayer} = LayerUtils.cloneLayer(layer, sublayerpath);
            assign(newsublayer, {visibility: true});
            this.props.changeLayerProperties(layer.uuid, newlayer);
            this.setState({invisibleLayerQuery: null});
        }
    }
    submitFormSearch = () => {
        let comp = this.props.searchProviders[UrlParams.getParam("sp")].comparator;
        let filters = Object.keys(this.formfields).map(key => {
            return  key + "=" + this.formfields[key].value;
        });
        let searchText = filters.join(" AND ");
        if(searchText !== this.props.searchText || !this.props.results) {
            this.props.changeSearch(searchText, this.props.activeProviders);
            this.props.startSearch(searchText, {displaycrs: this.props.displaycrs}, this.activeProviders(this.props));
        }
        this.input.focus();
        this.setState({showfields: false});
    }
    renderSearchResults = () => {
        if(!this.props.results || this.props.results.length === 0 || !this.state.focused) {
            return null;
        }
        return (
            <ul className="search-results" onMouseDown={this.setPreventBlur}>
                {this.props.results.map(category => this.renderCategory(category))}
            </ul>
        );
    }
    setPreventBlur = (ev) => {
        this.preventBlur = true;
        setTimeout(() => {this.preventBlur = false; return false;}, 100);
    }
    renderCategory = (category) => {
        let title = category.titlemsgid ? (<Message msgId={category.titlemsgid} />) : category.title;
        return (
            <li key={category.id} onMouseDown={this.killEvent}>
                <span className="search-results-category-title">{title}</span>
                <ul>{category.items.map(item => this.renderItem(item))}</ul>
            </li>
        )
    }
    renderItem = (item) => {
        if(item.more) {
            return (
                <li key={item.id}
                    onMouseDown={this.killEvent}
                    onClick={() => this.props.searchMore(item, this.props.searchText, this.activeProviders(this.props))}>
                    <i><Message msgId="search.more" /></i>
                </li>
            );
        }
        let addTitle = LocaleUtils.getMessageById(this.context.messages, "themeswitcher.addtotheme");
        let addThemes = ConfigUtils.getConfigProp("allowAddingOtherThemes");
        return (
            <li key={item.id} title={item.text} onMouseDown={this.killEvent}
                onClick={() => {this.showResult(item); this.input.blur(); }}
            >
                {item.thumbnail ? (<img src={item.thumbnail} />) : null}
                <span dangerouslySetInnerHTML={{__html: item.text}}></span>
                {item.theme && addThemes ? (<Icon onClick={(ev) => {this.addThemeLayers(ev, item.theme); this.input.blur();}} icon="plus" title={addTitle}/>) : null}
            </li>
        );
    }
    showResult = (item, zoom=true) => {
        let resultType = item.type || SearchResultType.PLACE;
        if(resultType !== SearchResultType.PLACE && !this.props.searchOptions.zoomToLayers) {
            zoom = false;
        }
        if(zoom) {
            let bbox = item.bbox ? item.bbox.slice(0) : [];
            let crs = item.crs;
            let x = !isEmpty(item.bbox) ? 0.5 * (item.bbox[0] + item.bbox[2]) : item.x;
            let y = !isEmpty(item.bbox) ? 0.5 * (item.bbox[1] + item.bbox[3]) : item.y;

            // find max zoom level greater than min scale
            let maxZoom = MapUtils.computeZoom(this.props.map.scales, this.props.searchOptions.minScale);

            if(resultType === SearchResultType.THEMELAYER && item.layer) {
                const maxbbox = (layer, bounds) => {
                    if(layer.sublayers) {
                        for(sublayer in layer.sublayers) {
                            maxbbox(layer.sublayers[sublayer], bounds);
                        }
                    } else {
                        const newbounds = CoordinatesUtils.reprojectBbox(layer.bbox.bounds, layer.bbox.crs, this.props.map.projection);
                        if(bounds.length) {
                            bounds[0] = Math.min(newbounds[0], bounds[0]);
                            bounds[1] = Math.min(newbounds[1], bounds[1]);
                            bounds[2] = Math.max(newbounds[2], bounds[2]);
                            bounds[3] = Math.max(newbounds[3], bounds[3]);
                        } else {
                            bounds.push(...newbounds);
                        }
                    }
                }
                maxbbox(item.layer, bbox);
                crs = this.props.map.projection;
                x = 0.5 * (bbox[0] + bbox[2]);
                y = 0.5 * (bbox[3] + bbox[1]);
            }

            // zoom to result using max zoom level
            let newZoom;
            if(!isEmpty(bbox)) {
                let mapbbox = CoordinatesUtils.reprojectBbox(bbox, crs, this.props.map.projection)
                newZoom = Math.max(0, MapUtils.getZoomForExtent(mapbbox, this.props.map.resolutions, this.props.map.size, 0, maxZoom) - 1);
            } else {
                newZoom = MapUtils.computeZoom(this.props.map.scales, item.scale || 0);
                newZoom = Math.max(0, Math.min(newZoom, maxZoom));
            }
            this.props.panToResult([x, y], newZoom, crs);
        }
        if(resultType === SearchResultType.PLACE) {
            this.props.removeLayer("searchselection");
            let text = item.label !== undefined ? item.label : item.text;
            text = text.replace(/<[^>]*>/g, '')
            if(item.provider && this.props.searchProviders[item.provider].getResultGeometry) {
                this.props.searchProviders[item.provider].getResultGeometry(item, (item, geometry, crs) => { this.showFeatureGeometry(item, geometry, crs, text)});
            } else {
                let layer = {
                    id: "searchselection",
                    role: LayerRole.SELECTION
                };
                let marker = this.createMarker([item.x, item.y], item.crs, text);
                this.props.addLayerFeatures(layer, [marker], true);
            }
            this.props.setCurrentSearchResult(item);
        } else if(resultType === SearchResultType.THEMELAYER) {
            this.props.addThemeSublayer(item.layer);
            // Show layer tree to notify user that something has happened
            this.props.setCurrentTask('LayerTree');
        } else if(resultType === SearchResultType.THEME) {
            this.props.setCurrentTheme(item.theme, this.props.themes);
        }

        // if item specifies a layer, query user to make it visible if not visible
        let invisibleLayerQuery = null;
        if(resultType === SearchResultType.PLACE && item.layer) {
            let sublayerpath = null;
            let sublayer = null;
            let layer = this.props.layers.find(layer => {
                sublayerpath = [];
                sublayer = LayerUtils.searchSubLayer(layer, 'name', item.layer, sublayerpath);
                return sublayer !== null;
            });
            if(sublayer && !sublayer.visibility) {
                invisibleLayerQuery = {layer, sublayerpath};
            }
        }
        this.setState({invisibleLayerQuery});
    }
    showFeatureGeometry = (item, geometry, crs, text) => {
        if(item === this.props.currentResult) {
            let features = [];
            let highlightFeature = VectorLayerUtils.wktToGeoJSON(geometry, crs, this.props.map.projection);
            if(highlightFeature) {
                let center = this.getFeatureCenter(highlightFeature);
                features = [highlightFeature, this.createMarker(center, item.crs, text)];
            } else {
                features = [this.createMarker([item.x, item.y], item.crs, text)];
            }
            let layer = {
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
        let geojson = new ol.format.GeoJSON().readFeature(feature);
        let geometry = geojson.getGeometry();
        let type = geometry.getType();
        let center;
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
        }
        return center;
    }
    addThemeLayers = (ev, theme) => {
        ev.stopPropagation();
        this.props.addLayer(ThemeUtils.createThemeLayer(theme, null, LayerRole.USERLAYER));
        // Show layer tree to notify user that something has happened
        this.props.setCurrentTask('LayerTree');
    }
};


module.exports = (searchProviders, providerFactory=(entry) => { return null; }) => {

    const collectProviders = createSelector(
        [state => state.theme, state => state.layers && state.layers.flat || null], (theme, layers) => {
            let availableProviders = {};
            let themeLayerNames = layers.map(layer => layer.role === LayerRole.THEME ? layer.params.LAYERS : "").join(",").split(",").filter(entry => entry);
            let themeProviders = theme && theme.current ? theme.current.searchProviders : [];
            for(let entry of themeProviders) {
                let provider = searchProviders[entry] || providerFactory(entry);
                if(provider) {
                    if(provider.requiresLayer && !themeLayerNames.includes(provider.requiresLayer)) {
                        continue;
                    }
                    availableProviders[entry.key || entry] = provider;
                }
            }
            if(ConfigUtils.getConfigProp("searchThemes")) {
                availableProviders["themes"] = {
                    label: "Themes",
                    onSearch: (text, reqId, options, dispatch) => {
                        dispatch(addSearchResults({
                            provider: "themes",
                            reqId: reqId,
                            data: ThemeUtils.searchThemes(theme.themes, text, SearchResultType.THEME)
                        }));
                    }
                };
            }
            return availableProviders;
        }
    );

    return connect(
        createSelector([state => state, displayCrsSelector, collectProviders], (state, displaycrs, searchProviders) => ({
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
            layers: state.layers.flat || [],
            searchProviders: searchProviders,
        })
    ), {
        changeSearch: changeSearch,
        startSearch: startSearch,
        searchMore: searchMore,
        setCurrentSearchResult: setCurrentSearchResult,
        panToResult: zoomToPoint,
        addLayerFeatures: addLayerFeatures,
        removeLayer: removeLayer,
        addLayer: addLayer,
        addThemeSublayer: addThemeSublayer,
        changeLayerProperties: changeLayerProperties,
        setCurrentTask: setCurrentTask,
        setCurrentTheme: setCurrentTheme
    })(Search);
}
