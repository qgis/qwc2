/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import isEmpty from 'lodash.isempty';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import './style/MapCopyright.css';


/**
 * Displays layer attributions in the bottom right corner of the map.
 */
class MapCopyright extends React.Component {
    static propTypes = {
        layers: PropTypes.array,
        map: PropTypes.object,
        /** Whether to prepend the layer name to the attribution string. */
        prefixCopyrightsWithLayerNames: PropTypes.bool,
        /** Whether to only display the attribution of the theme, omitting external layers. */
        showThemeCopyrightOnly: PropTypes.bool,
        splitScreen: PropTypes.object
    };
    state = {
        currentCopyrights: {}
    };
    static getDerivedStateFromProps(nextProps) {
        if (nextProps.map && nextProps.map.bbox && nextProps.layers) {
            const copyrights = nextProps.layers.reduce((res, layer) => ({...res, ...LayerUtils.getAttribution(layer, nextProps.map, nextProps.showThemeCopyrightOnly)}), {});
            return {currentCopyrights: copyrights};
        }
        return null;
    }
    render() {
        // If attribution has both url and label, "key" is the url and "value.title" the label.
        // If it only has a label, "key" is the label and "value" is null.
        const copyrights = Object.entries(this.state.currentCopyrights).map(([key, value]) => {
            if (value.title) {
                return (<span key={key}><a href={key} rel="noreferrer" target="_blank">{this.layerNames(value.layers) + value.title}</a></span>);
            } else {
                return (<span key={key}>{this.layerNames(value.layers)}<span dangerouslySetInnerHTML={{__html: key}} /></span>);
            }
        });
        if (isEmpty(copyrights)) {
            return null;
        }
        const splitWindows = Object.values(this.props.splitScreen);
        const right = splitWindows.filter(entry => entry.side === 'right').reduce((res, e) => Math.max(e.size, res), 0);
        const bottom = splitWindows.filter(entry => entry.side === 'bottom').reduce((res, e) => Math.max(e.size, res), 0);
        const style = {
            right: 'calc(0.25em + ' + right + 'px)',
            bottom: 'calc(var(--bottombar-height) + 0.25em + ' + bottom + 'px)'
        };
        return (
            <div id="MapCopyright" style={style}>
                {copyrights}
            </div>
        );
    }
    layerNames = (layers) => {
        if (!this.props.prefixCopyrightsWithLayerNames) {
            return "";
        } else {
            return layers.map(layer => layer.titleMsgId ? LocaleUtils.tr(layer.titleMsgId) : layer.title).join(", ") + ": ";
        }
    };
}

const selector = (state) => ({
    layers: state.layers.flat,
    map: state.map,
    splitScreen: state.windows.splitScreen
});

export default connect(selector, {})(MapCopyright);
