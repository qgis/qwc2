/**
 * Copyright 2017-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';

import {zoomToExtent} from '../actions/map';
import Icon from '../components/Icon';
import LocaleUtils from '../utils/LocaleUtils';
import ThemeUtils from '../utils/ThemeUtils';

import './style/Buttons.css';


/**
 * Map button for reverting to the home extent of the theme.
 */
class HomeButton extends React.Component {
    static propTypes = {
        mapMargins: PropTypes.object,
        /** The position slot index of the map button, from the bottom (0: bottom slot). */
        position: PropTypes.number,
        theme: PropTypes.object,
        /** Omit the button in themes matching one of these flags. */
        themeFlagBlacklist: PropTypes.arrayOf(PropTypes.string),
        /** Only show the button in themes matching one of these flags. */
        themeFlagWhitelist: PropTypes.arrayOf(PropTypes.string),
        zoomToExtent: PropTypes.func
    };
    static defaultProps = {
        position: 5
    };
    render() {
        if (!ThemeUtils.themFlagsAllowed(this.props.theme, this.props.themeFlagWhitelist, this.props.themeFlagBlacklist)) {
            return null;
        }
        const right = this.props.mapMargins.right;
        const bottom = this.props.mapMargins.bottom;
        const style = {
            right: 'calc(1.5em + ' + right + 'px)',
            bottom: 'calc(' + bottom + 'px + ' + (5 + 4 * this.props.position) + 'em)'
        };
        const tooltip = LocaleUtils.tr("tooltip.home");
        return (
            <button className="map-button" onClick={this.resetExtent} style={style} title={tooltip}>
                <Icon icon="home" title={tooltip}/>
            </button>
        );
    }
    resetExtent = () => {
        if (this.props.theme) {
            const bbox = this.props.theme.initialBbox;
            this.props.zoomToExtent(bbox.bounds, bbox.crs);
        }
    };
}

export default connect((state) => ({
    mapMargins: state.windows.mapMargins,
    theme: state.theme.current
}), {
    zoomToExtent: zoomToExtent
})(HomeButton);
