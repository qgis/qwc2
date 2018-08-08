/**
 * Copyright 2016, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
const React = require('react');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const url = require('url');
const urlQuery = url.parse(window.location.href, true).query;

require('./style/PluginsContainer.css');

class PluginsContainer extends React.Component {
    static propTypes = {
        mode: PropTypes.string,
        plugins: PropTypes.object,
        pluginsConfig: PropTypes.object,
        pluginsAppConfig: PropTypes.object
    }
    static defaultProps = {
        mode: 'desktop',
        plugins: {},
        pluginsConfig: {},
        pluginsAppConfig: {}
    }
    renderPlugins = (pluginsConfig) => {
        return pluginsConfig.map(pluginConf => {
            let Plugin = this.props.plugins[pluginConf.name + "Plugin"];
            if(!Plugin) {
                console.warn("Non-existing plugin: " + pluginConf.name);
                return null;
            }
            let cfg = pluginConf.cfg || {};
            let appCfg = this.props.pluginsAppConfig[pluginConf.name + "Plugin"] || {};
            return (<Plugin key={pluginConf.name} {...cfg} {...appCfg} />);
        });
    }
    render() {
        if (this.props.pluginsConfig) {
            return (
                <div id="PluginsContainer">
                    {
                     this.renderPlugins(this.props.pluginsConfig[this.props.mode])
                    }
                </div>
            );
        }
        return null;
    }
}

module.exports = connect((state) => ({
    pluginsConfig: state.localConfig && state.localConfig.plugins || null,
    mode: (urlQuery.mode || (state.browser && state.browser.mobile ? 'mobile' : 'desktop'))
}))(PluginsContainer);
