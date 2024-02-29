/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import pickBy from 'lodash.pickby';
import PropTypes from 'prop-types';
import {createSelector} from 'reselect';

import {changeZoomLevel, setBottombarHeight} from '../actions/map';
import {changeMousePositionState} from '../actions/mousePosition';
import {openExternalUrl} from '../actions/task';
import CoordinateDisplayer from '../components/CoordinateDisplayer';
import InputContainer from '../components/InputContainer';
import displayCrsSelector from '../selectors/displaycrs';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';

import './style/BottomBar.css';


/**
 * Bottom bar, displaying mouse coordinate, scale, etc.
 */
class BottomBar extends React.Component {
    static propTypes = {
        additionalMouseCrs: PropTypes.array,
        changeMousePositionState: PropTypes.func,
        changeZoomLevel: PropTypes.func,
        /** Whether to display the coordinates in the bottom bar. */
        displayCoordinates: PropTypes.bool,
        /** Whether to display the scale in the bottom bar. */
        displayScales: PropTypes.bool,
        displaycrs: PropTypes.string,
        fullscreen: PropTypes.bool,
        map: PropTypes.object,
        openExternalUrl: PropTypes.func,
        setBottombarHeight: PropTypes.func,
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
        displayScales: true
    };
    state = {
        scale: 0
    };
    componentDidMount() {
        this.props.changeMousePositionState({crs: this.props.map.projection});
    }
    componentDidUpdate(prevProps) {
        if (this.props.map.projection !== prevProps.map.projection) {
            this.props.changeMousePositionState({crs: this.props.map.projection, position: null});
        }
        if (this.props.map !== prevProps.map) {
            this.setState({scale: Math.round(MapUtils.computeForZoom(this.props.map.scales, this.props.map.zoom))});
        }
    }
    render() {
        if (this.props.fullscreen) {
            return null;
        }

        let viewertitleLink;
        if (this.props.viewertitleUrl) {
            viewertitleLink = (
                <a href={this.props.viewertitleUrl} onClick={(ev) => this.openUrl(ev, this.props.viewertitleUrl, this.props.viewertitleUrlTarget, LocaleUtils.tr("bottombar.viewertitle_label"), this.props.viewertitleUrlIcon)}>
                    <span className="viewertitle_label">{LocaleUtils.tr("bottombar.viewertitle_label")}</span>
                </a>
            );
        }
        let termsLink;
        if (this.props.termsUrl) {
            termsLink = (
                <a href={this.props.termsUrl} onClick={(ev) => this.openUrl(ev, this.props.termsUrl, this.props.termsUrlTarget, LocaleUtils.tr("bottombar.terms_label"), this.props.termsUrlIcon)}>
                    <span className="terms_label">{LocaleUtils.tr("bottombar.terms_label")}</span>
                </a>
            );
        }
        let bottomLinks;
        if (viewertitleLink || termsLink) {
            bottomLinks = (
                <span className="bottombar-links">
                    {viewertitleLink}
                    {viewertitleLink && termsLink ? (<span dangerouslySetInnerHTML={{__html: "&nbsp;|&nbsp;"}} />) : null}
                    {termsLink}
                </span>
            );
        }
        const additionalMouseCrs = this.props.additionalMouseCrs || [];
        const availableCRS = pickBy(CoordinatesUtils.getAvailableCRS(), (key, code) => {
            return code === "EPSG:4326" ||
                   code === this.props.map.projection ||
                   additionalMouseCrs.indexOf(code) !== -1;
        });
        let coordinates = null;
        if (this.props.displayCoordinates) {
            coordinates = (
                <span>
                    <span>{LocaleUtils.tr("bottombar.mousepos_label")}:&nbsp;</span>
                    <CoordinateDisplayer className={"bottombar-mousepos"} displaycrs={this.props.displaycrs} />
                    <select onChange={ev => this.props.changeMousePositionState({crs: ev.target.value})} value={this.props.displaycrs}>
                        {Object.keys(availableCRS).map(crs =>
                            (<option key={crs} value={crs}>{availableCRS[crs].label}</option>)
                        )}
                    </select>
                </span>
            );
        }
        let scales = null;
        if (this.props.displayScales) {
            scales = (
                <div>
                    <span>{LocaleUtils.tr("bottombar.scale_label")}:&nbsp;</span>
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
                            onKeyUp={ev => { if (ev.keyCode === 13) this.setScale(ev.target.value); } }
                            role="input" type="text" value={this.state.scale}/>
                    </InputContainer>
                </div>
            );
        }

        return (
            <div id="BottomBar" ref={this.storeHeight}>
                <span className="bottombar-spacer" />
                {coordinates}
                {scales}
                <span className="bottombar-spacer" />
                {bottomLinks}
            </div>
        );
    }
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

const selector = createSelector([state => state, displayCrsSelector], (state, displaycrs) => {
    return {
        displaycrs: displaycrs,
        map: state.map,
        fullscreen: state.display && state.display.fullscreen,
        additionalMouseCrs: state.theme.current ? state.theme.current.additionalMouseCrs : []
    };
});

export default connect(selector, {
    changeMousePositionState: changeMousePositionState,
    changeZoomLevel: changeZoomLevel,
    openExternalUrl: openExternalUrl,
    setBottombarHeight: setBottombarHeight
})(BottomBar);
