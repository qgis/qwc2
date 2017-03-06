/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const {connect} = require('react-redux');
const {createSelector} = require('reselect');
const pickBy = require('lodash.pickby');
const Message = require('../../MapStore2/web/client/components/I18N/Message');
const CRSSelector = require("../../MapStore2/web/client/components/mapcontrols/mouseposition/CRSSelector");
const ScaleBox = require("../../MapStore2/web/client/components/mapcontrols/scale/ScaleBox");
const CoordinatesUtils = require('../../MapStore2/web/client/utils/CoordinatesUtils');
const {getScales} = require('../../MapStore2/web/client/utils/MapUtils');
const {changeMousePositionState, changeMousePositionCrs} = require('../../MapStore2/web/client/actions/mousePosition');
const {changeZoomLevel} = require('../../MapStore2/web/client/actions/map');
const {CoordinateDisplayer} = require('../components/CoordinateDisplayer');
const displayCrsSelector = require('../selectors/displaycrs');
require('./style/BottomBar.css');

const BottomBar = React.createClass({
    propTypes: {
        viewertitleUrl: React.PropTypes.string,
        termsUrl: React.PropTypes.string,
        displaycrs:  React.PropTypes.string,
        onCRSChange: React.PropTypes.func,
        mapcrs: React.PropTypes.string,
        mapscale: React.PropTypes.number,
        mapscales: React.PropTypes.array,
        activeThemeId: React.PropTypes.string,
        fullscreen: React.PropTypes.bool,
        onScaleChange: React.PropTypes.func,
        additionalMouseCrs: React.PropTypes.array
    },
    getDefaultProps() {
        return {
            mapscale: 0
        }
    },
    render() {
        if(this.props.fullscreen) {
            return null;
        }

        let viewertitleLink;
        if (this.props.viewertitleUrl) {
            viewertitleLink = (
                <a href={this.props.viewertitleUrl}>
                    <Message className="viewertitle_label" msgId="bottombar.viewertitle_label" />
                </a>
            )
        }
        let termsLink;
        if (this.props.termsUrl) {
            termsLink = (
                <a href={this.props.termsUrl}>
                    <Message className="terms_label" msgId="bottombar.terms_label" />
                </a>
            );
        }
        let bottomLinks;
        if (viewertitleLink || termsLink) {
            bottomLinks = (
                <span className="bottomlinks">
                    {viewertitleLink}
                    {viewertitleLink && termsLink ? " | " : null}
                    {termsLink}
                </span>
            );
        }
        let additionalMouseCrs = this.props.additionalMouseCrs || [];
        let availableCRS = pickBy(CoordinatesUtils.getAvailableCRS(), (key, code) => {
            return code === "EPSG:4326" ||
                   code === this.props.mapcrs ||
                   additionalMouseCrs.indexOf(code) !== -1;
           }
        );

        return (
            <div id="BottomBar">
                <span className="mousepos_label"><Message msgId="bottombar.mousepos_label" />: </span>
                <CoordinateDisplayer displaycrs={this.props.displaycrs} />
                <CRSSelector useRawInput={true} enabled={true} crs={this.props.displaycrs} id="crssselector" onCRSChange={this.props.onCRSChange} availableCRS={availableCRS}/>
                <span className="scale_label"><Message msgId="bottombar.scale_label" />: </span>
                <ScaleBox useRawInput={true} id="scaleselector" scales={this.props.mapscales} currentZoomLvl={this.props.mapscale} onChange={this.props.onScaleChange} />
                {bottomLinks}
            </div>
        );
    },
    componentWillMount() {
        changeMousePositionState(true);
    }
});

const selector = createSelector([state => state, displayCrsSelector], (state, displaycrs) => {
    let map = state && state.map && state.map.present ? state.map.present : null;
    return {
        displaycrs: displaycrs,
        mapcrs: map ? map.projection : "EPSG:3857",
        mapscale: map ? map.zoom : 0,
        mapscales: map  && map.mapOptions && map.mapOptions.view ? map.mapOptions.view.scales : [],
        activeThemeId: state.theme && state.theme.current ? state.theme.current.id : undefined,
        fullscreen: state.display && state.display.fullscreen,
        additionalMouseCrs: state.theme && state.theme.current ? state.theme.current.additionalMouseCrs : []
    };
});

module.exports = {
    BottomBarPlugin: connect(selector, {
        onCRSChange: changeMousePositionCrs,
        onScaleChange: changeZoomLevel
    })(BottomBar),
    reducers: {
        mousePosition: require('../../MapStore2/web/client/reducers/mousePosition')
    }
};
