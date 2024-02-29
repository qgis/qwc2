/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';

import {setCurrentTask} from '../actions/task';
import ResizeableWindow from '../components/ResizeableWindow';
import {Image} from '../components/widgets/Primitives';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';

import './style/MapLegend.css';

/**
 * Displays the map legend in a floating dialog.
 *
 * The user can toggle whether to display only layers which are enabled, visible in the current extent and/or visible at the current scale.
 *
 * See https://docs.qgis.org/3.28/en/docs/server_manual/services/wms.html#wms-getlegendgraphic for supported extra legend params.
 */
class MapLegend extends React.Component {
    static propTypes = {
        active: PropTypes.bool,
        /** Whether to add group titles to the legend. */
        addGroupTitles: PropTypes.bool,
        /** Whether to add layer titles to the legend. Note that often the legend image itself already contains the layer title. */
        addLayerTitles: PropTypes.bool,
        /** Whether to display a BBOX-dependent legend by default. */
        bboxDependentLegend: PropTypes.bool,
        /** Extra parameters to add to the GetLegendGraphics request. */
        extraLegendParameters: PropTypes.string,
        /** Default window geometry with size, position and docking status. Positive position values (including '0') are related to top (InitialY) and left (InitialX), negative values (including '-0') to bottom (InitialY) and right (InitialX). */
        geometry: PropTypes.shape({
            initialWidth: PropTypes.number,
            initialHeight: PropTypes.number,
            initialX: PropTypes.number,
            initialY: PropTypes.number,
            initiallyDocked: PropTypes.bool,
            side: PropTypes.string
        }),
        layers: PropTypes.array,
        map: PropTypes.object,
        /** Whether to only include enabled layers in the legend by default. */
        onlyVisibleLegend: PropTypes.bool,
        /** Whether to display a scale-dependent legend by default. */
        scaleDependentLegend: PropTypes.bool,
        setCurrentTask: PropTypes.func
    };
    static defaultProps = {
        addGroupTitles: false,
        addLayerTitles: false,
        bboxDependentLegend: false,
        onlyVisibleLegend: false,
        scaleDependentLegend: false,
        geometry: {
            initialWidth: 320,
            initialHeight: 320,
            initialX: 0,
            initialY: 0,
            initiallyDocked: false,
            side: 'left'
        }
    };
    state = {
        onlyVisibleLegend: false,
        bboxDependentLegend: false,
        scaleDependentLegend: false,
        visible: false
    };
    constructor(props) {
        super(props);
        this.state.onlyVisibleLegend = props.onlyVisibleLegend;
        this.state.bboxDependentLegend = props.bboxDependentLegend;
        this.state.scaleDependentLegend = props.scaleDependentLegend;
    }
    componentDidUpdate(prevProps) {
        if (this.props.active && !prevProps.active) {
            this.setState({visible: true});
            // Clear task immediately, visibility is stored as state
            this.props.setCurrentTask(null);
        }
    }
    render() {
        if (!this.state.visible) {
            return null;
        }
        const mapScale = MapUtils.computeForZoom(this.props.map.scales, this.props.map.zoom);
        const extraControls = [
            {icon: "eye", callback: () => this.setState((state) => ({onlyVisibleLegend: !state.onlyVisibleLegend})), active: this.state.onlyVisibleLegend, msgid: LocaleUtils.trmsg("maplegend.onlyvisible")},
            {icon: "box", callback: () => this.setState((state) => ({bboxDependentLegend: !state.bboxDependentLegend})), active: this.state.bboxDependentLegend, msgid: LocaleUtils.trmsg("maplegend.bboxdependent")},
            {icon: "scale", callback: () => this.setState((state) => ({scaleDependentLegend: !state.scaleDependentLegend})), active: this.state.scaleDependentLegend, msgid: LocaleUtils.trmsg("maplegend.scaledependent")}
        ];

        return (
            <ResizeableWindow dockable={this.props.geometry.side} extraControls={extraControls} icon="list-alt"
                initialHeight={this.props.geometry.initialHeight} initialWidth={this.props.geometry.initialWidth}
                initialX={this.props.geometry.initialX} initialY={this.props.geometry.initialY}
                initiallyDocked={this.props.geometry.initiallyDocked}
                onClose={this.onClose} title={LocaleUtils.trmsg("maplegend.windowtitle")}
            >
                <div className="map-legend" role="body">
                    {this.props.layers.map(layer => {
                        if (this.state.onlyVisibleLegend && !layer.visibility) {
                            return null;
                        } else if (layer.legendUrl) {
                            return this.printLayerLegend(layer, layer, mapScale);
                        } else if (layer.color) {
                            return (
                                <div className="map-legend-legend-entry" key={layer.name}>
                                    <span className="map-legend-color-box" style={{backgroundColor: layer.color}} />
                                    <span className="map-legend-entry-title">{layer.title || layer.name}</span>
                                </div>
                            );
                        } else {
                            return null;
                        }
                    })}
                </div>
            </ResizeableWindow>
        );
    }
    onClose = () => {
        this.setState({visible: false});
    };
    printLayerLegend = (layer, sublayer, mapScale) => {
        const isCategorized = (sublayer.sublayers || []).find(entry => entry.category_sublayer === true);
        if (sublayer.sublayers && !isCategorized && (!this.state.onlyVisibleLegend || sublayer.visibility)) {
            if (this.props.addGroupTitles) {
                const children = sublayer.sublayers.map(subsublayer => this.printLayerLegend(layer, subsublayer, mapScale)).filter(x => x);
                if (isEmpty(children)) {
                    return null;
                } else {
                    return (
                        <div className="map-legend-group" key={sublayer.name}>
                            <div className="map-legend-group-title">{sublayer.title || sublayer.name}</div>
                            <div className="map-legend-group-entries">
                                {sublayer.sublayers.map(subsublayer => this.printLayerLegend(layer, subsublayer, mapScale))}
                            </div>
                        </div>
                    );
                }
            } else {
                return sublayer.sublayers.map(subsublayer => this.printLayerLegend(layer, subsublayer, mapScale));
            }
        } else {
            if (this.state.onlyVisibleLegend && !sublayer.visibility) {
                return null;
            }
            if ((this.state.onlyVisibleLegend || this.state.scaleDependentLegend) && !LayerUtils.layerScaleInRange(sublayer, mapScale)) {
                return null;
            }
            const request = LayerUtils.getLegendUrl(layer, {name: sublayer.name}, mapScale, this.props.map, this.state.bboxDependentLegend, this.state.scaleDependentLegend, this.props.extraLegendParameters);
            return request ? (
                <div className="map-legend-legend-entry" key={sublayer.name}>
                    <div>
                        {this.props.addLayerTitles && !sublayer.category_sublayer ? (<div className="map-legend-entry-title">{sublayer.title || sublayer.name}</div>) : null}
                        <div><Image src={request} /></div>
                    </div>
                </div>) : null;
        }
    };
}

export default connect(state => ({
    active: state.task.id === "MapLegend",
    layers: state.layers.flat,
    map: state.map
}), {
    setCurrentTask: setCurrentTask
})(MapLegend);
