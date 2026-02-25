/**
 * Copyright 2017-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';

import {setEditContext, clearEditContext} from '../actions/editing';
import {setCurrentTask} from '../actions/task';
import AttributeForm from '../components/AttributeForm';
import ResizeableWindow from '../components/ResizeableWindow';
import TaskBar from '../components/TaskBar';
import ConfigUtils from '../utils/ConfigUtils';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import EditingInterface from '../utils/EditingInterface';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';

import './style/FeatureForm.css';


/**
 * Displays queried feature attributes in a form.
 *
 * The attribute form is generated from the QGIS attribute form configuration.
 *
 * This plugin queries the feature via the editing service specified by
 * `editServiceUrl` in `config.json` (by default the `qwc-data-service`), rather than over WMS
 * GetFeatureInfo like the `Identify` plugin.
 *
 * You need to create and permit `Data` resources for datasets which should be queryable via `FeatureForm`.
 * If the dataset it editable, the feature attributes can be edited directly in the displayed form.
 *
 * Can be used as default identify tool by setting `"identifyTool": "FeatureForm"` in `config.json`.
 */
class FeatureForm extends React.Component {
    static propTypes = {
        clearEditContext: PropTypes.func,
        click: PropTypes.object,
        currentEditContext: PropTypes.string,
        editConfigs: PropTypes.object,
        editContext: PropTypes.object,
        enabled: PropTypes.bool,
        /** Whether to clear the task when the results window is closed. */
        exitTaskOnResultsClose: PropTypes.bool,
        filter: PropTypes.object,
        /** Default window geometry with size, position and docking status. Positive position values (including '0') are related to top (InitialY) and left (InitialX), negative values (including '-0') to bottom (InitialY) and right (InitialX). */
        geometry: PropTypes.shape({
            initialWidth: PropTypes.number,
            initialHeight: PropTypes.number,
            initialX: PropTypes.number,
            initialY: PropTypes.number,
            initiallyDocked: PropTypes.bool,
            side: PropTypes.string
        }),
        iface: PropTypes.object,
        layers: PropTypes.array,
        map: PropTypes.object,
        setCurrentTask: PropTypes.func,
        setEditContext: PropTypes.func,
        startupParams: PropTypes.object,
        theme: PropTypes.object
    };
    static defaultProps = {
        clearResultsOnClose: true,
        geometry: {
            initialWidth: 320,
            initialHeight: 480,
            initialX: 0,
            initialY: 0,
            initiallyDocked: false,
            side: 'left'
        }
    };
    static defaultState = {
        pendingRequests: 0,
        pickedFeatures: null,
        selectedFeature: ""
    };
    constructor(props) {
        super(props);
        this.state = FeatureForm.defaultState;
    }
    componentDidMount() {
        if (this.props.enabled) {
            this.props.setEditContext('FeatureForm', {action: 'Pick'});
        }
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.enabled && this.props.theme && !prevProps.theme) {
            const startupParams = this.props.startupParams;
            const haveIc = ["1", "true"].includes((startupParams.ic || "").toLowerCase());
            const c = (startupParams.c || "").split(/[;,]/g).map(x => parseFloat(x) || 0);
            if (haveIc && c.length === 2) {
                const mapCrs = this.props.theme.mapCrs;
                this.queryFeatures(CoordinatesUtils.reproject(c, startupParams.crs || mapCrs, mapCrs));
            }
        } else if (this.props.theme !== prevProps.theme || !this.props.enabled && prevProps.enabled) {
            this.clearResults();
        }

