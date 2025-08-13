/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import ol from 'openlayers';
import PropTypes from 'prop-types';

import {changeZoomLevel, setDisplayCrs} from '../actions/map';
import {openExternalUrl, setBottombarHeight} from '../actions/windows';
import CoordinateDisplayer from '../components/CoordinateDisplayer';
import InputContainer from '../components/widgets/InputContainer';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';

import './style/BottomBar.css';


/**
 * Bottom bar, displaying mouse coordinate, scale, etc.
 */
class BottomBar extends React.Component {
    static propTypes = {
        /** Additional bottombar links.`side` can be `left` or `right` (default). */
        additionalBottomBarLinks: PropTypes.arrayOf(PropTypes.shape({
            label: PropTypes.string,
            labelMsgId: PropTypes.string,
            side: PropTypes.string,
            url: PropTypes.string,
            urlTarget: PropTypes.string,
            icon: PropTypes.string
        })),
        additionalMouseCrs: PropTypes.array,
        changeZoomLevel: PropTypes.func,
        /** Custom coordinate formatter, as `(coordinate, crs) => string`. */
        coordinateFormatter: PropTypes.func,
        /** Whether to display the coordinates in the bottom bar. */
        displayCoordinates: PropTypes.bool,
        /** Whether to display the scalebar in the bottom bar. */
        displayScalebar: PropTypes.bool,
        /** Whether to display the scale in the bottom bar. */
        displayScales: PropTypes.bool,
        fullscreen: PropTypes.bool,
        map: PropTypes.object,
        mapMargins: PropTypes.object,
        openExternalUrl: PropTypes.func,
        /** See [OpenLayers API doc](https://openlayers.org/en/latest/apidoc/module-ol_control_ScaleLine-ScaleLine.html) */
        scalebarOptions: PropTypes.object,
        setBottombarHeight: PropTypes.func,
        setDisplayCrs: PropTypes.func,
        /** The URL of the terms label anchor. */
        termsUrl: PropTypes.string,
        /** Icon of the terms inline window. Relevant only when `termsUrlTarget` is `iframe`. */
        termsUrlIcon: PropTypes.string,
        /** The target where to open the terms URL. If `iframe`, it will be displayed in an inline window, otherwise in a new tab. You can also use the `:iframedialog:<dialogname>:<options>` syntax to set up the inline window. */
        termsUrlTarget: PropTypes.string,
        /** The URL of the viewer title label anchor. */
        viewertitleUrl: PropTypes.string,
        /** Icon of the viewer title inline window. Relevant only when `viewertitleUrl` is `iframe`. */
        viewertitleUrlIcon: PropTypes.string,
        /** The target where to open the viewer title URL. If `iframe`, it will be displayed in an inline window, otherwise in a new tab. You can also use the `:iframedialog:<dialogname>:<options>` syntax to set up the inline window. */
        viewertitleUrlTarget: PropTypes.string
    };
    static defaultProps = {
        displayCoordinates: true,
        displayScalebar: true,
        displayScales: true
    };
    state = {
        scale: 0
    };
    componentWillUnmount() {
        if (this.scalebar) {
            MapUtils.getHook(MapUtils.GET_MAP)?.removeControl?.(this.scalebar);
        }
    }
    componentDidUpdate(prevProps) {
        if (this.props.map !== prevProps.map) {
            this.setState({scale: Math.round(MapUtils.computeForZoom(this.props.map.scales, this.props.map.zoom))});
        }
    }
    render() {
        if (this.props.fullscreen) {
            return null;
        }

        const leftBottomLinks = (this.props.additionalBottomBarLinks || []).filter(entry => entry.side === "left").map(this.renderLink);
        const rightBottomLinks = (this.props.additionalBottomBarLinks || []).filter(entry => entry.side !== "left").map(this.renderLink);
        if (this.props.viewertitleUrl) {
            const entry = {url: this.props.viewertitleUrl, urlTarget: this.props.viewertitleUrlTarget, label: LocaleUtils.tr("bottombar.viewertitle_label"), icon: this.props.viewertitleUrlIcon};
            rightBottomLinks.push(this.renderLink(entry));
        }
        if (this.props.termsUrl) {
            const entry = {url: this.props.termsUrl, urlTarget: this.props.termsUrlTarget, label: LocaleUtils.tr("bottombar.terms_label"), icon: this.props.termsUrlIcon};
            rightBottomLinks.push(this.renderLink(entry));
        }
        const enabledMouseCrs = [...this.props.additionalMouseCrs || [], this.props.map.projection, "EPSG:4326"];
        // eslint-disable-next-line no-unused-vars
        const availableCRS = Object.fromEntries(Object.entries(CoordinatesUtils.getAvailableCRS()).filter(([key, value]) => {
            return enabledMouseCrs.includes(key);
        }));
        let scalebar = null;
        if (this.props.displayScalebar) {
            scalebar = (<div className="bottombar-scalebar-container" ref={this.initScaleBar} />);
        }
        let coordinates = null;
        if (this.props.displayCoordinates) {
            coordinates = (
                <div className="controlgroup">
                    <span className="bottombar-mousepos-label">{LocaleUtils.tr("bottombar.mousepos_label")}:&nbsp;</span>
                    <CoordinateDisplayer className={"bottombar-mousepos"} coordinateFormatter={this.props.coordinateFormatter} displayCrs={this.props.map.displayCrs} mapCrs={this.props.map.projection} />
                    <select onChange={ev => this.props.setDisplayCrs(ev.target.value)} value={this.props.map.displayCrs}>
                        {Object.keys(availableCRS).map(crs =>
                            (<option key={crs} value={crs}>{availableCRS[crs].label}</option>)
                        )}
                    </select>
                </div>
            );
        }
        let scales = null;
        if (this.props.displayScales) {
            scales = (
                <div>
                    <span className="bottombar-scales-label">{LocaleUtils.tr("bottombar.scale_label")}:&nbsp;</span>
                    <InputContainer className="bottombar-scale-combo">
                        <span className="bottombar-scale-combo-prefix" role="prefix"> 1 : </span>
                        <select onChange={ev => this.props.changeZoomLevel(parseInt(ev.target.value, 10))} role="input" value={Math.round(this.props.map.zoom)}>
                            {this.props.map.scales.map((item, index) =>
                                (<option key={index} value={index}>{LocaleUtils.toLocaleFixed(item, 0)}</option>)
                            )}
                        </select>
                        <input
                            onBlur={ev => this.setScale(ev.target.value)}
                            onChange={ev => this.setState({scale: ev.target.value})}
                            onKeyUp={ev => { if (ev.key === 'Enter') this.setScale(ev.target.value); } }
                            role="input" type="text" value={LocaleUtils.toLocaleFixed(this.state.scale, 0)}/>
                    </InputContainer>
                </div>
            );
        }
        const style = {
            marginLeft: this.props.mapMargins.outerLeft + 'px',
            marginRight: this.props.mapMargins.outerRight + 'px'
        };

        return (
            <div id="BottomBar" ref={this.storeHeight}  style={style}>
                {scalebar}
                <span className="bottombar-links">
                    {leftBottomLinks}
                </span>
                <span className="bottombar-spacer" />
                {coordinates}
                {scales}
                <span className="bottombar-spacer" />
                <span className="bottombar-links">
                    {rightBottomLinks}
                </span>
            </div>
        );
    }
    renderLink = (entry) => {
        return (
            <a href={entry.url} key={entry.labelMsgId ?? entry.label} onClick={(ev) => this.openUrl(ev, entry.url, entry.urlTarget, entry.labelMsgId ? LocaleUtils.tr(entry.labelMsgId) : entry.label, entry.icon)}>
                <span className="extra_label">{entry.labelMsgId ? LocaleUtils.tr(entry.labelMsgId) : entry.label}</span>
            </a>
        );
    };
    initScaleBar = (el) => {
        this.scalebar = new ol.control.ScaleLine({
            className: 'bottombar-scalebar',
            target: el,
            minWidth: 64,
            units: 'metric',
            ...this.props.scalebarOptions
        });
        MapUtils.getHook(MapUtils.GET_MAP).addControl(this.scalebar);
    };
    openUrl = (ev, url, target, title, icon) => {
        if (target === "iframe") {
            target = ":iframedialog:externallinkiframe";
        }
        this.props.openExternalUrl(url, target, {title, icon});
        ev.preventDefault();
    };
    setScale = (value) => {
        const scale = parseInt(value, 10);
        if (!isNaN(scale)) {
            const zoom = MapUtils.computeZoom(this.props.map.scales, scale);
            this.props.changeZoomLevel(zoom);
        } else {
            this.props.changeZoomLevel(this.props.map.zoom);
        }
    };
    storeHeight = (el) => {
        if (el) {
            this.props.setBottombarHeight(el.clientHeight);
        }
    };
}

export default connect((state) => ({
    map: state.map,
    fullscreen: state.display?.fullscreen,
    mapMargins: state.windows.mapMargins,
    additionalMouseCrs: state.theme.current?.additionalMouseCrs ?? []
}), {
    changeZoomLevel: changeZoomLevel,
    openExternalUrl: openExternalUrl,
    setBottombarHeight: setBottombarHeight,
    setDisplayCrs: setDisplayCrs
})(BottomBar);
