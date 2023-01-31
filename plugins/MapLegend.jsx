/**
 * Copyright 2023 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';
import PropTypes from 'prop-types';
import {setCurrentTask} from '../actions/task';
import ResizeableWindow from '../components/ResizeableWindow';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';
import './style/MapLegend.css';

class MapLegend extends React.Component {
    static propTypes = {
        active: PropTypes.bool,
        addLayerTitles: PropTypes.bool,
        bboxDependentLegend: PropTypes.bool,
        extraLegendParams: PropTypes.string,
        layers: PropTypes.array,
        map: PropTypes.object,
        onlyVisibleLegend: PropTypes.bool,
        scaleDependentLegend: PropTypes.bool,
        setCurrentTask: PropTypes.func,
        windowSize: PropTypes.object
    }
    static defaultProps = {
        addLayerTitles: false,
        bboxDependentLegend: false,
        onlyVisibleLegend: false,
        scaleDependentLegend: false,
        windowSize: {width: 320, height: 320}
    }
    state = {
        onlyVisibleLegend: false,
        bboxDependentLegend: false,
        scaleDependentLegend: false,
        visible: false
    }
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
            {icon: "eye", callback: () => this.setState({onlyVisibleLegend: !this.state.onlyVisibleLegend}), active: this.state.onlyVisibleLegend, msgid: LocaleUtils.trmsg("maplegend.onlyvisible")},
            {icon: "box", callback: () => this.setState({bboxDependentLegend: !this.state.bboxDependentLegend}), active: this.state.bboxDependentLegend, msgid: LocaleUtils.trmsg("maplegend.bboxdependent")},
            {icon: "scale", callback: () => this.setState({scaleDependentLegend: !this.state.scaleDependentLegend}), active: this.state.scaleDependentLegend, msgid: LocaleUtils.trmsg("maplegend.scaledependent")}
        ];

        return (
            <ResizeableWindow extraControls={extraControls} icon="list-alt" initialHeight={this.props.windowSize.height} initialWidth={this.props.windowSize.width}
                onClose={this.onClose} title={LocaleUtils.trmsg("maplegend.windowtitle")} >
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
    }
    printLayerLegend = (layer, sublayer, mapScale) => {
        let body = null;
        if (sublayer.sublayers) {
            body = sublayer.sublayers.map(subsublayer => this.printLayerLegend(layer, subsublayer));
        } else {
            const request = LayerUtils.getLegendUrl(layer, {name: sublayer.name}, mapScale, this.props.map, this.state.bboxDependentLegend, this.state.scaleDependentLegend, this.props.extraLegendParams);
            body = request ? (
                <div className="map-legend-legend-entry" key={sublayer.name}>
                    <img src={request} />
                    {this.props.addLayerTitles ? (<span className="map-legend-entry-title">{sublayer.title || sublayer.name}</span>) : null}
                </div>) : null;
        }
        return body;
    }
}

export default connect(state => ({
    active: state.task.id === "MapLegend",
    layers: state.layers.flat,
    map: state.map
}), {
    setCurrentTask: setCurrentTask
})(MapLegend);
