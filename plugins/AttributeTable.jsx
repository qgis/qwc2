/**
 * Copyright 2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import geojsonBbox from 'geojson-bounding-box';
import {LayerRole} from '../actions/layers';
import {zoomToExtent} from '../actions/map';
import {setCurrentTask} from '../actions/task';
import EditUploadField from '../components/EditUploadField';
import Icon from '../components/Icon';
import ResizeableWindow from '../components/ResizeableWindow';
import Spinner from '../components/Spinner';
import EditingInterface from '../utils/EditingInterface';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import './style/AttributeTable.css';


class AttributeTable extends React.Component {
    static propTypes = {
        active: PropTypes.bool,
        iface: PropTypes.object,
        layers: PropTypes.array,
        mapCrs: PropTypes.string,
        setCurrentTask: PropTypes.func,
        theme: PropTypes.object,
        zoomToExtent: PropTypes.func
    }
    static defaultState = {
        loading: false,
        selectedLayer: "",
        loadedLayer: "",
        features: [],
        filteredFeatures: [],
        changedFeatureIdx: null,
        originalFeatureProps: null,
        pageSize: 50,
        currentPage: 0,
        filterField: "id",
        filterOp: "~",
        filterVal: ""
    }
    constructor(props) {
        super(props);
        this.changedFiles = {};
        this.state = AttributeTable.defaultState;
    }
    render() {
        if (!this.props.active) {
            return null;
        }

        const editConfig = this.props.theme.editConfig;
        const currentEditConfig = editConfig[this.state.loadedLayer];
        const themeSublayers = this.props.layers.reduce((accum, layer) => {
            return layer.role === LayerRole.THEME ? accum.concat(LayerUtils.getSublayerNames(layer)) : accum;
        }, []);
        const locked = this.state.loading;
        let loadOverlay = null;
        if (this.state.selectedLayer && this.state.selectedLayer !== this.state.loadedLayer) {
            if (this.state.loading) {
                loadOverlay = (
                    <div className="attribtable-loading">
                        <Spinner /><span>{LocaleUtils.tr("attribtable.loading")}</span>
                    </div>
                );
            } else {
                loadOverlay = (
                    <div className="attribtable-reload">
                        <button className="button" onClick={this.reload}>
                            <Icon icon="refresh" />
                            <span>{LocaleUtils.tr("attribtable.reload")}</span>
                        </button>
                    </div>
                );
            }
        }
        let table = null;
        let navbar = null;
        if (currentEditConfig && this.state.features) {
            const fields = currentEditConfig.fields.reduce((res, field) => {
                if (field.id !== "id") {
                    res.push(field);
                }
                return res;
            }, []);
            const indexOffset = this.state.currentPage * this.state.pageSize;
            const features = this.state.filteredFeatures.slice(indexOffset, indexOffset + this.state.pageSize);
            table = (
                <table>
                    <tbody>
                        <tr>
                            <th />
                            <th>id</th>
                            {fields.map(field => (
                                <th key={field.id}>{field.name}</th>
                            ))}
                        </tr>
                        {features.map((feature, filteredIndex) => {
                            const featureidx = feature.originalIndex;
                            const disabled = this.state.changedFeatureIdx !== null && this.state.changedFeatureIdx !== featureidx;
                            return (
                                <tr className={disabled ? "row-disabled" : ""} key={feature.id}>
                                    <td>{feature.geometry ? (<Icon icon="search" onClick={() => this.zoomToFeature(feature)} />) : null}</td>
                                    <td>{feature.id}</td>
                                    {fields.map(field => (
                                        <td key={field.id}>
                                            {this.renderField(field, featureidx, indexOffset + filteredIndex, disabled || (!!this.state.filterVal && field.id === this.state.filterField) )}
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            );
            const pages = Math.ceil(this.state.filteredFeatures.length / this.state.pageSize);
            navbar = (
                <div className="attribtable-footbar">
                    <span className="attribtable-nav">
                        <button className="button" disabled={this.state.currentPage <= 0 || this.state.changedFeatureIdx !== null} onClick={() => this.setState({currentPage: this.state.currentPage - 1})}>
                            <Icon icon="nav-left" />
                        </button>
                        <select disabled={this.state.changedFeatureIdx !== null} onChange={(ev) => this.setState({currentPage: parseInt(ev.target.value, 10)})} value={this.state.currentPage}>
                            {new Array(pages).fill(0).map((x, idx) => (
                                <option key={idx} value={idx}>{(idx * this.state.pageSize + 1) + " - " + (Math.min(this.state.filteredFeatures.length, (idx + 1) * this.state.pageSize))}</option>
                            ))}
                        </select>
                        <span> / {this.state.filteredFeatures.length}</span>
                        <button className="button" disabled={this.state.currentPage >= pages - 1 || this.state.changedFeatureIdx !== null} onClick={() => this.setState({currentPage: this.state.currentPage + 1})}>
                            <Icon icon="nav-right" />
                        </button>
                    </span>
                    <span className="attribtable-filter">
                        <Icon icon="filter" />
                        <select disabled={this.state.changedFeatureIdx !== null} onChange={ev => this.updateFilter("filterField", ev.target.value)} value={this.state.filterField}>
                            <option value="id">id</option>
                            {fields.map(field => (
                                <option key={field.id} value={field.id}>{field.name}</option>
                            ))}
                        </select>
                        <select disabled={this.state.changedFeatureIdx !== null} onChange={ev => this.updateFilter("filterOp", ev.target.value)} value={this.state.filterOp}>
                            <option value="~">~</option>
                            <option value="=">=</option>
                        </select>
                        <input disabled={this.state.changedFeatureIdx !== null} onChange={ev => this.updateFilter("filterVal", ev.target.value)} type="text" value={this.state.filterVal} />
                        <button className="button" disabled={this.state.changedFeatureIdx !== null} onClick={() => this.updateFilter("filterVal", "")} value={this.state.filterValue}><Icon icon="clear" /></button>
                    </span>
                </div>
            );
        }
        return (
            <ResizeableWindow icon="editing" initialHeight={480} initialWidth={800} onClose={this.onClose} title={LocaleUtils.tr("attribtable.title")}>
                <div className="attribtable-body" role="body">
                    <div className="attribtable-toolbar">
                        <span>{LocaleUtils.tr("attribtable.layer")}</span>
                        <select disabled={locked} onChange={ev => this.changeSelectedLayer(ev.target.value)} value={this.state.selectedLayer || ""}>
                            <option disabled value="">{LocaleUtils.tr("attribtable.selectlayer")}</option>
                            {Object.keys(editConfig).filter(layerId => themeSublayers.includes(layerId)).map(layerId => {
                                const layerName = editConfig[layerId].layerName;
                                const match = LayerUtils.searchLayer(this.props.layers, 'name', layerName, [LayerRole.THEME]);
                                return (
                                    <option key={layerId} value={layerId}>{match ? match.sublayer.title : layerName}</option>
                                );
                            })}
                        </select>
                        <button className="button" disabled={locked || !this.state.selectedLayer} onClick={this.reload}>
                            <Icon icon="refresh" />
                        </button>
                        {this.state.changedFeatureIdx !== null ? (
                            <button className="button edit-commit" onClick={this.commit}>
                                <Icon icon="ok" />
                                <span>{LocaleUtils.tr("attribtable.commit")}</span>
                            </button>
                        ) : null}
                        {this.state.changedFeatureIdx !== null ? (
                            <button className="button edit-discard" onClick={this.discard}>
                                <Icon icon="remove" />
                                <span>{LocaleUtils.tr("attribtable.discard")}</span>
                            </button>
                        ) : null}
                    </div>
                    <div className="attribtable-contents">
                        {loadOverlay}
                        {table}
                    </div>
                    {navbar}
                </div>
            </ResizeableWindow>
        );
    }
    onClose = () => {
        this.setState(AttributeTable.defaultState);
        this.props.setCurrentTask(null);
    }
    changeSelectedLayer = (value) => {
        this.setState({selectedLayer: value});
    }
    reload = () => {
        this.setState({...AttributeTable.defaultState, loading: true, selectedLayer: this.state.selectedLayer});
        this.props.iface.getFeatures(this.editLayerId(this.state.selectedLayer), this.props.mapCrs, (result) => {
            const features = result.features || [];
            this.setState({loading: false, features: features, filteredFeatures: this.filteredFeatures(features, this.state), loadedLayer: this.state.selectedLayer});
        });
    }
    editLayerId = (layerId) => {
        if (this.props.theme && this.props.theme.editConfig && this.props.theme.editConfig[layerId]) {
            return this.props.theme.editConfig[layerId].editDataset || layerId;
        }
        return layerId;
    }
    renderField = (field, featureidx, filteredIndex, fielddisabled = false) => {
        const feature = this.state.features[featureidx];
        let value = feature.properties[field.id];
        if (value === undefined || value === null) {
            value = "";
        }
        const updateField = (fieldid, val, emptynull = false) => this.updateField(featureidx, filteredIndex, fieldid, val, emptynull);
        const constraints = field.constraints || {};
        const disabled = constraints.readOnly || fielddisabled;
        let input = null;
        if (field.type === "boolean" || field.type === "bool") {
            input = (<input name={field.id} {...constraints} checked={value} disabled={disabled} onChange={ev => updateField(field.id, ev.target.checked)} type="checkbox" />);
        } else if (constraints.values) {
            input = (
                <select disabled={constraints.readOnly || disabled} name={field.id}
                    onChange={ev => updateField(field.id, ev.target.value)}
                    required={constraints.required} value={value}
                >
                    <option disabled value="">
                        {LocaleUtils.tr("editing.select")}
                    </option>
                    {constraints.values.map((item, index) => {
                        let optValue = "";
                        let label = "";
                        if (typeof(item) === 'string') {
                            optValue = label = item;
                        } else {
                            optValue = item.value;
                            label = item.label;
                        }
                        return (
                            <option key={field.id + index} value={optValue}>{label}</option>
                        );
                    })}
                </select>
            );
        } else if (field.type === "number") {
            const precision = constraints.step > 0 ? Math.ceil(-Math.log10(constraints.step)) : 6;
            input = (
                <input disabled={disabled} max={constraints.max} min={constraints.min}
                    name={field.id} onChange={nr => updateField(field.id, nr, true)}
                    precision={precision} readOnly={constraints.readOnly} required={constraints.required}
                    step={constraints.step || 1} type="number" value={value} />
            );
        } else if (field.type === "date") {
            // Truncate time portion of ISO date string
            value = value.substr(0, 10);
            input = (
                <input disabled={disabled} name={field.id} type={field.type} {...constraints}
                    onChange={(ev) => updateField(field.id, ev.target.value, true)}
                    value={value} />
            );
        } else if (field.type === "file") {
            return (<EditUploadField constraints={constraints} disabled={disabled} editLayerId={this.editLayerId(this.state.selectedLayer)} fieldId={field.id} name={field.id} showThumbnails={false} updateField={updateField} updateFile={(fieldId, data) => {this.changedFiles[fieldId] = data; }} value={value} />);
        } else {
            input = (
                <input disabled={disabled} name={field.id} type={field.type} {...constraints}
                    onChange={(ev) => updateField(field.id, ev.target.value)}
                    value={value}/>
            );
        }
        return input;
    }
    updateField = (featureidx, filteredIdx, fieldid, value, emptynull) => {
        value = value === "" && emptynull ? null : value;
        const newFeatures = [...this.state.features];
        newFeatures[featureidx] = {...newFeatures[featureidx]};
        newFeatures[featureidx].properties = {...newFeatures[featureidx].properties, [fieldid]: value};
        const newFilteredFeatures = [...this.state.filteredFeatures];
        newFilteredFeatures[filteredIdx] = {...newFilteredFeatures[filteredIdx]};
        newFilteredFeatures[filteredIdx].properties = {...newFilteredFeatures[filteredIdx].properties, [fieldid]: value};
        const originalFeatureProps = this.state.originalFeature || {...this.state.features[featureidx].properties};
        this.setState({features: newFeatures, filteredFeatures: newFilteredFeatures, changedFeatureIdx: featureidx, originalFeatureProps: originalFeatureProps});
    }
    commit = () => {
        const feature = {
            ...this.state.features[this.state.changedFeatureIdx],
            crs: {
                type: "name",
                properties: {name: "urn:ogc:def:crs:EPSG::" + this.props.mapCrs.split(":")[1]}
            }
        };
        const featureData = new FormData();
        featureData.set('feature', JSON.stringify(feature));
        Object.entries(this.changedFiles).forEach(([key, value]) => featureData.set('file:' + key, value));
        this.props.iface.editFeatureMultipart(
            this.editLayerId(this.state.loadedLayer), feature.id, featureData,
            (success, result) => this.featureCommited(success, result)
        );
    }
    featureCommited = (success, result) => {
        if (!success) {
            alert(result);
        } else {
            const featureidx = this.state.changedFeatureIdx;
            const newFeatures = [...this.state.features];
            newFeatures[featureidx] = result;
            this.changedFiles = {};
            this.setState({features: newFeatures, filteredFeatures: this.filteredFeatures(newFeatures, this.state), changedFeatureIdx: null, originalFeature: null});
        }
    }
    discard = () => {
        const featureidx = this.state.changedFeatureIdx;
        const newFeatures = [...this.state.features];
        newFeatures[featureidx] = {...newFeatures[featureidx]};
        newFeatures[featureidx].properties = this.state.originalFeatureProps;
        this.changedFiles = {};
        this.setState({features: newFeatures, changedFeatureIdx: null, originalFeature: null});
    }
    zoomToFeature = (feature) => {
        const bbox = geojsonBbox({
            type: "FeatureCollection",
            features: [feature]
        });
        this.props.zoomToExtent(bbox, this.props.mapCrs);
    }
    updateFilter = (state, val) => {
        const newState = {...this.state, [state]: val};
        this.setState({[state]: val, filteredFeatures: this.filteredFeatures(this.state.features, newState)});
    }
    filteredFeatures = (features, state) => {
        if (!state.filterVal) {
            return features.map((feature, idx) => ({...feature, originalIndex: idx}));
        }
        const filterVal = state.filterVal.toLowerCase();
        let test = null;
        if (state.filterOp === "~") {
            test = (x) => (String(x).toLowerCase().includes(filterVal));
        } else if (state.filterOp === "=") {
            test = (x) => (String(x).toLowerCase() === filterVal);
        }
        if (state.filterField === "id") {
            return features.reduce((res, feature, idx) => {
                if (test(feature.id)) {
                    res.push({...feature, originalIndex: idx});
                }
                return res;
            }, []);
        } else {
            return features.reduce((res, feature, idx) => {
                if (test(feature.properties[state.filterField])) {
                    res.push({...feature, originalIndex: idx});
                }
                return res;
            }, []);
        }
    }
}

export default (iface = EditingInterface) => {
    return connect((state) => ({
        active: state.task.id === "AttributeTable",
        iface: iface,
        layers: state.layers.flat,
        mapCrs: state.map.projection,
        theme: state.theme.current
    }), {
        setCurrentTask: setCurrentTask,
        zoomToExtent: zoomToExtent
    })(AttributeTable);
};
