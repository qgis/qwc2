/**
 * Copyright 2020, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const {addMarker, removeMarker} = require('../actions/layers');
const {UrlParams} = require("../utils/PermaLinkUtils");

class StartupMarker extends React.Component {
    static propTypes = {
        startupParams: PropTypes.object,
        map: PropTypes.object,
        theme: PropTypes.object,
        clickFeature: PropTypes.object,
        removeMode: PropTypes.string, // onpan, onzoom, onclickonmarker
        addMarker: PropTypes.func,
        removeMarker: PropTypes.func
    }
    static defaultProps = {
        removeMode: 'onpan'
    }
    constructor(props) {
        super(props);
        this.markerSet = false;
    }
    componentDidUpdate(prevProps, prevState) {
        let highlight = ["true", "1"].includes("" + (this.props.startupParams && this.props.startupParams.hc || "").toLowerCase());
        if(highlight && this.props.theme && !prevProps.theme && this.props.startupParams.c) {
            UrlParams.updateParams({hc: undefined});
            let point = this.props.startupParams.c.split(/[;,]/g).map(x => parseFloat(x));
            prevProps.addMarker('startupposmarker', point, '', this.props.startupParams.crs || this.props.map.projection);
            this.markerSet = true;
        } else if(this.markerSet) {
            if(
                (prevProps.removeMode === 'onpan' && this.props.map.center !== prevProps.map.center && this.props.map.zoom === prevProps.map.zoom) ||
                (prevProps.removeMode === 'onzoom' && this.props.map.zoom !== prevProps.map.zoom) ||
                (prevProps.removeMode === 'onclickonmarker' && this.props.clickFeature && this.props.clickFeature.feature === 'startupposmarker')
            ) {
                prevProps.removeMarker('startupposmarker');
                this.markerSet = false;
            }
        }
    }
    render() {
        return null;
    }
};

module.exports = {
    StartupMarkerPlugin: connect(state => ({
        startupParams: state.localConfig.startupParams,
        clickFeature: state.map.clickFeature || {},
        map: state.map,
        theme: state.theme && state.theme.current || null
    }), {
        addMarker: addMarker,
        removeMarker: removeMarker
    })(StartupMarker)
}
