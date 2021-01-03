/**
 * Copyright 2020-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {addMarker, removeMarker} from '../actions/layers';
import {UrlParams} from '../utils/PermaLinkUtils';

class StartupMarker extends React.Component {
    static propTypes = {
        addMarker: PropTypes.func,
        click: PropTypes.object,
        map: PropTypes.object,
        removeMarker: PropTypes.func,
        removeMode: PropTypes.string, // onpan, onzoom, onclickonmarker
        startupParams: PropTypes.object,
        theme: PropTypes.object
    }
    static defaultProps = {
        removeMode: 'onpan'
    }
    constructor(props) {
        super(props);
        this.markerSet = false;
    }
    componentDidUpdate(prevProps, prevState) {
        const highlight = ["true", "1"].includes("" + (this.props.startupParams && this.props.startupParams.hc || "").toLowerCase());
        if (highlight && this.props.theme && !prevProps.theme && this.props.startupParams.c) {
            UrlParams.updateParams({hc: undefined});
            const point = this.props.startupParams.c.split(/[;,]/g).map(x => parseFloat(x));
            prevProps.addMarker('startupposmarker', point, '', this.props.startupParams.crs || this.props.map.projection);
            this.markerSet = true;
        } else if (this.markerSet) {
            if (
                (prevProps.removeMode === 'onpan' && this.props.map.center !== prevProps.map.center && this.props.map.zoom === prevProps.map.zoom) ||
                (prevProps.removeMode === 'onzoom' && this.props.map.zoom !== prevProps.map.zoom) ||
                (prevProps.removeMode === 'onclickonmarker' && this.props.click && this.props.click.feature === 'startupposmarker')
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
