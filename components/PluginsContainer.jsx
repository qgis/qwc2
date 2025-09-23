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
import PluginStore from '../utils/PluginStore';
import ProcessNotifications from './ProcessNotifications';
import WindowManager from './WindowManager';

import './style/PluginsContainer.css';


export const MapButtonPortalContext = React.createContext(null);
export const MapContainerPortalContext = React.createContext(null);
export const AppInfosPortalContext = React.createContext(null);


class PluginsContainer extends React.Component {
    static propTypes = {
        children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
        className: PropTypes.string,
        mapMargins: PropTypes.object,
        pluginsConfig: PropTypes.array,
        theme: PropTypes.object
    };
    state = {
        mapButtonsContainerRef: null,
        mapContainerRef: null,
        appInfosContainerRef: null
    };
    renderPlugins = () => {
        const device = ConfigUtils.isMobile() ? 'mobile' : 'desktop';
        const plugins = PluginStore.getPlugins();
        return this.props.pluginsConfig.map(pluginConf => {
            const Plugin = plugins[pluginConf.name + "Plugin"];
            if (!Plugin) {
                return null;
            }
            const themeDevicePluginConfig = this.props.theme?.config?.[device]?.plugins?.[pluginConf.name] || {};
            const themePluginConfig = this.props.theme?.config?.plugins?.[pluginConf.name] || {};
            const cfg = {...(pluginConf.cfg || {}), ...themePluginConfig, ...themeDevicePluginConfig};
            return (
                <Plugin key={pluginConf.key ?? pluginConf.name} {...cfg} />
            );
        });
    };
    render() {
        const left = this.props.mapMargins.left + this.props.mapMargins.outerLeft;
        const top = this.props.mapMargins.top;
        const right = this.props.mapMargins.right + this.props.mapMargins.outerRight;
        const bottom = this.props.mapMargins.bottom;
        const mapContainerStyle = {
            left: 'calc(' + left + 'px)',
            top: 'calc(var(--topbar-height) + ' + top + 'px)',
            right: 'calc(' + right + 'px)',
            bottom: 'calc(var(--bottombar-height) + ' + bottom + 'px)'
        };
        const haveRefs = this.state.mapButtonsContainerRef && this.state.mapContainerRef && this.state.appInfosContainerRef;
        return (
            <div className={"plugins-container " + (this.props.className ?? "")} ref={this.setupTouchEvents}>
                <AppInfosPortalContext.Provider value={this.state.appInfosContainerRef}>
                    <MapButtonPortalContext.Provider value={this.state.mapButtonsContainerRef}>
                        <MapContainerPortalContext.Provider value={this.state.mapContainerRef}>
                            {haveRefs ? this.renderPlugins() : null}
                            {haveRefs ? this.props.children : null}
                        </MapContainerPortalContext.Provider>
                    </MapButtonPortalContext.Provider>
                </AppInfosPortalContext.Provider>
                <WindowManager />
                <div className="map-container" ref={this.setMapContainerRef} style={mapContainerStyle}>
                    <ProcessNotifications />
                </div>
                <div className="map-buttons-container" ref={this.setButtonContainerRef} style={mapContainerStyle} />
                <div className="app-infos-container" ref={this.setAppInfosContainerRef} style={mapContainerStyle} />
            </div>
        );
    }
    setupTouchEvents = (el) => {
        if (el) {
            el.addEventListener('touchstart', ev => {
                this.touchY = ev.targetTouches[0].clientY;
            }, { passive: false });
            el.addEventListener('touchmove', this.preventOverscroll, { passive: false });
            const resizeObserver = new ResizeObserver(entries => {
                const contentRectEntry = entries.find(entry => entry.contentRect);
                if (contentRectEntry) {
                    const height = contentRectEntry.contentRect.height;
                    el.style.setProperty('--plugins-container-height', `${height}px`);
                }
            });
            resizeObserver.observe(el);
        }
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
    setMapContainerRef = (el) => {
        this.setState({mapContainerRef: el});
    };
    setAppInfosContainerRef = (el) => {
        this.setState({appInfosContainerRef: el});
    };
    setButtonContainerRef = (el) => {
        this.setState({mapButtonsContainerRef: el});
        if (el) {
            const resizeObserver = new ResizeObserver(entries => {
                const contentRectEntry = entries.find(entry => entry.contentRect);
                if (contentRectEntry) {
                    const width = contentRectEntry.contentRect.width;
                    const height = contentRectEntry.contentRect.height;
                    el.style.setProperty('--buttons-container-width', `${width}px`);
                    el.style.setProperty('--buttons-container-height', `${height}px`);
                }
            });
            resizeObserver.observe(el);
            el.recomputeSpacers = () => {
                const slots = new Set();
                Array.from(el.childNodes).forEach(child => {
                    if (child.dataset.spacer) {
                        el.removeChild(child);
                    } else {
                        slots.add(child.dataset.slot);
                    }
                });
                const maxSlot = Math.max(...slots);
                for (let i = 0; i < maxSlot; ++i) {
                    if (!slots.has(String(i))) {
                        const child = document.createElement("div");
                        child.className = "map-buttons-spacer";
                        child.dataset.spacer = 1;
                        child.style.order = i;
                        el.appendChild(child);
                    }
                }
            };
        }
    };
}

export default connect((state) => ({
    // Just to trigger re-render when custom plugins change
    customPlugins: state.localConfig.customPlugins,
    mapMargins: state.windows.mapMargins,
    theme: state.theme.current
}))(PluginsContainer);
