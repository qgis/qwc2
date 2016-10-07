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
const {Glyphicon} = require('react-bootstrap');
const Message = require('../../MapStore2/web/client/components/I18N/Message');
const ConfigUtils = require("../../MapStore2/web/client/utils/ConfigUtils");
const LocaleUtils = require("../../MapStore2/web/client/utils/LocaleUtils");
const {setCurrentTheme,setThemeSwitcherFilter,setThemeSwitcherVisibility} = require("../actions/theme");
const UrlParams = require("../utils/UrlParams");
require('./style/ThemeSwitcher.css');

const ThemeSwitcher = React.createClass({
    propTypes: {
        paneVisible: React.PropTypes.bool,
        filter: React.PropTypes.string,
        startuptheme: React.PropTypes.shape({
            id: React.PropTypes.string,
            activelayers: React.PropTypes.array}),
        activeTheme: React.PropTypes.string,
        activeThemeLayer: React.PropTypes.string,
        map: React.PropTypes.object,
        changeTheme: React.PropTypes.func,
        changeFilter: React.PropTypes.func,
        changeVisibility: React.PropTypes.func,
        addLayer: React.PropTypes.func
    },
    contextTypes: {
        messages: React.PropTypes.object
    },
    getDefaultProps() {
        return {
            paneVisible: false,
            filter: "",
            activeTheme: null,
            activeThemeLayer: null,
            map: null};
    },
    getInitialState: function() {
        return {themes: null };
    },
    componentDidMount() {
        fetch(ConfigUtils.getConfigProp("qwc2serverUrl") + "/getthemes")
        .then(function(response){ return response.json() })
        .then(function(obj){ this.populateThemesList(obj); }.bind(this));
    },
    componentWillReceiveProps(nextProps) {
        if(this.props.map === null && nextProps.map !== null && this.state.themes !== null) {
            this.setInitialTheme();
        }
    },
    populateThemesList(object) {
        this.setState({themes: object.themes});
        if(this.props.map !== null) {
            this.setInitialTheme();
        }
    },
    setInitialTheme() {
        var params = UrlParams.getParams();
        if(params.t) {
            let theme = this.getThemeById(this.state.themes, params.t);
            let layer = this.createLayerForTheme(theme, params.l ? params.l.split(",") : undefined);
            this.props.changeTheme(theme.id, layer, this.props.activeThemeLayer);
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
                if(group.items[i].name.includes(this.props.filter) ||
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
                (<li key={subdir.name} className="theme-group"><span>{subdir.name}</span><ul>{this.renderThemeGroup(subdir)}</ul></li>)
            );
        }
        return (<ul>
            {(group && group.items ? group.items : []).map(item => {
                return item.name.includes(this.props.filter) || item.keywords.includes(this.props.filter) ? (
                    <li key={item.id} className={this.props.activeTheme === item.id ? "theme-item theme-item-active" : "theme-item"} onClick={(ev)=>{this.themeClicked(item);}}>
                        {item.name}<br /><img src={"data:image/png;base64," + item.thumbnail} /><br />
                    <div className="theme-item-keywords" title={item.keywords}>{item.keywords}</div>
                    </li>) : null;
            })}
            {subtree}
            </ul>);
    },
    render() {
        return (
            <div id="ThemeSwitcher" className={this.props.paneVisible ? "themeswitcher-visible" : ""}>
                <div className="themeswitcher-title"><Message msgId="themeswitcher.title" /><Glyphicon onClick={this.closeClicked} glyph="remove"/></div>
                <input className="themeswitcher-filter" type="text" value={this.props.filter} onChange={this.filterChanged} placeholder={LocaleUtils.getMessageById(this.context.messages, "themeswitcher.filter")}/>
                <div className="themeswitcher-container">
                    {this.renderThemeGroup(this.state.themes)}
                </div>
            </div>
        );
    },
    createLayerForTheme(theme, visiblelayers=undefined) {
        var sublayers = [];
        if(visiblelayers !== undefined) {
            sublayers = theme.layers.filter(name => visiblelayers.includes(name));
        } else {
            sublayers = theme.layers.slice(0);
        }
        return {
            id: theme.name + Date.now().toString(),
            type: "wms",
            url: theme.url,
            visibility: true,
            name: theme.name,
            title: theme.name,
            boundingBox: {
                extent: theme.extent,
                crs: theme.crs
            },
            sublayers: (theme.layers || []).slice(0),
            opacities: Array.apply(null, Array(theme.layers.length)).map(() => 255),
            queryable: (theme.queryable || []).slice(0),
            params: {
                LAYERS: sublayers.join(","),
                OPACITIES: Array.apply(null, Array(sublayers.length)).map(() => "255").join(",")
            }
        }
    },
    themeClicked(theme) {
        this.props.changeTheme(theme.id, this.createLayerForTheme(theme), this.props.activeThemeLayer);
    },
    filterChanged(ev) {
        this.props.changeFilter(ev.target.value);
    },
    closeClicked() {
        this.props.changeVisibility(!this.props.paneVisible);
    }
});

const selector = (state) => ({
    paneVisible: state.theme && state.theme.switchervisible,
    activeTheme: state.theme ? state.theme.current : null,
    activeThemeLayer: state.theme ? state.theme.currentlayer : null,
    filter: state.theme ? state.theme.switcherfilter : "",
    startuptheme: state.theme ? state.theme.startuptheme : null,
    map: state.map
});


module.exports = {
    ThemeSwitcherPlugin: connect(selector, {
        changeTheme: setCurrentTheme,
        changeFilter: setThemeSwitcherFilter,
        changeVisibility: setThemeSwitcherVisibility
    })(ThemeSwitcher),
    reducers: {
        theme: require('../reducers/theme'),
        layers: require('../../MapStore2/web/client/reducers/layers')
    }
};
