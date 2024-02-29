/**
 * Copyright 2016 GeoSolutions Sas
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';

import WindowManager from './WindowManager';

import './style/PluginsContainer.css';

class PluginsContainer extends React.Component {
    static propTypes = {
        mode: PropTypes.string,
        plugins: PropTypes.object,
        pluginsAppConfig: PropTypes.object,
        pluginsConfig: PropTypes.object
    };
    renderPlugins = (pluginsConfig) => {
        return pluginsConfig.map((pluginConf, idx) => {
            const Plugin = this.props.plugins[pluginConf.name + "Plugin"];
            if (!Plugin) {
                // eslint-disable-next-line
                console.warn("Non-existing plugin: " + pluginConf.name);
                return null;
            }
            const cfg = pluginConf.cfg || {};
            const appCfg = this.props.pluginsAppConfig[pluginConf.name + "Plugin"] || {};
            return (<Plugin key={pluginConf.name + idx} {...cfg} {...appCfg} />);
        });
    };
    render() {
        if (this.props.pluginsConfig) {
            return (
                <div id="PluginsContainer">
                    {this.renderPlugins(this.props.pluginsConfig[this.props.mode])}
                    <WindowManager />
                </div>
            );
        }
        return null;
    }
}

export default connect((state) => ({
    pluginsConfig: state.localConfig.plugins,
    mode: state.browser.mobile ? 'mobile' : 'desktop'
}))(PluginsContainer);
