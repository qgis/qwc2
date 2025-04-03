/**
 * Copyright 2025 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {Line} from 'react-chartjs-2';
import {connect} from 'react-redux';

import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';
import {v1 as uuidv1} from 'uuid';

import {LayerRole} from '../actions/layers';
import {setCurrentTask} from '../actions/task';
import Icon from '../components/Icon';
import ResizeableWindow from '../components/ResizeableWindow';
import ButtonBar from '../components/widgets/ButtonBar';
import NumberInput from '../components/widgets/NumberInput';
import TextInput from '../components/widgets/TextInput';
import IdentifyUtils from '../utils/IdentifyUtils';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';

import './style/ValueTool.css';


/**
 * Displays raster band values of active raster layers at the hovered mouse position,
 * queried via GetFeatureInfo.
 */
class ValueTool extends React.Component {
    static propTypes = {
        /** The number of decimal places to display for elevation values. */
        enabled: PropTypes.bool,
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
        setCurrentTask: PropTypes.func
    };
    static defaultProps = {
        geometry: {
            initialWidth: 240,
            initialHeight: 320,
            initialX: 0,
            initialY: 0,
            initiallyDocked: false,
            side: 'left'
        }
    };
    static defaultState = {
        activeTab: 'Table',
        showLayers: 'visible',
        showBands: 'all',
        selectedLayers: [],
        selectedBands: {},
        values: {},
        graphMinY: null,
        graphMaxY: null
    };
    constructor(props) {
        super(props);
        this.queryTimeout = null;
        this.reqId = null;
        this.state = ValueTool.defaultState;
    }
    componentDidUpdate(prevProps) {
        if (this.props.enabled && !prevProps.enabled) {
            MapUtils.getHook(MapUtils.GET_MAP).on('pointermove', this.scheduleQueryValues);
        } else if (!this.props.enabled && prevProps.enabled) {
            MapUtils.getHook(MapUtils.GET_MAP).un('pointermove', this.scheduleQueryValues);
            clearTimeout(this.queryTimeout);
            this.queryTimeout = null;
            this.setState(ValueTool.defaultState);
        }
    }
    render() {
        if (!this.props.enabled) {
            return null;
        }
        const buttons = [
            {key: "Table", label: LocaleUtils.tr("valuetool.table")},
            {key: "Graph", label: LocaleUtils.tr("valuetool.graph")},
            {key: "Options", label: LocaleUtils.tr("valuetool.options")}
        ];
        let tab = null;
        if (this.state.activeTab === "Table") {
            tab = this.renderTableTab();
        } else if (this.state.activeTab === "Graph") {
            tab = this.renderGraphTab();
        } else if (this.state.activeTab === "Options") {
            tab = this.renderOptionsTab();
        }
        return (
            <ResizeableWindow dockable={this.props.geometry.side} icon="info-sign"
                initialHeight={this.props.geometry.initialHeight} initialWidth={this.props.geometry.initialWidth}
                initialX={this.props.geometry.initialX} initialY={this.props.geometry.initialY}
                initiallyDocked={this.props.geometry.initiallyDocked}
                onClose={this.onWindowClose} title={LocaleUtils.tr("valuetool.title")}
            >
                <div className="valuetool-body" role="body">
                    <ButtonBar active={this.state.activeTab} buttons={buttons} onClick={key => this.setState({activeTab: key})} />
                    {tab}
                </div>
            </ResizeableWindow>
        );
    }
    renderTableTab = () => {
        if (isEmpty(this.state.values)) {
            return (<span><i>{LocaleUtils.tr("valuetool.nodata")}</i></span>);
        }
        return (
            <table className="valuetool-table">
                <tbody>
                    {Object.entries(this.state.values).map(([key, data]) => {
                        let bandvals = Object.entries(data.values);
                        if (this.state.selectedBands[key]) {
                            const activeBands = this.state.selectedBands[key].split(",").map(x => parseInt(x.trim(), 10) - 1);
                            bandvals = bandvals.filter((_, i) => activeBands.includes(i));
                        }
                        return [
                            (
                                <tr key={key}>
                                    <th colSpan="2">
                                        {data.layertitle}
                                    </th>
                                </tr>
                            ),
                            bandvals.map(([bandname, bandval]) => (
                                <tr key={key + "_" + bandname}>
                                    <td>{bandname}</td>
                                    <td>{bandval}</td>
                                </tr>
                            ))
                        ];
                    })}
                </tbody>
            </table>
        );
    };
    renderGraphTab = () => {
        const values = Object.values(this.state.values).map(x => Object.values(x.values)).flat().filter(x => x);
        const data = {
            labels: values.map((_, i) => String(i)),
            datasets: [{
                data: values,
                borderColor: "rgb(255,0,0)",
                borderWidth: 2
            }]
        };
        const yAxisConfig = {};
        if (this.state.graphMinY) {
            yAxisConfig.min = this.state.graphMinY;
        }
        if (this.state.graphMaxY) {
            yAxisConfig.max = this.state.graphMaxY;
        }

        const options = {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 0
            },
            scales: {
                y: yAxisConfig
            }
        };
        return (
            <div>
                <div className="valuetool-chart-options">
                    <span>{LocaleUtils.tr("valuetool.ymin")}: </span>
                    <NumberInput onChange={value => this.setState({graphMinY: value})} value={this.state.graphMinY} />
                    <span style={{marginLeft: '0.5em'}} />
                    <span>{LocaleUtils.tr("valuetool.ymax")}: </span>
                    <NumberInput onChange={value => this.setState({graphMaxY: value})} value={this.state.graphMaxY} />
                </div>
                <div className="valuetool-chart-container">
                    <Line data={data} options={options} />
                </div>
            </div>
        );
    };
    renderOptionsTab = () => {
        const options = (this.state.showLayers === "selected" || this.state.showBands === "selected") ? [
            (<hr key="sep" />),
            (<div key="label">{LocaleUtils.tr("valuetool.selectlayersbands")}</div>),
            (
                <table className="valuetool-table-selection" key="table">
                    <tbody>
                        <tr>
                            <th>{LocaleUtils.tr("valuetool.layer")}</th>
                            {this.state.showBands === "selected" ? (
                                <th>{LocaleUtils.tr("valuetool.bands")}</th>
                            ) : null}
                        </tr>
                        {this.props.layers.map(layer => {
                            const sublayers = LayerUtils.getSublayerNames(layer, true, (sublayer) => sublayer.geometryType === null);
                            return sublayers.map(sublayer => {
                                const key = layer.url + "#" + sublayer;
                                return (
                                    <tr key={key}>
                                        <td>
                                            {this.state.showLayers === "selected" ? (
                                                <Icon icon={this.state.selectedLayers.includes(key) ? "checked" : "unchecked"} onClick={() => this.toggleSelectedLayer(key)} />
                                            ) : null}
                                            {sublayer}
                                        </td>
                                        {this.state.showBands === "selected" ? (
                                            <td>
                                                <TextInput onChange={(value) => this.setLayerBands(key, value)} placeholder={LocaleUtils.tr("valuetool.all")} value={this.state.selectedBands[key] || ""} />
                                            </td>
                                        ) : null}
                                    </tr>
                                );
                            });
                        })}
                    </tbody>
                </table>
            )
        ] : null;
        return (
            <div>
                <table className="valuetool-table-options">
                    <tbody>
                        <tr>
                            <td>{LocaleUtils.tr("valuetool.showlayers")}:</td>
                            <td>
                                <select onChange={ev => this.setState({showLayers: ev.target.value})} value={this.state.showLayers}>
                                    <option value="visible">{LocaleUtils.tr("valuetool.visiblelayers")}</option>
                                    <option value="all">{LocaleUtils.tr("valuetool.alllayers")}</option>
                                    <option value="selected">{LocaleUtils.tr("valuetool.selectedlayers")}</option>
                                </select>
                            </td>
                        </tr>
                        <tr>
                            <td>{LocaleUtils.tr("valuetool.showbands")}:</td>
                            <td>
                                <select onChange={ev => this.setState({showBands: ev.target.value})} value={this.state.showBands}>
                                    <option value="all">{LocaleUtils.tr("valuetool.allbands")}</option>
                                    <option value="selected">{LocaleUtils.tr("valuetool.selectedbands")}</option>
                                </select>
                            </td>
                        </tr>
                    </tbody>
                </table>
                {options}
            </div>
        );
    };
    toggleSelectedLayer = (key) => {
        this.setState(state => ({
            selectedLayers: state.selectedLayers.includes(key) ? state.selectedLayers.filter(x => x !== key) : [...state.selectedLayers, key]
        }));
    };
    setLayerBands = (key, bands) => {
        this.setState(state => ({
            selectedBands: {
                ...state.selectedBands, [key]: [...new Set(bands.split(",").map(x => parseInt(x.trim(), 10) || 0).sort().filter(x => x))].join(", ")
            }
        }));
    };
    onWindowClose = () => {
        this.props.setCurrentTask(null);
    };
    scheduleQueryValues = (ev) => {
        const coordinate = ev.coordinate;
        clearTimeout(this.queryTimeout);
        this.queryTimeout = setTimeout(() => this.queryValues(coordinate), 100);
    };
    queryValues = (coordinate) => {
        const options = {
            info_format: 'text/xml',
            feature_count: 5,
            with_geometry: false,
            with_htmlcontent: false
        };
        const reqId = uuidv1();
        this.reqId = reqId;
        const newValues = {};
        this.props.layers.forEach(layer => {
            let layerActive = null;
            if (this.state.showLayers === "all") {
                layerActive = () => true;
            } else if (this.state.showLayers === "selected") {
                layerActive = (sublayer) => this.state.selectedLayers.includes(layer.url + "#" + sublayer.name);
            } else if (this.state.showLayers === "visible") {
                layerActive = (sublayer) => sublayer.visibility;
            }
            const queryLayers = LayerUtils.getSublayerNames(layer, true, (sublayer) => {
                return layerActive(sublayer) && sublayer.geometryType === null
            });
            if (isEmpty(queryLayers)) {
                return;
            }
            // Preserve previous result rows, but with empty values, to prevent "flickering"
            queryLayers.forEach(sublayername => {
                const key = layer.url + "#" + sublayername;
                if (this.state.values[key]) {
                    newValues[key] = {
                        ...this.state.values[key],
                        values: Object.fromEntries(Object.keys(this.state.values[key].values).map(k => [k, ""]))
                    };
                }
            });
            const request = IdentifyUtils.buildRequest(layer, queryLayers.join(","), coordinate, this.props.map, options);
            IdentifyUtils.sendRequest(request, (response) => {
                if (this.reqId === reqId) {
                    const result = IdentifyUtils.parseXmlResponse(response || "", this.props.map.projection);
                    this.setState(state => ({
                        values: {
                            ...state.values,
                            ...Object.entries(result).reduce((res, [sublayername, features]) => {
                                const key = layer.url + "#" + sublayername;
                                res[key] = {
                                    layertitle: features[0].layertitle,
                                    values: features[0].properties
                                };
                                return res;
                            }, {})
                        }
                    }));
                }
            });
        });
        this.setState({values: newValues});
    };
}

export default connect((state) => ({
    enabled: state.task.id === "ValueTool",
    layers: state.layers.flat.filter(layer => (
        (layer.role === LayerRole.THEME || layer.role === LayerRole.USERLAYER) && (layer.infoFormats || []).includes("text/xml")
    )),
    map: state.map
}), {
    setCurrentTask: setCurrentTask
})(ValueTool);
