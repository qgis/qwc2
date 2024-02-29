/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';

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
        mapMargins: PropTypes.object,
        /** Whether to prepend the layer name to the attribution string. */
        prefixCopyrightsWithLayerNames: PropTypes.bool,
        /** Whether to only display the attribution of the theme, omitting external layers. */
        showThemeCopyrightOnly: PropTypes.bool
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
        const right = this.props.mapMargins.right;
        const bottom = this.props.mapMargins.bottom;
        const style = {
            right: 'calc(0.25em + ' + right + 'px)',
            bottom: 'calc(3.4em + ' + bottom + 'px)'
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
    mapMargins: state.windows.mapMargins
});

export default connect(selector, {})(MapCopyright);
