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
const axios = require('axios');
const Message = require('../../MapStore2/web/client/components/I18N/Message');
const ConfigUtils = require("../../MapStore2/web/client/utils/ConfigUtils");
const LocaleUtils = require("../../MapStore2/web/client/utils/LocaleUtils");
const {setCurrentTheme,setThemeSwitcherFilter} = require("../actions/theme");
const {setCurrentTask} = require("../actions/task");
const {SideBar} = require('../components/SideBar');
const UrlParams = require("../utils/UrlParams");
const LayerUtils = require('../utils/LayerUtils');
require('./style/ThemeSwitcher.css');

const ThemeSwitcher = React.createClass({
    propTypes: {
        filter: React.PropTypes.string,
        activeTheme: React.PropTypes.object,
        activeThemeLayer: React.PropTypes.string,
        haveMap: React.PropTypes.bool,
        layers: React.PropTypes.array,
        changeTheme: React.PropTypes.func,
        changeFilter: React.PropTypes.func,
        addLayer: React.PropTypes.func,
        setCurrentTask: React.PropTypes.func
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
        if(!this.props.haveMap && nextProps.haveMap || this.props.haveMap && !this.state.themes) {
            // As soon as map is set, fetch themes and restore initial theme
            // NOTE: set dummy themes state to fetch themes only once
            this.setState({themes: {}}, () => {
                axios.get("themes.json")
                .then(response => this.populateThemesList(response.data));
            });
        }
    },
    populateThemesList(object) {
        this.setState({themes: object.themes});
        var params = UrlParams.getParams();
        let theme = this.getThemeById(this.state.themes, params.t || this.state.themes.defaultTheme);
        if(theme) {
            let layer = this.createLayerForTheme(theme, params.l ? params.l.split(",") : undefined);
            const scales = theme.scales || this.state.themes.defaultScales;
            // extent to which to zoom to
            let extent = {
                bounds: (params.ie || "").split(";").map(x => parseFloat(x)),
                crs: "EPSG:4326"
            }
            if(params.t === undefined || extent.bounds.length !== 4) {
                extent.bounds = theme.extent;
                extent.crs = theme.crs;
            }
            UrlParams.updateParams({ie: undefined});
            this.props.changeTheme(theme, layer, this.createBackgroundLayersForTheme(theme, params.bl), this.props.activeThemeLayer, this.currentBackgroundLayerIds(), scales, extent);
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
    groupMatchesFilter(group, filter) {
        if(group && group.items) {
            for(let i = 0, n = group.items.length; i < n; ++i) {
                if(group.items[i].title.match(filter) ||
                   group.items[i].keywords.match(filter)) {
                    return true;
                }
            }
        }
        if(group && group.subdirs) {
            for(let i = 0, n = group.subdirs.length; i < n; ++i) {
                if(this.groupMatchesFilter(group.subdirs[i], filter)) {
                    return true;
                }
            }
        }
        return false;
    },
    renderThemeGroup(group) {
        let filter = new RegExp(this.props.filter.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&"), "i");
        let subdirs = (group && group.subdirs ? group.subdirs : []);
        if(this.props.filter !== "") {
            subdirs = subdirs.filter(subdir => this.groupMatchesFilter(subdir, filter));
        }
        let subtree = subdirs.map(subdir =>
            (<li key={subdir.title} className="theme-group"><span>{subdir.title}</span><ul>{this.renderThemeGroup(subdir)}</ul></li>)
        );
        let activeThemeId = this.props.activeTheme ? this.props.activeTheme.id : null;
        return (<ul role="body">
            {(group && group.items ? group.items : []).map(item => {
                return item.title.match(filter) || item.keywords.match(filter) ? (
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
            <SideBar id="ThemeSwitcher" width="85%">
                <span className="sidebar-title" role="title">
                    <img src="assets/img/themes.svg"/>
                    <Message msgId="appmenu.items.themes" />
                    <input type="text" value={this.props.filter} onChange={this.filterChanged} placeholder={LocaleUtils.getMessageById(this.context.messages, "themeswitcher.filter")}/>
                </span>
                {this.renderThemeGroup(this.state.themes)}
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
            const backgroundLayer = this.state.themes.backgroundLayers.find((layer) => layer.name === themeBackgroundLayer.name);
            if (backgroundLayer !== undefined) {
                let visibility = themeBackgroundLayer.visibility || false;
                if (visibleBackgroundLayer !== undefined) {
                    visibility = (backgroundLayer.name === visibleBackgroundLayer);
                }
                let newBackgroundLayer = assign({}, backgroundLayer, {
                    group: 'background',
                    visibility: visibility
                });
                // remove thumbnail data from layer config
                delete newBackgroundLayer.thumbnail;
                backgroundLayers.push(newBackgroundLayer);
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
        const scales = theme.scales || this.state.themes.defaultScales;
        this.props.changeTheme(theme, this.createLayerForTheme(theme), this.createBackgroundLayersForTheme(theme), this.props.activeThemeLayer, this.currentBackgroundLayerIds(), scales, true);
        this.props.setCurrentTask(null);
    },
    filterChanged(ev) {
        this.props.changeFilter(ev.target.value);
    }
});

const selector = (state) => ({
    activeTheme: state.theme ? state.theme.current : null,
    activeThemeLayer: state.theme ? state.theme.currentlayer : null,
    filter: state.theme ? state.theme.switcherfilter : "",
    haveMap: state.map ? true : false,
    layers: state.layers && state.layers.flat ? state.layers.flat : []
});


module.exports = {
    ThemeSwitcherPlugin: connect(selector, {
        changeTheme: setCurrentTheme,
        changeFilter: setThemeSwitcherFilter,
        setCurrentTask: setCurrentTask
    })(ThemeSwitcher),
    reducers: {
        theme: require('../reducers/theme'),
        task: require('../reducers/task'),
        layers: require('../../MapStore2/web/client/reducers/layers'),
    }
};
