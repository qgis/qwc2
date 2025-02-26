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

import ConfigUtils from '../utils/ConfigUtils';
import WindowManager from './WindowManager';

import './style/PluginsContainer.css';


class PluginsContainer extends React.Component {
    static propTypes = {
        plugins: PropTypes.object,
        pluginsAppConfig: PropTypes.object,
        pluginsConfig: PropTypes.object,
        theme: PropTypes.object
    };
    renderPlugins = () => {
        const mode = ConfigUtils.isMobile() ? 'mobile' : 'desktop';
        const pluginsConfig = this.props.pluginsConfig[mode];
        return pluginsConfig.map((pluginConf, idx) => {
            const Plugin = this.props.plugins[pluginConf.name + "Plugin"];
            if (!Plugin) {
                return null;
            }
            const themeDevicePluginConfig = this.props.theme?.config?.[mode]?.plugins?.[pluginConf.name] || {};
            const themePluginConfig = this.props.theme?.config?.plugins?.[pluginConf.name] || {};
            const cfg = {...(pluginConf.cfg || {}), ...themePluginConfig, ...themeDevicePluginConfig};
            const appCfg = this.props.pluginsAppConfig[pluginConf.name + "Plugin"] || {};
            return (<Plugin key={pluginConf.name + idx} {...cfg} {...appCfg} />);
        });
    };
    render() {
        return (
            <div className="PluginsContainer">
                {this.renderPlugins()}
                <WindowManager />
            </div>
        );
    }
}

export default connect((state) => ({
    theme: state.theme.current
}))(PluginsContainer);
