/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const assign = require('object-assign');
const {connect} = require('react-redux');
const Message = require('../../MapStore2/web/client/components/I18N/Message');
const {zoomToExtent} = require("../../MapStore2/web/client/actions/map");
const ConfigUtils = require("../../MapStore2/web/client/utils/ConfigUtils");
const LocaleUtils = require("../../MapStore2/web/client/utils/LocaleUtils");
const {setCurrentTheme,setThemeSwitcherFilter} = require("../actions/theme");
const {SideBar} = require('../components/SideBar');
const UrlParams = require("../utils/UrlParams");
const LayerUtils = require('../utils/LayerUtils');
require('./style/ThemeSwitcher.css');

const ThemeSwitcher = React.createClass({
    propTypes: {
        filter: React.PropTypes.string,
        startuptheme: React.PropTypes.shape({
            id: React.PropTypes.string,
            activelayers: React.PropTypes.array}),
        activeTheme: React.PropTypes.object,
        activeThemeLayer: React.PropTypes.string,
        map: React.PropTypes.object,
        layers: React.PropTypes.array,
        changeTheme: React.PropTypes.func,
        changeFilter: React.PropTypes.func,
        setCurrentSidebar: React.PropTypes.func,
        addLayer: React.PropTypes.func,
        zoomToExtent: React.PropTypes.func
    },
    contextTypes: {
        messages: React.PropTypes.object
    },
    getDefaultProps() {
        return {
            filter: "",
            activeTheme: null,
            activeThemeLayer: null,
            map: null};
    },
    getInitialState: function() {
        return {themes: null };
    },
    componentWillReceiveProps(nextProps) {
        if(this.props.map === null && nextProps.map !== null) {
            // As soon as map is set, fetch themes and restore initial theme
            fetch("themes.json")
            .then(response => response.json())
            .then(obj => this.populateThemesList(obj));
        }
    },
    populateThemesList(object) {
        this.setState({themes: object.themes});
        var params = UrlParams.getParams();
        let theme = this.getThemeById(this.state.themes, params.t || this.state.themes.defaultTheme);
        if(theme) {
            let layer = this.createLayerForTheme(theme, params.l ? params.l.split(",") : undefined);
            this.props.changeTheme(theme, layer, this.createBackgroundLayersForTheme(theme, params.bl), this.props.activeThemeLayer, this.currentBackgroundLayerIds());
            if (params.t === undefined) {
                // zoom to default theme
                this.props.zoomToExtent(theme.extent, theme.crs);
            }
        }
    },
    getThemeById(dir, id) {
        for(let i = 0, n = dir.items.length; i < n; ++i) {
            if(dir.items[i].id === id) {
                return dir.items[i];
            }
        }
        for(let i = 0, n = dir.subdirs.length; i < n; ++i) {
            var theme = this.getThemeById(dir.subdirs[i], id);
            if(theme) {
                return theme;
            }
        }
        return null;
    },
    groupMatchesFilter(group) {
        if(group && group.items) {
            for(let i = 0, n = group.items.length; i < n; ++i) {
                if(group.items[i].title.includes(this.props.filter) ||
                   group.items[i].keywords.includes(this.props.filter)) {
                    return true;
                }
            }
        }
        if(group && group.subdirs) {
            for(let i = 0, n = group.subdirs.length; i < n; ++i) {
                if(this.groupMatchesFilter(group.subdirs[i])) {
                    return true;
                }
            }
        }
        return false;
    },
    renderThemeGroup(group) {
        var subtree = null;
        if(this.props.filter === "" || this.groupMatchesFilter(group)) {
            subtree = (group && group.subdirs ? group.subdirs : []).map(subdir =>
                (<li key={subdir.title} className="theme-group"><span>{subdir.title}</span><ul>{this.renderThemeGroup(subdir)}</ul></li>)
            );
        }
        let activeThemeId = this.props.activeTheme ? this.props.activeTheme.id : null;
        return (<ul>
            {(group && group.items ? group.items : []).map(item => {
                return item.title.includes(this.props.filter) || (item.keywords || []).includes(this.props.filter) ? (
                    <li key={item.id} className={activeThemeId === item.id ? "theme-item theme-item-active" : "theme-item"} onClick={(ev)=>{this.themeClicked(item);}}>
                        {item.title}<br /><img src={"data:image/png;base64," + item.thumbnail} /><br />
                    <div className="theme-item-keywords" title={item.keywords}>{item.keywords}</div>
                    </li>) : null;
            })}
            {subtree}
            </ul>);
    },
    render() {
        return (
            <SideBar id="ThemeSwitcher" width="15em" title="themeswitcher.title">
                <div role="body" style={{height: '100%'}}>
                    <input className="themeswitcher-filter" type="text" value={this.props.filter} onChange={this.filterChanged} placeholder={LocaleUtils.getMessageById(this.context.messages, "themeswitcher.filter")}/>
                    <div className="themeswitcher-container">
                        {this.renderThemeGroup(this.state.themes)}
                    </div>
                </div>
            </SideBar>
        );
    },
    createLayerForTheme(theme, visiblelayers=undefined) {
        let sublayers = theme.sublayers;
        if(visiblelayers !== undefined) {
            sublayers = LayerUtils.restoreVisibleLayers(sublayers, visiblelayers);
        }
        let {params, queryLayers} = LayerUtils.buildLayerParams(sublayers);
        // untiled WMS by default
        let singleTile = true;
        if (theme.tiled !== undefined) {
            singleTile = !theme.tiled;
        }
        return {
            id: theme.name + Date.now().toString(),
            type: "wms",
            url: theme.url,
            visibility: true,
            name: theme.name,
            title: theme.title,
            boundingBox: {
                extent: theme.extent,
                crs: theme.crs
            },
            sublayers : sublayers,
            params: params,
            queryLayers: queryLayers,
            singleTile: singleTile,
            ratio: singleTile ? 1 : undefined
        }
    },
    createBackgroundLayersForTheme(theme, visibleBackgroundLayer=undefined) {
        let backgroundLayers = [];
        for (let themeBackgroundLayer of (theme.backgroundLayers || [])) {
            // lookup background layer
            let backgroundLayer = this.state.themes.backgroundLayers.find((layer) => layer.name === themeBackgroundLayer.name);
            if (backgroundLayer !== undefined) {
                let visibility = themeBackgroundLayer.visibility || false;
                if (visibleBackgroundLayer !== undefined) {
                    visibility = (backgroundLayer.name === visibleBackgroundLayer);
                }
                backgroundLayers.push(assign({}, backgroundLayer, {
                    group: 'background',
                    visibility: visibility
                }));
            } else {
                console.warn("Could not find background layer " + themeBackgroundLayer.name);
            }
        };
        return backgroundLayers;
    },
    currentBackgroundLayerIds() {
        return this.props.layers.filter((layer) => {
            return layer.group === 'background';
        }).map((layer) => {
            return layer.id;
        });
    },
    themeClicked(theme) {
        this.props.changeTheme(theme, this.createLayerForTheme(theme), this.createBackgroundLayersForTheme(theme), this.props.activeThemeLayer, this.currentBackgroundLayerIds());
        this.props.zoomToExtent(theme.extent, theme.crs);
    },
    filterChanged(ev) {
        this.props.changeFilter(ev.target.value);
    }
});

const selector = (state) => ({
    activeTheme: state.theme ? state.theme.current : null,
    activeThemeLayer: state.theme ? state.theme.currentlayer : null,
    filter: state.theme ? state.theme.switcherfilter : "",
    startuptheme: state.theme ? state.theme.startuptheme : null,
    map: state.map,
    layers: state.layers && state.layers.flat ? state.layers.flat : []
});


module.exports = {
    ThemeSwitcherPlugin: connect(selector, {
        changeTheme: setCurrentTheme,
        changeFilter: setThemeSwitcherFilter,
        zoomToExtent: zoomToExtent
    })(ThemeSwitcher),
    reducers: {
        theme: require('../reducers/theme'),
        sidebar: require('../reducers/sidebar'),
        layers: require('../../MapStore2/web/client/reducers/layers'),
    }
};