        const isAllowedContext = [null, "FeatureForm"].includes(this.props.currentEditContext);
        if (this.props.enabled && this.state.pendingRequests === 0 && isAllowedContext && !this.props.editContext.changed) {
            const clickPoint = this.queryPoint(prevProps);
            if (clickPoint) {
                this.queryFeatures(clickPoint);
            }
        }
        if (this.state.pendingRequests === 0 && prevState.pendingRequests > 0) {
            // Select first result
            this.setSelectedFeature(Object.keys(this.state.pickedFeatures)[0]);
        }
    }
    queryPoint = (prevProps) => {
        if (this.props.click.button !== 0 || this.props.click === prevProps.click || (this.props.click.features || []).find(feature => feature.id === 'startupposmarker')) {
            return null;
        }
        const searchMarker = (this.props.click.features || []).find(feature => feature.id === 'searchmarker');
        if (searchMarker && searchMarker.geometry.type === "Point") {
            return searchMarker.geometry.coordinates;
        }
        return this.props.click.coordinate;
    };
    queryFeatures = (pos) => {
        let pendingRequests = 0;
        Object.entries(this.props.editConfigs).forEach(([mapName, editConfigs]) => {
            Object.entries(editConfigs).forEach(([layerName, editConfig]) => {
                if (!editConfig.geomType) {
                    // Skip geometryless datasets
                    return;
                }
                const match = LayerUtils.searchLayer(this.props.layers, 'wms_name', mapName, 'name', layerName);
                const mapScale = MapUtils.computeForZoom(this.props.map.scales, this.props.map.zoom);
                if (!match || !LayerUtils.sublayerVisible(match.layer, match.path) || !LayerUtils.layerScaleInRange(match.sublayer, mapScale)) {
                    return;
                }
                const layerOrder = match.layer.params.LAYERS.split(",");
                ++pendingRequests;
                const scale = Math.round(MapUtils.computeForZoom(this.props.map.scales, this.props.map.zoom));
                this.props.iface.getFeature(editConfig, pos, this.props.map.projection, scale, 96, (featureCollection) => {
                    this.setState((state) => {
                        let pickedFeatures = state.pickedFeatures;
                        if (!isEmpty(featureCollection?.features)) {
                            pickedFeatures = Object.fromEntries(Object.entries({
                                ...state.pickedFeatures,
                                ...featureCollection.features.reduce((res, feature) => ({
                                    ...res,
                                    [mapName + "#" + layerName + "#" + feature.id]: feature
                                }), {})
                            }).sort((a, b) => {
                                const partsA = a[0].split("#");
                                const partsB = b[0].split("#");
                                const diff = layerOrder.indexOf(partsB[1]) - layerOrder.indexOf(partsA[1]);
                                return diff === 0 ? partsA[1].localeCompare(partsB[1]) : diff;
                            }));
                        }
                        return {
                            pickedFeatures: pickedFeatures,
                            pendingRequests: state.pendingRequests - 1
                        };
                    });
                }, this.props.filter.filterParams?.[match.sublayer.name], this.props.filter.filterGeom);
            });
        });
        this.setState({pendingRequests: pendingRequests, pickedFeatures: {}, selectedFeature: ""});
    };
    render() {
        let resultWindow = null;
        if (this.state.pickedFeatures !== null) {
            let body = null;
            if (this.state.pendingRequests > 0) {
                body = (
                    <div className="feature-query-body"><span className="identify-body-message">{LocaleUtils.tr("featureform.querying")}</span></div>
                );
            } else if (isEmpty(this.state.pickedFeatures)) {
                body = (
                    <div className="feature-query-body"><span className="identify-body-message">{LocaleUtils.tr("common.noresults")}</span></div>
                );
            } else {
                const featureText = LocaleUtils.tr("featureform.feature");
                let attributeForm = null;
                if (this.props.editContext.feature) {
                    const translations = this.props.layers.find(layer => layer.wms_name === this.props.editContext.mapPrefix)?.translations;
                    attributeForm = (
                        <AttributeForm
                            editContext={this.props.editContext} iface={this.props.iface}
                            onCommit={this.updatePickedFeatures} translations={translations} />
                    );
                }
                const results = Object.entries(this.state.pickedFeatures).map(([id, feature]) => {
                    const [mapName, layerName, featureId] = id.split("#");
                    const editConfig = this.props.editConfigs[mapName][layerName];
                    const match = LayerUtils.searchLayer(this.props.layers, 'wms_name', mapName, 'name', layerName);
                    const layerTitle = match.layer.translations?.layertree?.[layerName] ?? editConfig.layerTitle ?? match?.sublayer?.title ?? layerName;
                    const featureName = editConfig.displayField ? feature.properties[editConfig.displayField] : featureText + " " + featureId;
                    return {value: id, title: layerTitle + ": " + featureName};
                }).sort((a, b) => a.title.localeCompare(b.title));
                body = (
                    <div className="feature-query-body">
                        {Object.keys(this.state.pickedFeatures).length > 1 ? (
                            <div className="feature-query-selection">
                                <select onChange={ev => this.setSelectedFeature(ev.target.value)} value={this.state.selectedFeature}>
                                    {results.map(entry => (
                                        <option key={entry.value} value={entry.value}>{entry.title}</option>
                                    ))}
                                </select>
                            </div>
                        ) : null}
                        {attributeForm}
                    </div>
                );
            }
            resultWindow = (
                <ResizeableWindow dockable={this.props.geometry.side} icon="featureform"
                    initialHeight={this.props.geometry.initialHeight} initialWidth={this.props.geometry.initialWidth}
                    initialX={this.props.geometry.initialX} initialY={this.props.geometry.initialY}
                    initiallyDocked={this.props.geometry.initiallyDocked} key="FeatureForm"
                    onClose={this.onWindowClose} title={LocaleUtils.tr("featureform.title")}
                >
                    {body}
                </ResizeableWindow>
            );
        }
        return [resultWindow, (
            <TaskBar key="FeatureFormTaskBar" task="FeatureForm">
                {() => ({
                    body: LocaleUtils.tr("infotool.clickhelpPoint")
                })}
            </TaskBar>
        )];
    }
    setSelectedFeature = (selectedFeature) => {
        if (selectedFeature) {
            const [mapName, layerName] = selectedFeature.split("#", 2);
            const editConfig = this.props.editConfigs[mapName][layerName];
            this.props.setEditContext('FeatureForm', {
                action: 'Pick',
                feature: this.state.pickedFeatures[selectedFeature],
                changed: false,
                mapPrefix: mapName,
                editConfig: editConfig
            });
        } else {
            this.props.clearEditContext('FeatureForm');
        }
        this.setState({selectedFeature: selectedFeature});
    };
    onWindowClose = () => {
        if (!this.props.editContext.changed) {
            this.clearResults();
            if (this.props.exitTaskOnResultsClose) {
                this.props.setCurrentTask(null);
            }
        }
    };
    clearResults = () => {
        this.props.clearEditContext('FeatureForm');
        this.setState(FeatureForm.defaultState);
    };
    updatePickedFeatures = (newfeature) => {
        this.setState(state => ({
            pickedFeatures: Object.entries(state.pickedFeatures).reduce((res, [key, feature]) => {
                res[key] = feature.id === newfeature.id ? newfeature : feature;
                return res;
            }, {})
        }));
    };
}

export default (iface = EditingInterface) => connect((state) => {
    const enabled = state.task.id === "FeatureForm" || (
        state.task.identifyEnabled &&
        ConfigUtils.getConfigProp("identifyTool", state.theme.current, "Identify") === "FeatureForm"
    );
    return {
        click: state.map.click || {modifiers: {}},
        enabled: enabled,
        editContext: state.editing.contexts.FeatureForm || {},
        currentEditContext: state.editing.currentContext,
        iface: iface,
        layers: state.layers.flat,
        filter: state.layers.filter,
        map: state.map,
        editConfigs: state.layers.editConfigs,
        theme: state.theme.current,
        startupParams: state.localConfig.startupParams
    };
},
{
    setCurrentTask: setCurrentTask,
    clearEditContext: clearEditContext,
    setEditContext: setEditContext
})(FeatureForm);
