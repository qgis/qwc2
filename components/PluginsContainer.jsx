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
            <div className="PluginsContainer" ref={this.setupTouchEvents}>
                {this.renderPlugins()}
                <WindowManager />
            </div>
        );
    }
    setupTouchEvents = (el) => {
        el.addEventListener('touchstart', ev => {
            this.touchY = ev.targetTouches[0].clientY;
        }, { passive: false });
        el.addEventListener('touchmove', this.preventOverscroll, { passive: false });
    };
    preventOverscroll = (ev) => {
        if (ev.touches[0].touchType !== "direct") {
            // Don't do anything for stylus inputs
            return;
        }
        let scrollEvent = false;
        let element = ev.target;
        const direction = ev.targetTouches[0].clientY - this.touchY;
        this.touchY = ev.targetTouches[0].clientY;
        while (!scrollEvent && element) {
            let scrollable = element.scrollHeight > element.clientHeight;
            // Workaround for resizeable-window having scrollHeight > clientHeight even though it has no scrollbar
            if (element.classList.contains('resizeable-window')) {
                scrollable = false;
            }
            if (element.type === "range") {
                // If it is a range element, treat it as a scroll event
                scrollEvent = true;
            } else if (scrollable && (element.scrollTop + element.clientHeight < element.scrollHeight) && direction < 0) {
                // User scrolls down and element is not at end of scroll
                scrollEvent = true;
            } else if (scrollable && element.scrollTop > 0 && direction > 0) {
                // User scrolls up and element is not at start of scroll
                scrollEvent = true;
            } else {
                element = element.parentElement;
            }
        }
        if (!scrollEvent) {
            ev.preventDefault();
        }
    };
}

export default connect((state) => ({
    theme: state.theme.current
}))(PluginsContainer);
