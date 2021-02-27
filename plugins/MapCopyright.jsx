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
import CoordinatesUtils from '../utils/CoordinatesUtils';
import {LayerRole} from '../actions/layers';
import './style/MapCopyright.css';


class MapCopyright extends React.Component {
    static propTypes = {
        layers: PropTypes.array,
        map: PropTypes.object,
        showThemeCopyrightOnly: PropTypes.bool
    }
    state = {
        currentCopyrights: []
    }
    static getDerivedStateFromProps(nextProps) {
        if (nextProps.map && nextProps.map.bbox && nextProps.layers) {
            const transformedbboxes = {};
            transformedbboxes[nextProps.map.projection] = nextProps.map.bbox.bounds;
            const copyrights = {};
            nextProps.layers.map(layer => MapCopyright.collectCopyrigths(layer, nextProps.map, transformedbboxes, copyrights, nextProps.showThemeCopyrightOnly));
            return {currentCopyrights: copyrights};
        }
        return null;
    }
    static collectCopyrigths = (layer, map, transformedbboxes, copyrights, showThemeCopyrightOnly) => {
        if (layer.sublayers) {
            layer.sublayers.map(sublayer => MapCopyright.collectCopyrigths(sublayer, map, transformedbboxes, copyrights, showThemeCopyrightOnly));
        }
        if (!layer.attribution || !layer.attribution.Title || !layer.visibility) {
            return;
        }
        if (showThemeCopyrightOnly) {
            if (layer.role === LayerRole.THEME) {
                copyrights[layer.attribution.OnlineResource || layer.attribution.Title] = layer.attribution.OnlineResource ? layer.attribution.Title : null;
            }
        } else if (layer.role === LayerRole.BACKGROUND) {
            copyrights[layer.attribution.OnlineResource || layer.attribution.Title] = layer.attribution.OnlineResource ? layer.attribution.Title : null;
        } else {
            if (!layer.bbox) {
                return;
            }
            if (!transformedbboxes[layer.bbox.crs]) {
                transformedbboxes[layer.bbox.crs] = CoordinatesUtils.reprojectBbox(map.bbox.bounds, map.projection, layer.bbox.crs);
            }
            const mapbbox = transformedbboxes[layer.bbox.crs];
            const laybbox = layer.bbox.bounds;
            if (
                mapbbox[0] < laybbox[2] && mapbbox[2] > laybbox[0] &&
                mapbbox[1] < laybbox[3] && mapbbox[3] > laybbox[1]
            ) {
                // Extents overlap
                copyrights[layer.attribution.OnlineResource || layer.attribution.Title] = layer.attribution.OnlineResource ? layer.attribution.Title : null;
            }
        }
    }
    render() {
        // If attribution has both url and label, "key" is the url and "value" the label.
        // If it only has a label, "key" is the label and "value" is null.
        const copyrights = Object.entries(this.state.currentCopyrights).map(([key, value]) => {
            if (value) {
                return (<span key={key}><a href={key} rel="noreferrer" target="_blank">{value}</a></span>);
            } else {
                return (<span dangerouslySetInnerHTML={{__html: key}} key={key} />);
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
}

const selector = (state) => ({
    layers: state.layers.flat,
    map: state.map
});

export default connect(selector, {})(MapCopyright);
