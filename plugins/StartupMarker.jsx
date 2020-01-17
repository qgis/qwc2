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
    componentWillReceiveProps(newProps) {
        if(newProps.startupParams && newProps.theme && !this.props.theme && newProps.startupParams.c) {
            console.log(newProps.startupParams)
            let point = newProps.startupParams.c.split(/[;,]/g).map(x => parseFloat(x));
            this.props.addMarker('startupposmarker', point, '', newProps.startupParams.crs || newProps.map.projection);
            this.markerSet = true;
        } else if(this.markerSet) {
            if(
                (this.props.removeMode === 'onpan' && newProps.map.center !== this.props.map.center && newProps.map.zoom === this.props.map.zoom) ||
                (this.props.removeMode === 'onzoom' && newProps.map.zoom !== this.props.map.zoom) ||
                (this.props.removeMode === 'onclickonmarker' && newProps.clickFeature && newProps.clickFeature.feature === 'startupposmarker')
            ) {
                this.props.removeMarker('startupposmarker');
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
