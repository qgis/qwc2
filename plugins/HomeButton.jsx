/**
 * Copyright 2017, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import LocaleUtils from '../utils/LocaleUtils';
import {zoomToExtent} from '../actions/map';
import Icon from '../components/Icon';
import './style/Buttons.css';

class HomeButton extends React.Component {
    static propTypes = {
        currentTheme: PropTypes.object,
        position: PropTypes.number,
        zoomToExtent: PropTypes.func
    }
    static defaultProps = {
        position: 5
    }
    static contextTypes = {
        messages: PropTypes.object
    }
    render() {
        const tooltip = LocaleUtils.getMessageById(this.context.messages, "tooltip.home");
        return (
            <button className="map-button" onClick={this.resetExtent} style={{bottom: (5 + 4 * this.props.position) + 'em'}} title={tooltip}>
                <Icon icon="home"/>
            </button>
        );
    }
    resetExtent = () => {
        if (this.props.currentTheme) {
            const bbox = this.props.currentTheme.initialBbox;
            this.props.zoomToExtent(bbox.bounds, bbox.crs);
        }
    }
}

export default connect((state) => ({
    currentTheme: state.theme.current
}), {
    zoomToExtent: zoomToExtent
})(HomeButton);
