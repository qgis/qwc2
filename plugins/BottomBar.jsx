/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {createSelector} from 'reselect';
import pickBy from 'lodash.pickby';
import Message from '../components/I18N/Message';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import MapUtils from '../utils/MapUtils';
import LocaleUtils from '../utils/LocaleUtils';
import {changeMousePositionState} from '../actions/mousePosition';
import {changeZoomLevel} from '../actions/map';
import CoordinateDisplayer from '../components/CoordinateDisplayer';
import displayCrsSelector from '../selectors/displaycrs';
import './style/BottomBar.css';

class BottomBar extends React.Component {
    static propTypes = {
        additionalMouseCrs: PropTypes.array,
        changeMousePositionState: PropTypes.func,
        changeZoomLevel: PropTypes.func,
        displayCoordinates: PropTypes.bool,
        displayScales: PropTypes.bool,
        displaycrs: PropTypes.string,
        fullscreen: PropTypes.bool,
        map: PropTypes.object,
        termsUrl: PropTypes.string,
        viewertitleUrl: PropTypes.string
    }
    static defaultProps = {
        displayCoordinates: true,
        displayScales: true
    }
    state = {
        scale: 0
    }
    componentDidMount() {
        this.props.changeMousePositionState({crs: this.props.map.projection});
    }
    static getDerivedStateFromProps(nextProps) {
        return {scale: Math.round(MapUtils.computeForZoom(nextProps.map.scales, nextProps.map.zoom))};
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.map.projection !== prevProps.map.projection) {
            this.props.changeMousePositionState({crs: this.props.map.projection, position: null});
        }
    }
    render() {
        if (this.props.fullscreen) {
            return null;
        }

        let viewertitleLink;
        if (this.props.viewertitleUrl) {
            viewertitleLink = (
                <a href={this.props.viewertitleUrl} rel="noreferrer" target="_blank">
                    <Message className="viewertitle_label" msgId="bottombar.viewertitle_label" />
                </a>
            );
        }
        let termsLink;
        if (this.props.termsUrl) {
            termsLink = (
                <a href={this.props.termsUrl} rel="noreferrer" target="_blank">
                    <Message className="terms_label" msgId="bottombar.terms_label" />
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
                    <span><Message msgId="bottombar.mousepos_label" />:&nbsp;</span>
                    <CoordinateDisplayer className={"bottombar-mousepos"} displaycrs={this.props.displaycrs} />
                    <select className="bottombar-crs-selector" onChange={ev => this.props.changeMousePositionState({crs: ev.target.value})} value={this.props.displaycrs}>
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
                <span>
                    <span><Message msgId="bottombar.scale_label" />:&nbsp;</span>
                    <span className="bottombar-scale-combo">
                        <span> 1 : </span>
                        <select onChange={ev => this.props.changeZoomLevel(parseInt(ev.target.value, 10))} value={Math.round(this.props.map.zoom)}>
                            {this.props.map.scales.map((item, index) =>
                                (<option key={index} value={index}>{LocaleUtils.toLocaleFixed(item, 0)}</option>)
                            )}
                        </select>
                        <input onBlur={ev => this.setScale(ev.target.value)} onChange={ev => this.setState({scale: ev.target.value})}
                            onKeyUp={ev => { if (ev.keyCode === 13) this.setScale(ev.target.value); } }
                            type="text"
                            value={this.state.scale}/>
                    </span>
                </span>
            );
        }

        return (
            <div id="BottomBar">
                {coordinates}
                {scales}
                <span className="bottombar-spacer" />
                {bottomLinks}
            </div>
        );
    }
    setScale = (value) => {
        const scale = parseInt(value, 10);
        if (!isNaN(scale)) {
            const zoom = MapUtils.computeZoom(this.props.map.scales, scale);
            this.props.changeZoomLevel(zoom);
        } else {
            this.props.changeZoomLevel(this.props.map.zoom);
        }
    }
}

const selector = createSelector([state => state, displayCrsSelector], (state, displaycrs) => {
    const map = state && state.map && state.map ? state.map : null;
    return {
        displaycrs: displaycrs,
        map: map,
        fullscreen: state.display && state.display.fullscreen,
        additionalMouseCrs: state.theme && state.theme.current ? state.theme.current.additionalMouseCrs : []
    };
});

export default connect(selector, {
    changeMousePositionState: changeMousePositionState,
    changeZoomLevel: changeZoomLevel
})(BottomBar);
