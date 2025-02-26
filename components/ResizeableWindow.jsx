/**
 * Copyright 2017-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import ReactDOM from 'react-dom';
import {connect} from 'react-redux';
import * as portals from 'react-reverse-portal';
import {Rnd} from 'react-rnd';

import classnames from 'classnames';
import PropTypes from 'prop-types';
import {v1 as uuidv1} from 'uuid';

import {raiseWindow, registerWindow, unregisterWindow, setSplitScreen} from '../actions/windows';
import ConfigUtils from '../utils/ConfigUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MiscUtils from '../utils/MiscUtils';
import Icon from './Icon';
import Spinner from './widgets/Spinner';

import './style/ResizeableWindow.css';

const WINDOW_GEOMETRIES = {};

class ResizeableWindow extends React.Component {
    static propTypes = {
        baseZIndex: PropTypes.number,
        bottombarHeight: PropTypes.number,
        busyIcon: PropTypes.bool,
        children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
        dockable: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
        extraControls: PropTypes.arrayOf(PropTypes.shape({
            active: PropTypes.bool,
            icon: PropTypes.string.isRequired,
            callback: PropTypes.func.isRequired,
            title: PropTypes.string
        })),
        fitHeight: PropTypes.bool,
        fullscreen: PropTypes.bool,
        icon: PropTypes.string,
        initialHeight: PropTypes.number,
        initialWidth: PropTypes.number,
        initialX: PropTypes.number,
        initialY: PropTypes.number,
        initiallyDocked: PropTypes.bool,
        mapMargins: PropTypes.object,
        maxHeight: PropTypes.number,
        maxWidth: PropTypes.number,
        maximizeable: PropTypes.bool,
        menuMargins: PropTypes.object,
        minHeight: PropTypes.number,
        minWidth: PropTypes.number,
        minimizeable: PropTypes.bool,
        onClose: PropTypes.func,
        onExternalWindowResized: PropTypes.func,
        onGeometryChanged: PropTypes.func,
        raiseWindow: PropTypes.func,
        registerWindow: PropTypes.func,
        scrollable: PropTypes.bool,
        setSplitScreen: PropTypes.func,
        splitScreenWhenDocked: PropTypes.bool,
        splitTopAndBottomBar: PropTypes.bool,
        title: PropTypes.string,
        topbarHeight: PropTypes.number,
        unregisterWindow: PropTypes.func,
        usePortal: PropTypes.bool,
        visible: PropTypes.bool,
        windowStacking: PropTypes.array
    };
    static defaultProps = {
        baseZIndex: 10,
        initialX: null,
        initialY: null,
        initialWidth: 240,
        initialHeight: 320,
        minWidth: 50,
        minHeight: 50,
        maxWidth: null,
        maxHeight: null,
        maximizeable: true,
        minimizeable: false,
        visible: true,
        dockable: true,
        onExternalWindowResized: () => {},
        onGeometryChanged: () => {},
        externalWindow: null,
        usePortal: true
    };
    state = {
        geometry: null
    };
    constructor(props) {
        super(props);
        this.rnd = null;
        this.dragShield = null;
        this.id = uuidv1();
        this.portalNode = props.usePortal ? portals.createHtmlPortalNode() : null;
    }
    componentDidMount() {
        this.props.registerWindow(this.id);
        window.addEventListener('beforeunload', this.closeExternalWindow, {once: true});
    }
    componentWillUnmount() {
        this.props.unregisterWindow(this.id);
        if (this.props.splitScreenWhenDocked) {
            this.props.setSplitScreen(this.id, null, null, false);
        }
        if (this.state.externalWindow) {
            this.state.externalWindow.close();
        }
        window.removeEventListener('beforeunload', this.closeExternalWindow);
    }
    componentDidUpdate(prevProps, prevState) {
        if (!this.state.geometry || !prevState.geometry) {
            return;
        }
        if (this.rnd && this.props.visible && this.props.visible !== prevProps.visible) {
            this.props.onGeometryChanged(this.state.geometry);
            this.rnd.updatePosition(this.state.geometry);
        }
        if (this.state.geometry !== prevState.geometry) {
            this.props.onGeometryChanged(this.state.geometry);
            WINDOW_GEOMETRIES[this.props.title] = this.state.geometry;
        }
        if (this.props.splitScreenWhenDocked && (
            this.props.visible !== prevProps.visible ||
            this.state.geometry !== prevState.geometry ||
            this.state.externalWindow !== prevState.externalWindow
        )) {
            if (
                (!this.props.visible && prevProps.visible) ||
                (this.state.geometry.docked === false && prevState.geometry.docked !== false) ||
                (this.state.geometry.maximized === true && prevState.geometry.maximized !== true) ||
                (this.state.externalWindow && !prevState.externalWindow)
            ) {
                this.props.setSplitScreen(this.id, null, null, false);
            } else if (this.props.visible && this.state.geometry.docked && !this.state.externalWindow && !this.state.geometry.maximized) {
                const dockSide = this.props.dockable === true ? "left" : this.props.dockable;
                const dockSize = ["left", "right"].includes(dockSide) ? this.state.geometry.width : this.state.geometry.height;
                this.props.setSplitScreen(this.id, dockSide, dockSize, this.props.splitTopAndBottomBar);
            }
        }
    }
    renderRole = (role) => {
        return React.Children.toArray(this.props.children).find((child) => child.props.role === role);
    };
    onClose = (ev) => {
        if (this.state.externalWindow) {
            this.state.externalWindow.removeEventListener('beforeunload', this.props.onClose);
        }
        this.props.onClose();
        ev.stopPropagation();
    };
    renderTitleBar = () => {
        if (this.props.fullscreen) {
            return null;
        }
        const maximized = this.state.geometry.maximized ? true : false;
        const minimized = this.state.geometry.minimized ? true : false;
        const docked = this.state.geometry.docked;
        const dockSide = this.props.dockable === true ? "left" : this.props.dockable;
        let dockable = this.props.dockable && !this.state.externalWindow;
        if (ConfigUtils.getConfigProp("globallyDisableDockableDialogs")) {
            dockable = false;
        }
        let maximizeable = this.props.maximizeable && !this.state.externalWindow && !this.props.fitHeight;
        if (ConfigUtils.getConfigProp("globallyDisableMaximizeableDialogs")) {
            maximizeable = false;
        }
        const minimizeable = this.props.minimizeable && !this.state.externalWindow;

        let icon = null;
        if (this.props.busyIcon) {
            icon = (<Spinner />);
        } else if (this.props.icon) {
            icon = (<Icon className="resizeable-window-titlebar-icon" icon={this.props.icon} size="large" />);
        }

        let dockIcon = docked ? 'undock' : 'dock';
        dockIcon = dockIcon + "_" + dockSide;

        const iconClasses = classnames({
            "resizeable-window-titlebar-control": true,
            "resizeable-window-nodrag": true
        });

        let detachIcons = null;
        if (!ConfigUtils.isMobile() && !ConfigUtils.getConfigProp("globallyDisableDetachableDialogs")) {
            detachIcons = this.state.externalWindow ? (
                <Icon className={iconClasses} icon="embed" onClick={this.moveToInternalWindow} title={LocaleUtils.tr("window.embed")} />
            ) : (
                <Icon className={iconClasses} icon="detach" onClick={this.moveToExternalWindow} title={LocaleUtils.tr("window.detach")} />
            );
        }
        return (
            <div className="resizeable-window-titlebar" onDoubleClick={this.state.externalWindow ? null : this.toggleMaximize}>
                {icon}
                <span className="resizeable-window-titlebar-title">
                    {this.props.title}
                </span>
                {(this.props.extraControls || []).map(entry => {
                    const extraIconClasses = classnames({
                        "resizeable-window-titlebar-extra-control": true,
                        "resizeable-window-titlebar-extra-control-active": entry.active,
                        "resizeable-window-nodrag": true
                    });
                    return (
                        <Icon
                            className={extraIconClasses} icon={entry.icon} key={entry.icon}
                            onClick={entry.callback} title={entry.title} />
                    );
                })}
                {!maximized && dockable ? (
                    <Icon
                        className={iconClasses} icon={dockIcon}
                        onClick={this.toggleDock}
                        title={this.state.geometry.docked ? LocaleUtils.tr("window.undock") : LocaleUtils.tr("window.dock")} />
                ) : null}
                {minimizeable ? (
                    <Icon className={iconClasses} icon={minimized ? "unminimize" : "minimize"} onClick={this.toggleMinimize} title={minimized ? LocaleUtils.tr("window.unminimize") : LocaleUtils.tr("window.minimize")} />
                ) : null}
                {maximizeable ? (
                    <Icon className={iconClasses} icon={maximized ? "unmaximize" : "maximize"} onClick={this.toggleMaximize} title={maximized ? LocaleUtils.tr("window.unmaximize") : LocaleUtils.tr("window.maximize")} />
                ) : null}
                {detachIcons}
                {this.props.onClose ? (
                    <Icon className={iconClasses} icon="remove" onClick={this.onClose} title={LocaleUtils.tr("window.close")} />
                ) : null}
            </div>
        );
    };
    renderInternalWindowContainer = () => {
        const docked = this.state.geometry?.docked ?? this.props.initiallyDocked;
        const maximized = this.state.geometry?.maximized ?? false;
        const splitTopAndBottomBar = this.props.splitTopAndBottomBar && this.props.splitScreenWhenDocked && (docked || maximized);
        const marginLeft = this.props.mapMargins.splitTopAndBottomBar && !splitTopAndBottomBar ? this.props.mapMargins.left : 0;
        const marginRight = this.props.mapMargins.splitTopAndBottomBar && !splitTopAndBottomBar ? this.props.mapMargins.right : 0;
        const containerStyle = {
            left: (marginLeft + this.props.menuMargins.left) + 'px',
            right: (marginRight + this.props.menuMargins.right) + 'px',
            top: splitTopAndBottomBar ? 0 : this.props.topbarHeight + 'px',
            bottom: splitTopAndBottomBar ? 0 : this.props.bottombarHeight + 'px',
            zIndex: splitTopAndBottomBar ? 110 : this.props.baseZIndex + this.props.windowStacking.findIndex(item => item === this.id)
        };
        return (
            <div className="resizeable-window-container" key="InternalWindow" ref={this.setInitialSize} style={containerStyle}>
                {this.props.visible && this.state.geometry ? this.renderInternalWindow() : null}
            </div>
        );
    };
    renderInternalWindow = () => {
        const maximized = (this.state.geometry.maximized || this.props.fullscreen) ? true : false;
        const minimized = this.state.geometry.minimized ? true : false;
        const dockSide = this.props.dockable === true ? "left" : this.props.dockable;

        const bodyclasses = classnames({
            "resizeable-window-body": true,
            "resizeable-window-body-scrollable": this.props.scrollable,
            "resizeable-window-body-nonscrollable": !this.props.scrollable,
            "resizeable-window-nodrag": true
        });

        const windowclasses = classnames({
            "resizeable-window": true,
            "resizeable-window-maximized": maximized,
            "resizeable-window-minimized": minimized,
            "resizeable-window-fit-height": this.props.fitHeight,
            "resizeable-window-docked-left": !this.props.splitScreenWhenDocked && this.state.geometry.docked && dockSide === "left" && !maximized,
            "resizeable-window-docked-right": !this.props.splitScreenWhenDocked && this.state.geometry.docked && dockSide === "right" && !maximized,
            "resizeable-window-split-left": this.props.splitScreenWhenDocked && this.state.geometry.docked && dockSide === "left" && !maximized,
            "resizeable-window-split-right": this.props.splitScreenWhenDocked && this.state.geometry.docked && dockSide === "right" && !maximized,
            "resizeable-window-docked-top": this.state.geometry.docked && dockSide === "top" && !maximized,
            "resizeable-window-docked-bottom": this.state.geometry.docked && dockSide === "bottom" && !maximized
        });
        let resizeMode = {
            left: true,
            right: true,
            top: true,
            bottom: true,
            bottomLeft: true,
            bottomRight: true,
            topLeft: true,
            topRight: true
        };
        if (maximized || minimized) {
            resizeMode = false;
        } else if (this.state.geometry.docked) {
            resizeMode = {
                left: dockSide === "right",
                right: dockSide === "left",
                top: dockSide === "bottom",
                bottom: (dockSide !== "bottom" && !this.props.splitScreenWhenDocked) || (this.props.splitScreenWhenDocked && dockSide === "top")
            };
        }
        if (this.props.fitHeight) {
            resizeMode.top = false;
            resizeMode.bottom = false;
            resizeMode.bottomLeft = true;
            resizeMode.bottomRight = true;
            resizeMode.topLeft = true;
            resizeMode.topRight = true;
        }
        return (
            <Rnd bounds="parent" cancel=".resizeable-window-nodrag"
                className={windowclasses} default={this.state.geometry}
                disableDragging={maximized || this.state.geometry.docked} enableResizing={resizeMode}
                maxHeight={this.props.maxHeight || "100%"} maxWidth={this.props.maxWidth || "100%"}
                minHeight={this.props.minHeight} minWidth={this.props.minWidth}
                onDragStart={this.onDragStart}
                onDragStop={this.onDragStop}
                onMouseDown={() => this.props.raiseWindow(this.id)}
                onResizeStop={this.onResizeStop}
                ref={this.initRnd}
            >
                <div className="resizeable-window-contents">
                    {this.renderTitleBar()}
                    <div className={bodyclasses} onMouseDown={() => this.props.raiseWindow(this.id)}>
                        <div className="resizeable-window-drag-shield" ref={el => {this.dragShield = el;}} />
                        {this.portalNode ? (
                            <div className="resizeable-window-portal-container">
                                <portals.OutPortal node={this.portalNode} />
                            </div>
                        ) : this.renderRole("body")}
                    </div>
                </div>
            </Rnd>
        );
    };
    setInitialSize = (container) => {
        if (!container) {
            return;
        }
        const width = Math.min(this.props.initialWidth, container.offsetWidth);
        const height = Math.min(this.props.initialHeight, container.offsetHeight);
        let geometry = null;
        if (WINDOW_GEOMETRIES[this.props.title]) {
            geometry = WINDOW_GEOMETRIES[this.props.title];
        } else {
            geometry = {
                x: this.props.initialX !== null ? this.computeInitialX(container, this.props.initialX) : Math.max(0, Math.round(0.5 * (container.offsetWidth - width))),
                y: this.props.initialY !== null ? this.computeInitialY(container, this.props.initialY) : Math.max(0, Math.round(0.5 * (container.offsetHeight - height))),
                width: width,
                height: height,
                docked: this.props.initiallyDocked
            };
        }
        if (this.props.splitScreenWhenDocked && geometry.docked) {
            const dockSide = this.props.dockable === true ? "left" : this.props.dockable;
            const dockSize = ["left", "right"].includes(dockSide) ? geometry.width : geometry.height;
            this.props.setSplitScreen(this.id, dockSide, dockSize, this.props.splitTopAndBottomBar);
        }
        this.setState({geometry: geometry});
    };
    computeInitialX = (container, x) => {
        return x > 0 || Object.is(x, 0) ? x : container.offsetWidth - this.props.initialWidth - Math.abs(x);
    };
    computeInitialY = (container, y) => {
        return y > 0 || Object.is(y, 0) ? y : container.offsetHeight - this.props.initialHeight - Math.abs(y);
    };
    renderExternalWindow = () => {
        return ReactDOM.createPortal((
            <div className="resizeable-window-contents">
                {this.renderTitleBar()}
                {this.portalNode ? (
                    <div className="resizeable-window-portal-container">
                        <portals.OutPortal node={this.portalNode} />
                    </div>
                ) : this.renderRole("body")}
            </div>
        ), this.state.externalWindow.document.body);
    };
    render() {
        return [this.portalNode ? (
            <portals.InPortal key="InPortal" node={this.portalNode}>
                {this.renderRole("body")}
            </portals.InPortal>
        ) : null, this.state.externalWindow ? (
            this.renderExternalWindow()
        ) : (
            this.renderInternalWindowContainer()
        )];
    }
    initRnd = (el) => {
        if (el) {
            this.rnd = el;
            this.rnd.updatePosition(this.state.geometry);
        }
    };
    onDragStart = () => {
        if (this.dragShield) {
            this.dragShield.style.display = 'initial';
        }
    };
    onDragStop = (ev, data) => {
        this.setState((state) => ({
            geometry: {...state.geometry, x: data.x, y: data.y}
        }));
        if (this.dragShield) {
            this.dragShield.style.display = 'none';
        }
    };
    onResizeStop = (ev, dir, ref, delta, position) => {
        // Delay one event loop cycle else clientWidth / clientHeight may not yet be up-to-date
        setTimeout(() => {
            this.setState((state) => ({
                geometry: {
                    ...state.geometry,
                    x: position.x,
                    y: position.y,
                    width: ref.clientWidth,
                    height: ref.clientHeight
                }
            }));
        }, 0);
    };
    toggleDock = () => {
        this.setState((state) => ({
            geometry: {
                ...state.geometry,
                docked: !state.geometry.docked
            }
        }));
        this.rnd.updatePosition(this.state.geometry);
    };
    toggleMinimize = () => {
        this.setState((state) => ({
            geometry: {
                ...state.geometry,
                minimized: !state.geometry.minimized
            }
        }));
    };
    toggleMaximize = () => {
        this.setState((state) => ({
            geometry: {
                ...state.geometry,
                maximized: !state.geometry.maximized,
                minimized: false
            }
        }));
    };
    moveToExternalWindow = () => {
        const title = this.props.title;
        const windowOptions = [
            "popup=true",
            "toolbar=no",
            "locationbar=no",
            "location=no",
            "directories=no",
            "status=no",
            "menubar=no",
            "scrollbars=yes",
            "resizable=yes",
            "width=" + this.state.geometry.width,
            "height=" + this.state.geometry.height
        ].join(", ");
        const externalWindow = window.open('about:blank', "_blank", windowOptions);
        externalWindow.addEventListener('resize', this.props.onExternalWindowResized, false);
        const loadInterval = setInterval(() => {
            if (externalWindow.document.readyState !== 'complete') {
                return;
            }
            clearInterval(loadInterval);
            externalWindow.addEventListener('beforeunload', this.props.onClose, {capture: false, once: true});
            const titleEl = externalWindow.document.createElement('title');
            titleEl.appendChild(externalWindow.document.createTextNode(title));
            externalWindow.document.head.appendChild(titleEl);

            const icon = MiscUtils.getFaviconFromIcon(this.props.icon, 48);
            if (icon) {
                const iconEl = externalWindow.document.createElement('link');
                iconEl.rel = "icon";
                iconEl.href = icon;
                iconEl.sizes = "48x48";
                externalWindow.document.head.appendChild(iconEl);
            }

            // Inherit styles
            Array.from(document.styleSheets).forEach(styleSheet => {
                if (styleSheet.href) {
                    // External styles
                    const linkElement = externalWindow.document.createElement('link');
                    linkElement.rel = 'stylesheet';
                    linkElement.href = styleSheet.href;
                    externalWindow.document.head.appendChild(linkElement);
                } else if (styleSheet.cssRules) {
                    // Inline styles
                    const styleElement = externalWindow.document.createElement('style');
                    const cssText = Array.from(styleSheet.cssRules).map(rule => rule.cssText).join("\n");
                    styleElement.appendChild(externalWindow.document.createTextNode(cssText));
                    externalWindow.document.head.appendChild(styleElement);
                }
            });
            externalWindow.document.querySelector(':root').style.setProperty('--topbar-height',
                document.querySelector(':root').style.getPropertyValue('--topbar-height')
            );
            externalWindow.document.querySelector(':root').style.setProperty('--bottombar-height',
                document.querySelector(':root').style.getPropertyValue('--bottombar-height')
            );

            this.setState({externalWindow: externalWindow});
        }, 50);
    };
    moveToInternalWindow = () => {
        if (this.state.externalWindow) {
            this.state.externalWindow.removeEventListener('beforeunload', this.props.onClose);
            this.state.externalWindow.removeEventListener('resize', this.props.onExternalWindowResized, false);
            this.state.externalWindow.close();
            this.setState({externalWindow: null});
        }
    };
    closeExternalWindow = () => {
        if (this.state.externalWindow) {
            this.state.externalWindow.close();
        }
    };
}

export default connect((state) => ({
    windowStacking: state.windows.stacking,
    topbarHeight: state.windows.topbarHeight,
    bottombarHeight: state.windows.bottombarHeight,
    mapMargins: state.windows.mapMargins,
    menuMargins: state.windows.menuMargins
}), {
    raiseWindow: raiseWindow,
    registerWindow: registerWindow,
    setSplitScreen: setSplitScreen,
    unregisterWindow: unregisterWindow
})(ResizeableWindow);
