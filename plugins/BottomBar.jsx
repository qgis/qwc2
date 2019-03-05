/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const {createSelector} = require('reselect');
const pickBy = require('lodash.pickby');
const Message = require('../components/I18N/Message');
const CoordinatesUtils = require('../utils/CoordinatesUtils');
const MapUtils = require('../utils/MapUtils');
const LocaleUtils = require('../utils/LocaleUtils');
const {changeMousePositionState} = require('../actions/mousePosition');
const {changeZoomLevel} = require('../actions/map');
const {CoordinateDisplayer} = require('../components/CoordinateDisplayer');
const displayCrsSelector = require('../selectors/displaycrs');
require('./style/BottomBar.css');

class BottomBar extends React.Component {
    static propTypes = {
        viewertitleUrl: PropTypes.string,
        termsUrl: PropTypes.string,
        displaycrs:  PropTypes.string,
        map: PropTypes.object,
        fullscreen: PropTypes.bool,
        additionalMouseCrs: PropTypes.array,
        changeMousePositionState: PropTypes.func,
        changeZoomLevel: PropTypes.func
    }
    state = {
        scale: 0
    }
    componentDidMount() {
        this.props.changeMousePositionState({crs: this.props.map.projection});
    }
    componentWillReceiveProps(newProps) {
        if(newProps.map.projection !== this.props.map.projection) {
            newProps.changeMousePositionState({crs: newProps.map.projection, position: null});
        }
        this.setState({scale: Math.round(MapUtils.computeForZoom(newProps.map.scales, newProps.map.zoom))});
    }
    render() {
        if(this.props.fullscreen) {
            return null;
        }

        let viewertitleLink;
        if (this.props.viewertitleUrl) {
            viewertitleLink = (
                <a href={this.props.viewertitleUrl} target="_blank">
                    <Message className="viewertitle_label" msgId="bottombar.viewertitle_label" />
                </a>
            )
        }
        let termsLink;
        if (this.props.termsUrl) {
            termsLink = (
                <a href={this.props.termsUrl} target="_blank">
                    <Message className="terms_label" msgId="bottombar.terms_label" />
                </a>
            );
        }
        let bottomLinks;
        if (viewertitleLink || termsLink) {
            bottomLinks = (
                <span className="bottombar-links">
                    {viewertitleLink}
                    {viewertitleLink && termsLink ? (<span dangerouslySetInnerHTML={{__html: "&nbsp;|&nbsp;"}}></span>) : null}
                    {termsLink}
                </span>
            );
        }
        let additionalMouseCrs = this.props.additionalMouseCrs || [];
        let availableCRS = pickBy(CoordinatesUtils.getAvailableCRS(), (key, code) => {
            return code === "EPSG:4326" ||
                   code === this.props.map.projection ||
                   additionalMouseCrs.indexOf(code) !== -1;
           }
        );

        return (
            <div id="BottomBar">
                <span>
                    <span><Message msgId="bottombar.mousepos_label" />:&nbsp;</span>
                    <CoordinateDisplayer className={"bottombar-mousepos"} displaycrs={this.props.displaycrs} />
                    <select className="bottombar-crs-selector" onChange={ev => this.props.changeMousePositionState({crs: ev.target.value})} value={this.props.displaycrs}>
                        {Object.keys(availableCRS).map(crs =>
                            (<option value={crs} key={crs}>{availableCRS[crs].label}</option>)
                        )}
                    </select>
                </span>
                <span>
                    <span><Message msgId="bottombar.scale_label" />:&nbsp;</span>
                    <span className="bottombar-scale-combo">
                        <span> 1 : </span>
                        <select onChange={ev => this.props.changeZoomLevel(parseInt(ev.target.value, 10))} value={Math.round(this.props.map.zoom)}>
                            {this.props.map.scales.map((item, index) =>
                                (<option value={index} key={index}>{LocaleUtils.toLocaleFixed(item, 0)}</option>)
                            )}
                        </select>
                        <input type="text" value={this.state.scale}
                            onChange={ev => this.setState({scale: ev.target.value})}
                            onKeyUp={ev => { if(ev.keyCode === 13) this.setScale(ev.target.value)} }
                            onBlur={ev => this.setScale(ev.target.value)}/>
                    </span>
                </span>
                <span className="bottombar-spacer"></span>
                {bottomLinks}
            </div>
        );
    }
    setScale = (value) => {
        let scale = parseInt(value);
        if(!isNaN(scale)) {
            let zoom = MapUtils.computeZoom(this.props.map.scales, scale);
            this.props.changeZoomLevel(zoom);
        } else {
            this.props.changeZoomLevel(this.props.map.zoom);
        }
    }
};

const selector = createSelector([state => state, displayCrsSelector], (state, displaycrs) => {
    let map = state && state.map && state.map ? state.map : null;
    return {
        displaycrs: displaycrs,
        map: map,
        fullscreen: state.display && state.display.fullscreen,
        additionalMouseCrs: state.theme && state.theme.current ? state.theme.current.additionalMouseCrs : []
    };
});

module.exports = {
    BottomBarPlugin: connect(selector, {
        changeMousePositionState: changeMousePositionState,
        changeZoomLevel: changeZoomLevel
    })(BottomBar),
    reducers: {
        mousePosition: require('../reducers/mousePosition')
    }
};
