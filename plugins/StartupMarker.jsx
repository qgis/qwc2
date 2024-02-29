/**
 * Copyright 2020-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';

import {addMarker, removeMarker} from '../actions/layers';
import {UrlParams} from '../utils/PermaLinkUtils';


/**
 * Displays a marker when starting up the viewer.
 *
 * The marked is displayed in the center of the map if `c=<x>,<y>&hc=1` is set in the URL.
 */
class StartupMarker extends React.Component {
    static propTypes = {
        addMarker: PropTypes.func,
        click: PropTypes.object,
        map: PropTypes.object,
        removeMarker: PropTypes.func,
        /** When to remove the marker. Possible choices: onpan, onzoom, onclickonmarker. */
        removeMode: PropTypes.string, // onpan, onzoom, onclickonmarker
        startupParams: PropTypes.object,
        theme: PropTypes.object
    };
    static defaultProps = {
        removeMode: 'onpan'
    };
    constructor(props) {
        super(props);
        this.markerSet = false;
    }
    componentDidUpdate(prevProps) {
        const highlight = ["true", "1"].includes("" + (this.props.startupParams && this.props.startupParams.hc || "").toLowerCase());
        if (highlight && this.props.theme && !prevProps.theme && this.props.startupParams.c) {
            UrlParams.updateParams({hc: undefined});
            const point = this.props.startupParams.c.split(/[;,]/g).map(x => parseFloat(x));
            prevProps.addMarker('startupposmarker', point, '', this.props.startupParams.crs || this.props.map.projection);
            this.markerSet = true;
        } else if (this.markerSet) {
            if (
                (this.props.removeMode === 'onpan' && this.props.map.center !== prevProps.map.center && this.props.map.zoom === prevProps.map.zoom) ||
                (this.props.removeMode === 'onzoom' && this.props.map.zoom !== prevProps.map.zoom) ||
                (this.props.removeMode === 'onclickonmarker' && this.props.click && (this.props.click.features || []).find(feature => feature.id === 'startupposmarker'))
            ) {
                prevProps.removeMarker('startupposmarker');
                this.markerSet = false;
            }
        }
    }
    render() {
        return null;
    }
}

export default connect(state => ({
    startupParams: state.localConfig.startupParams,
    click: state.map.click || {},
    map: state.map,
    theme: state.theme.current
}), {
    addMarker: addMarker,
    removeMarker: removeMarker
})(StartupMarker);
