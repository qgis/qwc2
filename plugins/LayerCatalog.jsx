/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import axios from 'axios';
import PropTypes from 'prop-types';

import {setCurrentTask} from '../actions/task';
import ResizeableWindow from '../components/ResizeableWindow';
import LayerCatalogWidget from '../components/widgets/LayerCatalogWidget';
import LocaleUtils from '../utils/LocaleUtils';

import './style/LayerCatalog.css';


/**
 * Displays a pre-configured catalog of external layers in a window.
 *
 * Configured through a catalog JSON containing a tree of external layer identifiers.
 *
 * For `wms` layers, `sublayers: false` denotes that the sublayer structure of the added layer should not
 * be exposed in the layer tree.
 *
 * Example:
 * ```json
 * {
 *   "catalog": [
 *     {
 *       "title": "Öffentlicher Verkehr swissTLMRegio",
 *       "resource": "wms:http://wms.geo.admin.ch#ch.swisstopo.vec200-transportation-oeffentliche-verkehr",
 *       "sublayers": false
 *     },
 *     {
 *       "title": "Gewässerschutz",
 *        "resource": "wms:https://geo.so.ch/api/wms#ch.so.afu.gewaesserschutz[50]"
 *     },
 *     {
 *       "title": "Landeskarten",
 *       "sublayers": [
 *         {
 *           "title": "Landeskarte 1:1 Million | LK1000",
 *           "resource": "wms:http://wms.geo.admin.ch#ch.swisstopo.pixelkarte-farbe-pk1000.noscale"
 *         },
 *         {
 *           "title": "Landeskarte 1:100`000 | LK100",
 *           "resource": "wms:http://wms.geo.admin.ch#ch.swisstopo.pixelkarte-farbe-pk100.noscale"
 *         }
 *       ]
 *     }
 *   ]
 * }
 * ```
 */
class LayerCatalog extends React.Component {
    static propTypes = {
        active: PropTypes.bool,
        /** The URL to the catalog JSON file. */
        catalogUrl: PropTypes.string,
        /** Default window geometry with size, position and docking status. Positive position values (including '0') are related to top (InitialY) and left (InitialX), negative values (including '-0') to bottom (InitialY) and right (InitialX). */
        geometry: PropTypes.shape({
            initialWidth: PropTypes.number,
            initialHeight: PropTypes.number,
            initialX: PropTypes.number,
            initialY: PropTypes.number,
            initiallyDocked: PropTypes.bool,
            side: PropTypes.string
        }),
        /** Whether to increase the indent size dynamically according to the current level (`true`) or keep the indent size constant (`false`). */
        levelBasedIndentSize: PropTypes.bool,
        setCurrentTask: PropTypes.func
    };
    static defaultProps = {
        geometry: {
            initialWidth: 320,
            initialHeight: 320,
            initialX: 0,
            initialY: 0,
            initiallyDocked: false,
            side: 'left'
        },
        levelBasedIndentSize: true
    };
    state = {
        catalog: null
    };
    componentDidUpdate(prevProps) {
        if (this.props.active && !prevProps.active && this.props.catalogUrl) {
            axios.get(this.props.catalogUrl).then(this.setCatalog).catch(e => {
                this.setState({catalog: []});
                // eslint-disable-next-line
                console.warn("Failed to load catalog: " + e);
            });
        }
    }
    setCatalog = (response) => {
        this.setState({
            catalog: response.data.catalog || []
        });
        this.props.setCurrentTask("LayerTree");
    };
    render() {
        if (!this.state.catalog) {
            return null;
        }
        return (
            <ResizeableWindow dockable={this.props.geometry.side} icon="catalog"
                initialHeight={this.props.geometry.initialHeight} initialWidth={this.props.geometry.initialWidth}
                initialX={this.props.geometry.initialX} initialY={this.props.geometry.initialY}
                initiallyDocked={this.props.geometry.initiallyDocked}
                onClose={this.onClose} title={LocaleUtils.trmsg("layercatalog.windowtitle")}
            >
                <div className="layer-catalog" role="body">
                    <LayerCatalogWidget catalog={this.state.catalog} levelBasedIndentSize={this.props.levelBasedIndentSize} pendingRequests={0} />
                </div>
            </ResizeableWindow>
        );
    }
    onClose = () => {
        this.setState({catalog: null});
    };
}

export default connect(state => ({
    active: state.task.id === "LayerCatalog"
}), {
    setCurrentTask: setCurrentTask
})(LayerCatalog);
