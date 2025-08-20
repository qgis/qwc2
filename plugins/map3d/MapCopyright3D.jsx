/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import ReactDOM from 'react-dom';

import DOMPurify from 'dompurify';
import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';

import {MapContainerPortalContext} from '../../components/PluginsContainer';
import LocaleUtils from '../../utils/LocaleUtils';

import '../style/MapCopyright.css';


/**
 * Displays layer attributions in the bottom right corner of the 3D map.
 */
export default class MapCopyright3D extends React.Component {
    static contextType = MapContainerPortalContext;

    static propTypes = {
        /** Whether to prepend the layer name to the attribution string. */
        prefixCopyrightsWithLayerNames: PropTypes.bool,
        sceneContext: PropTypes.object,
        /** Whether to only display the attribution of the theme, omitting external layers. */
        showThemeCopyrightOnly: PropTypes.bool
    };
    state = {
        currentCopyrights: {}
    };
    componentDidUpdate(prevProps) {
        if (
            this.props.sceneContext.baseLayers !== prevProps.sceneContext.baseLayers ||
            this.props.sceneContext.colorLayers !== prevProps.sceneContext.colorLayers
        ) {
            const layers = this.props.sceneContext.baseLayers.concat(this.props.sceneContext.colorLayers);
            const copyrights = layers.reduce((res, layer) => {
                if (layer.attribution && layer.attribution.Title) {
                    const key = layer.attribution.OnlineResource || layer.attribution.Title;
                    res[key] = {
                        title: layer.attribution.OnlineResource ? layer.attribution.Title : null,
                        layers: [ ...(res[key]?.layers || []), layer]
                    };
                }
                return res;
            }, {});
            this.setState({currentCopyrights: copyrights});
        }
    }
    render() {
        // If attribution has both url and label, "key" is the url and "value.title" the label.
        // If it only has a label, "key" is the label and "value" is null.
        const copyrights = Object.entries(this.state.currentCopyrights).map(([key, value]) => {
            if (value.title) {
                return (<span key={key}><a href={key} rel="noreferrer" target="_blank">{this.layerNames(value.layers) + value.title}</a></span>);
            } else {
                return (<span key={key}>{this.layerNames(value.layers)}<span dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(key)}} /></span>);
            }
        });
        if (isEmpty(copyrights)) {
            return null;
        }
        return ReactDOM.createPortal((
            <div className="MapCopyright MapCopyright3D">
                {copyrights}
            </div>
        ), this.context);
    }
    layerNames = (layers) => {
        if (!this.props.prefixCopyrightsWithLayerNames) {
            return "";
        } else {
            return layers.map(layer => layer.titleMsgId ? LocaleUtils.tr(layer.titleMsgId) : layer.title).join(", ") + ": ";
        }
    };
}
