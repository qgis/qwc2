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
const Message = require('../../MapStore2/web/client/components/I18N/Message');
const ConfigUtils = require("../../MapStore2/web/client/utils/ConfigUtils");
const LocaleUtils = require("../../MapStore2/web/client/utils/LocaleUtils");
const {setThemeFilter,setCurrentTheme,setThemeSwitcherVisibility} = require("../actions/themeswitcher");
require('./style/ThemeSwitcher.css');

const ThemeSwitcher = React.createClass({
    propTypes: {
        paneVisible: React.PropTypes.bool,
        filter: React.PropTypes.string,
        activeTheme: React.PropTypes.string,
        onFilterChanged: React.PropTypes.func,
        onThemeChanged: React.PropTypes.func,
        changeVisibility: React.PropTypes.func
    },
    contextTypes: {
        messages: React.PropTypes.object
    },
    getDefaultProps() {
        return {paneVisible: false, filter: "", activeTheme: ""};
    },
    getInitialState: function() {
        return {themes: {}};
    },
    componentDidMount() {
        fetch(ConfigUtils.getConfigProp("qwc2serverUrl") + "/getthemes")
        .then(function(response){ return response.json() })
        .then(function(obj){ this.populateThemesList(obj); }.bind(this));
    },
    populateThemesList(object) {
        this.setState({themes: object.themes});
    },
    groupMatchesFilter(group) {
        if(group.items) {
            for(let i = 0, n = group.items.length; i < n; ++i) {
                if(group.items[i].name.includes(this.props.filter) ||
                   group.items[i].keywords.includes(this.props.filter)) {
                    return true;
                }
            }
        }
        if(group.subdirs) {
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
            subtree = (group.subdirs ? group.subdirs : []).map(subdir =>
                (<li key={subdir.name} className="theme-group"><span>{subdir.name}</span><ul>{this.renderThemeGroup(subdir)}</ul></li>)
            );
        }
        return (<ul>
            {(group.items ? group.items : []).map(item => {
                return item.name.includes(this.props.filter) || item.keywords.includes(this.props.filter) ? (
                    <li key={item.id} className={this.props.activeTheme === item.id ? "theme-item theme-item-active" : "theme-item"} onClick={(ev)=>{this.themeClicked(item.id, item.layers);}}>
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
                <input type="text" value={this.props.filter} onChange={this.filterChanged} className="theme-filter" placeholder={LocaleUtils.getMessageById(this.context.messages, "themeswitcher.filter")}/>
                <div className="theme-container">
                    {this.renderThemeGroup(this.state.themes)}
                </div>
            </div>
        );
    },
    filterChanged(ev) {
        this.props.onFilterChanged(ev.target.value);
    },
    themeClicked(themeid, layers) {
        this.props.onThemeChanged(themeid, layers);
    },
    closeClicked() {
        this.props.changeVisibility(!this.props.paneVisible);
    }
});

const selector = (state) => ({
    paneVisible: state.themeswitcher && state.themeswitcher.visible,
    activeTheme: state.themeswitcher ? state.themeswitcher.theme : "",
    filter: state.themeswitcher ? state.themeswitcher.filter : ""
});


module.exports = {
    ThemeSwitcherPlugin: connect(selector, {
        onFilterChanged: setThemeFilter,
        onThemeChanged: setCurrentTheme,
        changeVisibility: setThemeSwitcherVisibility
    })(ThemeSwitcher),
    reducers: {
        themeswitcher: require('../reducers/themeswitcher')
    }
};
