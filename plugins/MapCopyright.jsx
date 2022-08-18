/**
 * Copyright 2016-2021 Sourcepole AG
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


class MapCopyright extends React.Component {
    static propTypes = {
        layers: PropTypes.array,
        map: PropTypes.object,
        prefixCopyrightsWithLayerNames: PropTypes.bool,
        showThemeCopyrightOnly: PropTypes.bool
    }
    state = {
        currentCopyrights: {}
    }
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
        return (
            <div id="MapCopyright">
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
    }
}

const selector = (state) => ({
    layers: state.layers.flat,
    map: state.map
});

export default connect(selector, {})(MapCopyright);
