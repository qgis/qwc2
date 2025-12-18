/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import FileSaver from 'file-saver';
import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';

import {LayerRole, addLayerFeatures, removeLayer} from '../actions/layers';
import {zoomToExtent, zoomToPoint} from '../actions/map';
import {setCurrentTask, setCurrentTaskBlocked} from '../actions/task';
import EditComboField from '../components/EditComboField';
import EditUploadField from '../components/EditUploadField';
import Icon from '../components/Icon';
import NavBar from '../components/widgets/NavBar';
import NumberInput from '../components/widgets/NumberInput';
import ReCaptchaWidget from '../components/widgets/ReCaptchaWidget';
import Spinner from '../components/widgets/Spinner';
import TextInput from '../components/widgets/TextInput';
import ConfigUtils from '../utils/ConfigUtils';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import {FeatureCache, KeyValCache, parseExpression, getFeatureTemplate} from '../utils/EditingUtils';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';
import MiscUtils from '../utils/MiscUtils';
import VectorLayerUtils from '../utils/VectorLayerUtils';

import './style/AttributeTableWidget.css';

class AttributeTableWidget extends React.Component {
    static propTypes = {
        addLayerFeatures: PropTypes.func,
        /** Whether to allow adding records for datasets which have a geometry column. */
        allowAddForGeometryLayers: PropTypes.bool,
        editConfigs: PropTypes.object,
        filter: PropTypes.object,
        iface: PropTypes.object,
        initialLayer: PropTypes.string,
        layers: PropTypes.array,
        /** Whether to limit to the extent by default. */
        limitToExtent: PropTypes.bool,
        mapBbox: PropTypes.object,
        mapCrs: PropTypes.string,
        mapScales: PropTypes.array,
        readOnly: PropTypes.bool,
        removeLayer: PropTypes.func,
        setCurrentTask: PropTypes.func,
        setCurrentTaskBlocked: PropTypes.func,
        /** Whether to show the display field only */
        showDisplayFieldOnly: PropTypes.bool,
        /** Whether to show a button to open the edit form for selected layer. Requires the Editing plugin to be enabled. */
        showEditFormButton: PropTypes.bool,
        /** Whether to show hidden Fields. */
        showHiddenFields: PropTypes.bool,
        /** Whether to show the layer selection menu. */
        showLayerSelection: PropTypes.bool,
        /** Whether to show the "Limit to extent" checkbox */
        showLimitToExtent: PropTypes.bool,
        /** The zoom level for zooming to point features. */
        zoomLevel: PropTypes.number,
        zoomToExtent: PropTypes.func,
        zoomToPoint: PropTypes.func
    };
    static defaultProps = {
        zoomLevel: 1000,
        showEditFormButton: true,
        showHiddenFields: true,
        showLayerSelection: true,
        limitToExtent: false
    };
    static defaultState = {
        loading: false,
        selectedLayer: "",
        loadedLayer: "",
        curEditConfig: null,
        fieldTranslations: null,
        features: [],
        filteredSortedFeatures: [],
        selectedFeatures: {},
        highlightedFeature: null,
        changedFeatureIdx: null,
        originalFeatureProps: null,
        pageSize: 50,
        currentPage: 0,
        filterField: "id",
        filterOp: "~",
        filterVal: "",
        sortField: null,
        deleteTask: null,
        newFeature: false,
        confirmDelete: false,
        limitToExtent: false,
        captchaResponse: ''
    };
    constructor(props) {
        super(props);
        this.changedFiles = {};
        this.state = AttributeTableWidget.defaultState;
        this.table = null;
        this.attribTableContents = null;
        this.state.limitToExtent = props.limitToExtent;
    }
    componentDidMount() {
        if (this.props.initialLayer) {
            this.reload(this.props.initialLayer);
        }
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.state.newFeature && !prevState.newFeature) {
            if (this.attribTableContents) {
                this.attribTableContents.scrollTop = this.attribTableContents.scrollHeight;
            }
        }
        // Reload conditions when limited to extent
        if (this.state.limitToExtent && this.state.selectedLayer && (!prevState.limitToExtent || this.props.mapBbox !== prevProps.mapBbox)) {
            this.reload();
        } else if (!this.state.limitToExtent && prevState.limitToExtent) {
            this.reload();
        }
        // Highlight feature
        if (this.state.highlightedFeature !== prevState.highlightedFeature || this.state.filteredSortedFeatures !== prevState.filteredSortedFeatures) {
            this.highlightFeatures();
        }
    }
    componentWillUnmount() {
        this.props.removeLayer("__attributetablehighlight");
    }
    render() {
        const captchaRequired = ConfigUtils.getConfigProp("editServiceCaptchaSiteKey") && !ConfigUtils.getConfigProp("username");
        const captchaPending = captchaRequired && !this.state.captchaResponse;

        const curEditConfig = this.state.curEditConfig;
        const editPermissions = curEditConfig?.permissions || {};
        const readOnly = this.props.readOnly || editPermissions.updatable === false;

        let loadOverlay = null;
        if (this.state.selectedLayer && this.state.selectedLayer !== this.state.loadedLayer) {
            if (this.state.loading) {
                loadOverlay = (
                    <div className="attribtable-overlay">
                        <Spinner /><span>{LocaleUtils.tr("common.loading")}</span>
                    </div>
                );
            } else {
                loadOverlay = (
                    <div className="attribtable-overlay">
                        <span>{LocaleUtils.tr("attribtable.pleasereload")}</span>
                    </div>
                );
            }
        } else if (this.state.deleteTask) {
            loadOverlay = (
                <div className="attribtable-overlay">
                    <Spinner /><span>{LocaleUtils.tr("attribtable.deleting")}</span>
                </div>
            );
        }
        let table = null;
        let footbar = null;
        if (curEditConfig && this.state.features) {
            const mapPrefix = this.state.curEditConfig.editDataset.split(".")[0];
            const fields = this.props.showDisplayFieldOnly ? curEditConfig.fields.filter(
                field => field.name === curEditConfig.displayField
            ) : curEditConfig.fields.filter(field => (
                field.id !== "id" &&
                (this.props.showHiddenFields || field.constraints?.hidden !== true)
            ));
            const indexOffset = this.state.currentPage * this.state.pageSize;
            const features = this.state.filteredSortedFeatures.slice(indexOffset, indexOffset + this.state.pageSize);
            table = (
                <table className="attribtable-table" ref={el => { this.table = el; }}>
                    <thead>
                        <tr>
                            <th />
                            {!this.props.showDisplayFieldOnly ? (
                                <th onClick={() => this.sortBy("id")} onKeyDown={MiscUtils.checkKeyActivate} tabIndex={0} title={this.translateFieldName("id")}>
                                    <span>
                                        <span className="attribtable-table-headername">{this.translateFieldName("id")}</span>
                                        {this.renderSortIndicator("id")}
                                        {this.renderColumnResizeHandle(1, 'r')}
                                    </span>
                                </th>
                            ) : null}
                            {fields.map((field, idx) => (
                                <th key={field.id} onClick={() => this.sortBy(field.id)} onKeyDown={MiscUtils.checkKeyActivate} tabIndex={0} title={this.translateFieldName(field.name)}>
                                    <span>
                                        {this.renderColumnResizeHandle(idx + 1, 'l')}
                                        <span className="attribtable-table-headername">{this.translateFieldName(field.name)}</span>
                                        {this.renderSortIndicator(field.id)}
                                        {idx < fields.length - 1 ? this.renderColumnResizeHandle(idx + 2, 'r') : null}
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {features.map((feature, filteredIndex) => {
                            const featureidx = feature.originalIndex;
                            const disabled = readOnly || (this.state.changedFeatureIdx !== null && this.state.changedFeatureIdx !== featureidx);
                            const key = this.state.changedFeatureIdx === featureidx && this.state.newFeature ? "newfeature" : feature.id;
                            return (
                                <tr className={disabled && !this.props.readOnly ? "row-disabled" : ""} key={key}
                                    onMouseEnter={() => this.setState({highlightedFeature: feature})}
                                    onMouseLeave={() => this.setState(state => ({highlightedFeature: state.highlightedFeature === feature ? null : state.highlightedFeature}))}
                                >
                                    <td>
                                        <span>
                                            {filteredIndex > 0 ? this.renderRowResizeHandle(filteredIndex, 't') : null}
                                            {<input checked={this.state.selectedFeatures[feature.id] === true} onChange={(ev) => this.setState((state) => ({selectedFeatures: {...state.selectedFeatures, [feature.id]: ev.target.checked}}))} type="checkbox" />}
                                            {this.renderRowResizeHandle(filteredIndex + 1, 'b')}
                                        </span>
                                    </td>
                                    {!this.props.showDisplayFieldOnly ? (
                                        <td>{feature.id}</td>
                                    ) : null}
                                    {fields.map(field => (
                                        <td key={field.id}>
                                            {this.renderField(curEditConfig, mapPrefix, field, featureidx, indexOffset + filteredIndex, disabled || (!!this.state.filterVal && field.id === this.state.filterField))}
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            );
            const npages = Math.ceil(this.state.filteredSortedFeatures.length / this.state.pageSize);
            const pages = [this.state.currentPage];
            const extraright = Math.max(0, 2 - this.state.currentPage);
            const extraleft = Math.max(0, this.state.currentPage - (npages - 3));
            for (let i = 0; i < 3 + extraleft; ++i) {
                if (this.state.currentPage - i > 0) {
                    pages.unshift(this.state.currentPage - i);
                }
            }
            for (let i = 0; i < 3 + extraright; ++i) {
                if (this.state.currentPage + i < npages - 1) {
                    pages.push(this.state.currentPage - i + 1);
                }
            }
            footbar = (
                <div className="attribtable-footbar">
                    <NavBar
                        currentPage={this.state.currentPage} disabled={this.state.changedFeatureIdx !== null}
                        nPages={npages} pageChanged={currentPage => this.setState({currentPage})}
                        pageSize={this.state.pageSize} pageSizeChanged={pageSize => this.setState({pageSize})} />

                    <div className="attribtable-filter controlgroup">
                        <Icon icon="filter" />
                        <select disabled={this.state.changedFeatureIdx !== null} onChange={ev => this.updateFilter("filterField", ev.target.value)} value={this.state.filterField}>
                            <option value="id">{this.translateFieldName("id")}</option>
                            {fields.map(field => (
                                <option key={field.id} value={field.id}>{this.translateFieldName(field.name)}</option>
                            ))}
                        </select>
                        <select disabled={this.state.changedFeatureIdx !== null} onChange={ev => this.updateFilter("filterOp", ev.target.value)} value={this.state.filterOp}>
                            <option value="~">~</option>
                            <option value="=">=</option>
                            <option value=">">&gt;</option>
                            <option value=">=">&gt;=</option>
                            <option value="<=">&lt;=</option>
                            <option value="<">&lt;</option>
                        </select>
                        <TextInput disabled={this.state.changedFeatureIdx !== null} onChange={value => this.updateFilter("filterVal", value, true)} value={this.state.filterVal} />
                    </div>
                    {this.props.showLimitToExtent ? (
                        <div>
                            <label><input checked={this.state.limitToExtent} onChange={(ev) => this.setState({limitToExtent: ev.target.checked})} type="checkbox" /> {LocaleUtils.tr("attribtable.limittoextent")}</label>
                        </div>
                    ) : null}
                </div>
            );
        }
        const nolayer = curEditConfig === null;
        const loading = this.state.loading;
        const editing = this.state.changedFeatureIdx !== null;
        const layerChanged = this.state.selectedLayer !== this.state.loadedLayer;
        const hasGeometry = (curEditConfig || {}).geomType !== null;
        const showAddButton = !this.props.readOnly && editPermissions.creatable !== false && (this.props.allowAddForGeometryLayers || !hasGeometry);
        const showDelButton = !this.props.readOnly && editPermissions.deletable !== false;
        const showEditButton = !this.props.readOnly && ConfigUtils.havePlugin("Editing") && this.props.showEditFormButton;
        const deleteButton = showDelButton ? (
            <button className="button" disabled={layerChanged || editing || !Object.values(this.state.selectedFeatures).find(entry => entry === true)} onClick={() => this.setState({confirmDelete: true})} title={LocaleUtils.tr("attribtable.deletefeatures")}>
                <Icon icon="trash" />
            </button>
        ) : null;
        let captchaBar = null;
        if (captchaRequired && (this.state.changedFeatureIdx !== null || this.state.confirmDelete)) {
            captchaBar = (<div><ReCaptchaWidget onChange={value => this.setState({captchaResponse: value})} sitekey={ConfigUtils.getConfigProp("editServiceCaptchaSiteKey")} /></div>);
        }

        return (
            <div className="AttributeTable">
                {loadOverlay}
                <div className="attribtable-toolbar">
                    {this.props.showLayerSelection ? (
                        <select disabled={loading || editing} onChange={ev => this.changeSelectedLayer(ev.target.value)} value={this.state.selectedLayer || ""}>
                            <option disabled value="">{LocaleUtils.tr("common.selectlayer")}</option>
                            {Object.entries(this.props.editConfigs).map(([wmsName, serviceConfigs]) => (
                                Object.entries(serviceConfigs).map(([layerName, editConfig]) => {
                                    const match = LayerUtils.searchLayer(this.props.layers, 'wms_name', wmsName, 'name', layerName);
                                    let layerTitle = layerName;
                                    if (match) {
                                        layerTitle = match.layer.translations?.layertree?.[layerName] ?? editConfig.layerTitle ?? match?.sublayer?.title ?? layerName;
                                    } else {
                                        // Note: geometry-less tables are filtered from the theme sublayers
                                        const translations = this.props.layers.find(layer => layer.wms_name === wmsName)?.translations;
                                        layerTitle = translations?.layertree?.[layerName] ?? editConfig.layerTitle ?? layerName;
                                    }
                                    const value = wmsName + "#" + layerName;
                                    return (
                                        <option key={value} value={value}>{layerTitle}</option>
                                    );
                                })
                            ))}
                        </select>
                    ) : null}
                    <button className="button" disabled={!this.state.selectedLayer || editing || this.state.loading} onClick={() => this.reload()} title={LocaleUtils.tr("attribtable.reload")}>
                        <Icon icon="refresh" />
                    </button>
                    {showAddButton ? (
                        <button className="button" disabled={nolayer || editing || loading || layerChanged} onClick={this.addFeature} title={LocaleUtils.tr("attribtable.addfeature")}>
                            <Icon icon="plus" />
                        </button>
                    ) : null}
                    <button className="button" disabled={layerChanged || !Object.values(this.state.selectedFeatures).find(entry => entry === true)} onClick={this.zoomToSelection} title={LocaleUtils.tr("attribtable.zoomtoselection")}>
                        <Icon icon="search" />
                    </button>
                    {showEditButton ? (
                        <button className="button" disabled={layerChanged || editing || Object.values(this.state.selectedFeatures).filter(entry => entry === true).length !== 1} onClick={this.switchToFormEditMode} title={LocaleUtils.tr("attribtable.formeditmode")}>
                            <Icon icon="editing" />
                        </button>
                    ) : null}
                    {this.state.confirmDelete ? (
                        <button className="button button-accept" disabled={captchaPending} onClick={this.deleteSelectedFeatured}>
                            <Icon icon="ok" />
                            <span>{LocaleUtils.tr("common.delete")}</span>
                        </button>
                    ) : deleteButton}
                    {this.state.confirmDelete ? (
                        <button className="button button-reject" onClick={() => this.setState({confirmDelete: false, captchaResponse: null})}>
                            <Icon icon="remove" />
                            <span>{LocaleUtils.tr("attribtable.nodelete")}</span>
                        </button>
                    ) : null}
                    {this.state.changedFeatureIdx !== null ? (
                        <button className="button button-accept" disabled={captchaPending} onClick={this.commit}>
                            <Icon icon="ok" />
                            <span>{LocaleUtils.tr("attribtable.commit")}</span>
                        </button>
                    ) : null}
                    {this.state.changedFeatureIdx !== null ? (
                        <button className="button button-reject" onClick={this.discard}>
                            <Icon icon="remove" />
                            <span>{LocaleUtils.tr("attribtable.discard")}</span>
                        </button>
                    ) : null}
                    <button className="button" disabled={isEmpty(this.state.features)} onClick={() => this.csvExport()} title={LocaleUtils.tr("attribtable.csvexport")}>
                        <Icon icon="export" />
                    </button>
                </div>
                {captchaBar}
                <div className="attribtable-contents" ref={el => {this.attribTableContents = el;}}>
                    {table}
                </div>
                {footbar}
            </div>
        );
    }
    renderSortIndicator = (field) => {
        if (this.state.sortField && this.state.sortField.field === field) {
            return (<Icon icon={this.state.sortField.dir > 0 ? "chevron-down" : "chevron-up"} />);
        } else {
            return null;
        }
    };
    renderColumnResizeHandle = (col, pos) => {
        return (
            <span className={"attribtable-table-" + pos + "draghandle"}
                onPointerDown={(ev) => this.resizeTable(ev, col, true)} />
        );
    };
    renderRowResizeHandle = (row, pos) => {
        return (
            <span className={"attribtable-table-" + pos + "draghandle"}
                onPointerDown={(ev) => this.resizeTable(ev, row, false)} />
        );
    };
    changeSelectedLayer = (value) => {
        this.setState({selectedLayer: value});
    };
    reload = (selectedLayer = null) => {
        this.setState((state) => {
            selectedLayer = selectedLayer || state.selectedLayer;
            const [wmsName, layerName] = selectedLayer.split("#");
            const editConfig = this.props.editConfigs[wmsName][layerName];
            KeyValCache.clear();
            FeatureCache.clear();
            const bbox = this.state.limitToExtent ? this.props.mapBbox.bounds : null;
            this.props.iface.getFeatures(
                editConfig, this.props.mapCrs, (result) => {
                    if (result) {
                        const features = result.features || [];
                        const fieldTranslations = this.props.layers.find(layer => layer.wms_name === wmsName)?.translations?.layers?.[layerName]?.fields ?? {};
                        this.setState((state2) => ({
                            loading: false,
                            features: features,
                            filteredSortedFeatures: this.filteredSortedFeatures(features, state2),
                            loadedLayer: selectedLayer,
                            curEditConfig: editConfig,
                            fieldTranslations: fieldTranslations
                        }));
                    } else {
                        // eslint-disable-next-line
                        alert(LocaleUtils.tr("attribtable.loadfailed"));
                        this.setState({loading: false});
                    }
                },
                bbox, this.props.filter.filterParams?.[selectedLayer], this.props.filter.filterGeom,
                this.props.showDisplayFieldOnly ? [editConfig.displayField, "geometry"] : null
            );
            return {...AttributeTableWidget.defaultState, loading: true, selectedLayer: selectedLayer, limitToExtent: state.limitToExtent};
        });
    };
    sortBy = (field) => {
        let newState = {};
        if (this.state.sortField && this.state.sortField.field === field) {
            newState = {sortField: {field: field, dir: -this.state.sortField.dir}};
        } else {
            newState = {sortField: {field: field, dir: 1}};
        }
        newState.filteredSortedFeatures = this.filteredSortedFeatures(this.state.features, {...this.state, ...newState});
        this.setState(newState);
    };
    renderField = (editConfig, mapPrefix, field, featureidx, filteredIndex, fielddisabled) => {
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
        } else if (constraints.values || constraints.keyvalrel) {
            let filterExpr = null;
            if (field.filterExpression) {
                filterExpr = parseExpression(field.filterExpression, feature, editConfig, this.props.iface, mapPrefix, this.props.mapCrs, () => this.setState({reevaluate: +new Date}), true);
            }
            input = (
                <EditComboField
                    editIface={this.props.iface} fieldId={field.id} filterExpr={filterExpr} keyvalrel={constraints.keyvalrel}
                    multiSelect={constraints.allowMulti === true} name={field.id} readOnly={constraints.readOnly || disabled}
                    required={constraints.required} updateField={updateField} value={value} values={constraints.values} />
            );
        } else if (field.type === "number") {
            const precision = constraints.prec ?? 0;
            const step = constraints.step ?? 1;
            input = (
                <NumberInput decimals={precision} disabled={disabled} fitParent max={constraints.max} min={constraints.min}
                    name={field.id} onChange={v => updateField(field.id, v, true)}
                    readOnly={constraints.readOnly} required={constraints.required} step={step} value={value} />
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
            return (<EditUploadField constraints={constraints} dataset={editConfig.editDataset} disabled={disabled} fieldId={field.id} iface={this.props.iface} name={field.id} showThumbnails={false} updateField={updateField} updateFile={(fieldId, data) => {this.changedFiles[fieldId] = data; }} value={value} />);
        } else if (field.type === "text") {
            if ((feature.properties[field.id] ?? null) === null) {
                value = ConfigUtils.getConfigProp("editTextNullValue") ?? "";
            }
            const updateTextField = (val) => {
                if (val !== value) {
                    const textNullValue = ConfigUtils.getConfigProp("editTextNullValue");
                    updateField(field.id, textNullValue !== undefined && val === textNullValue ? null : val);
                }
            };
            const addLinkAnchors = ConfigUtils.getConfigProp("editingAddLinkAnchors") !== false;
            const editTextNullValue = ConfigUtils.getConfigProp("editTextNullValue");
            input = (
                <TextInput addLinkAnchors={addLinkAnchors} clearValue={editTextNullValue} disabled={disabled} multiline={constraints.multiline} name={field.id}
                    onChange={updateTextField} required={constraints.required} value={value} />
            );
        } else {
            input = (
                <input disabled={disabled} name={field.id} type={field.type} {...constraints}
                    onChange={(ev) => updateField(field.id, ev.target.value)}
                    value={value}/>
            );
        }
        return input;
    };
    addFeature = () => {
        const hasGeometry = this.state.curEditConfig.geomType !== null;
        if (!this.props.allowAddForGeometryLayers && hasGeometry) {
            // eslint-disable-next-line
            alert(LocaleUtils.tr("attribtable.geomnoadd"));
            return;
        }
        const featureSkel = {
            type: "Feature",
            geometry: null,
            properties: this.state.curEditConfig.fields.reduce((res, field) => {
                if (field.id !== "id") {
                    res[field.id] = field.type === "text" ? "" : null;
                }
                return res;
            }, {})
        };
        const mapPrefix = this.state.curEditConfig.editDataset.split(".")[0];
        getFeatureTemplate(this.state.curEditConfig, featureSkel, this.props.iface, mapPrefix, this.props.mapCrs, feature => {
            this.setState((state) => ({
                features: [...state.features, feature],
                filteredSortedFeatures: [...state.filteredSortedFeatures, {...feature, originalIndex: state.features.length}],
                filterVal: "",
                currentPage: Math.floor(state.features.length / state.pageSize),
                changedFeatureIdx: state.filteredSortedFeatures.length,
                newFeature: true
            }));
            this.props.setCurrentTaskBlocked(true, LocaleUtils.tr("editing.unsavedchanged"));
        });
    };
    deleteSelectedFeatured = () => {
        this.setState((state) => {
            const features = state.filteredSortedFeatures.filter(feature => state.selectedFeatures[feature.id] === true);
            features.forEach(feature => {
                this.props.iface.deleteFeature(state.curEditConfig, feature.id, (success) => {
                    this.setState((state2) => {
                        const newState = {
                            deleteTask: {
                                ...state2.deleteTask,
                                pending: state2.deleteTask.pending.filter(entry => entry !== feature.id),
                                failed: success ? state2.deleteTask.failed : [...state2.deleteTask.failed, feature.id],
                                deleted: !success ? state2.deleteTask.deleted : [...state2.deleteTask.deleted, feature.id]
                            }
                        };
                        if (isEmpty(newState.deleteTask.pending)) {
                            newState.features = state.features.filter(f => !newState.deleteTask.deleted.includes(f.id));
                            newState.filteredSortedFeatures = this.filteredSortedFeatures(newState.features, state);
                            if (!isEmpty(newState.deleteTask.failed)) {
                                // eslint-disable-next-line
                                alert(LocaleUtils.tr("attribtable.deletefailed"));
                            }
                            newState.deleteTask = null;
                            newState.currentPage = Math.floor((newState.features.length - 1) / state.pageSize);
                            newState.selectedFeatures = {};
                            newState.confirmDelete = false;
                        }
                        return newState;
                    });
                }, state.captchaResponse);
            });
            return {deleteTask: {
                pending: features.map(feature => feature.id),
                failed: [],
                deleted: []
            }};
        });
    };
    updateField = (featureidx, filteredIdx, fieldid, value, emptynull) => {
        this.props.setCurrentTaskBlocked(true, LocaleUtils.tr("editing.unsavedchanged"));
        this.setState((state) => {
            value = value === "" && emptynull ? null : value;
            const newFeatures = [...state.features];
            newFeatures[featureidx] = {...newFeatures[featureidx]};
            newFeatures[featureidx].properties = {...newFeatures[featureidx].properties, [fieldid]: value};
            const newfilteredSortedFeatures = [...state.filteredSortedFeatures];
            newfilteredSortedFeatures[filteredIdx] = {...newfilteredSortedFeatures[filteredIdx]};
            newfilteredSortedFeatures[filteredIdx].properties = {...newfilteredSortedFeatures[filteredIdx].properties, [fieldid]: value};
            const originalFeatureProps = state.originalFeatureProps || {...state.features[featureidx].properties};
            return {features: newFeatures, filteredSortedFeatures: newfilteredSortedFeatures, changedFeatureIdx: featureidx, originalFeatureProps: originalFeatureProps};
        });
    };
    commit = () => {
        const feature = {
            ...this.state.features[this.state.changedFeatureIdx],
            crs: {
                type: "name",
                properties: {name: CoordinatesUtils.toOgcUrnCrs(this.props.mapCrs)}
            }
        };
        Object.keys(feature.properties || {}).forEach(name => {
            const fieldConfig = this.state.curEditConfig.fields?.find?.(f => f.id === name) ?? {};
            if (fieldConfig.expression) {
                // Skip virtual fields
                delete feature.properties[name];
            }
        });
        // Omit geometry if it is read-only
        const canEditGeometry = ['Point', 'LineString', 'Polygon'].includes((this.state.curEditConfig.geomType || "").replace(/^Multi/, '').replace(/Z$/, ''));
        if (!canEditGeometry) {
            delete feature.geometry;
        }
        const featureData = new FormData();
        featureData.set('feature', JSON.stringify(feature));
        Object.entries(this.changedFiles).forEach(([key, value]) => featureData.set('file:' + key, value));

        if (this.state.captchaResponse) {
            featureData.set('g-recaptcha-response', this.state.captchaResponse);
        }

        if (this.state.newFeature) {
            this.props.iface.addFeatureMultipart(
                this.state.curEditConfig, this.props.mapCrs, featureData,
                (success, result) => this.featureCommited(success, result)
            );
        } else {
            this.props.iface.editFeatureMultipart(
                this.state.curEditConfig, this.props.mapCrs, feature.id, featureData,
                (success, result) => this.featureCommited(success, result)
            );
        }
    };
    featureCommited = (success, result) => {
        if (!success) {
            // eslint-disable-next-line
            alert(result);
        } else {
            this.changedFiles = {};
            this.setState((state) => {
                const newFeatures = [...state.features];
                newFeatures[state.changedFeatureIdx] = result;
                return {features: newFeatures, filteredSortedFeatures: this.filteredSortedFeatures(newFeatures, state), changedFeatureIdx: null, originalFeatureProps: null, newFeature: false};
            });
        }
        this.props.setCurrentTaskBlocked(false);
    };
    discard = () => {
        const newFeatures = [...this.state.features];
        if (this.state.newFeature) {
            newFeatures.splice(this.state.changedFeatureIdx, 1);
        } else {
            const featureidx = this.state.changedFeatureIdx;
            newFeatures[featureidx] = {...newFeatures[featureidx]};
            newFeatures[featureidx].properties = this.state.originalFeatureProps;
        }
        this.changedFiles = {};
        this.setState((state) => ({features: newFeatures, filteredSortedFeatures: this.filteredSortedFeatures(newFeatures, state), changedFeatureIdx: null, originalFeatureProps: null, newFeature: false}));
        this.props.setCurrentTaskBlocked(false);
    };
    highlightFeatures = () => {
        const features = [];
        if (this.state.highlightedFeature) {
            features.push(this.state.highlightedFeature);
        } else if (this.state.filterVal) {
            features.push(...Object.values(this.state.filteredSortedFeatures));
        }
        const layer = {
            id: "__attributetablehighlight",
            role: LayerRole.SELECTION
        };
        this.props.addLayerFeatures(layer, features.map(f => ({id: f.id, geometry: f.geometry})), true);
    };
    zoomToSelection = () => {
        const collection = {
            type: "FeatureCollection",
            features: this.state.filteredSortedFeatures.filter(feature => this.state.selectedFeatures[feature.id] === true && feature.geometry)
        };
        if (!isEmpty(collection.features)) {
            if (collection.features.length === 1 && collection.features[0].geometry.type === "Point") {
                const zoom = MapUtils.computeZoom(this.props.mapScales, this.props.zoomLevel);
                this.props.zoomToPoint(collection.features[0].geometry.coordinates, zoom, this.props.mapCrs);
            } else {
                this.props.zoomToExtent(VectorLayerUtils.computeFeatureBBox(collection), this.props.mapCrs);
            }
        }
    };
    switchToFormEditMode = () => {
        const hasGeometry = this.state.curEditConfig.geomType !== null;
        if (!hasGeometry) {
            // eslint-disable-next-line
            alert(LocaleUtils.tr("attribtable.nogeomnoform"));
            return;
        }
        const feature = this.state.filteredSortedFeatures.find(f => this.state.selectedFeatures[f.id] === true);
        this.props.setCurrentTask("Editing", null, null, {layer: this.state.loadedLayer, feature: feature});
    };
    updateFilter = (field, val, resetPage = false) => {
        this.setState((state) => ({
            [field]: val,
            currentPage: resetPage ? 0 : state.currentPage,
            filteredSortedFeatures: this.filteredSortedFeatures(state.features, {...state, [field]: val})
        }));
    };
    filteredSortedFeatures = (features, state) => {
        let filteredFeatures = [];
        if (!state.filterVal) {
            filteredFeatures = features.map((feature, idx) => ({...feature, originalIndex: idx}));
        } else {
            const filterVal = state.filterVal.toLowerCase();
            let test = null;
            if (state.filterOp === "~") {
                test = (x) => (String(x).toLowerCase().includes(filterVal));
            } else if (state.filterOp === "=") {
                test = (x) => (String(x).toLowerCase() === filterVal);
            } else if (state.filterOp === ">") {
                test = (x) => (Number(x) > Number(filterVal));
            } else if (state.filterOp === ">=") {
                test = (x) => (Number(x) >= Number(filterVal));
            } else if (state.filterOp === "<=") {
                test = (x) => (Number(x) <= Number(filterVal));
            } else if (state.filterOp === "<") {
                test = (x) => (Number(x) < Number(filterVal));
            }
            // Build value relation lookup
            const valueLookup = this.state.curEditConfig.fields.reduce((res, field) => {
                if (field.constraints && field.constraints.values) {
                    res[field.id] = field.constraints.values.reduce((res2, constraint) => {
                        res2[constraint.value] = constraint.label;
                        return res2;
                    }, {});
                } else if (field.constraints && field.constraints.keyvalrel) {
                    res[field.id] = KeyValCache.getSync(this.props.iface, field.constraints.keyvalrel).reduce((res2, entry) => {
                        res2[entry.value] = entry.label;
                        return res2;
                    }, {});
                }
                return res;
            }, {});
            const filterFieldValue = state.filterField === "id" ? (feature) => feature.id : (feature) => {
                const value = feature.properties[state.filterField];
                return valueLookup[state.filterField] ? valueLookup[state.filterField][value] : value;
            };
            filteredFeatures = features.reduce((res, feature, idx) => {
                if (test(filterFieldValue(feature))) {
                    res.push({...feature, originalIndex: idx});
                }
                return res;
            }, []);
        }
        if (state.sortField) {
            const sortFieldValue = state.sortField.field === "id" ? (feature) => feature.id : (feature) => feature.properties[state.sortField.field];
            return filteredFeatures.sort((f1, f2) => {
                const v1 = String(sortFieldValue(f1));
                const v2 = String(sortFieldValue(f2));
                return v1.localeCompare(v2, undefined, {numeric: true, sensitivity: 'base'}) * state.sortField.dir;
            });
        } else {
            return filteredFeatures;
        }
    };
    resizeTable = (ev, index, resizeCol) => {
        if (this.table) {
            const element = this.table.getElementsByTagName(resizeCol ? "th" : "tr")[index];
            let initial = 0;
            if (resizeCol) {
                initial = parseFloat(element.style.minWidth.replace(/px$/, '')) || element.clientWidth;
            } else {
                initial = parseFloat(element.style.height.replace(/px$/, '')) || element.clientHeight;
            }
            const resize = {
                anchor: resizeCol ? ev.clientX : ev.clientY,
                element: element,
                initial: initial
            };
            const resizeDo = resizeCol ? (event) => {
                const delta = event.clientX - resize.anchor;
                resize.element.style.minWidth = Math.max((resize.initial + delta), 16) + "px";
                resize.element.style.width = Math.max((resize.initial + delta), 16) + "px";
            } : (event) => {
                const delta = event.clientY - resize.anchor;
                resize.element.style.height = Math.max((resize.initial + delta), 16) + "px";
            };
            const eventShield = ev.view.document.createElement("div");
            eventShield.className = '__event_shield';
            ev.view.document.body.appendChild(eventShield);
            ev.view.document.body.classList.add(resizeCol ? 'ewresizing' : 'nsresizing');
            ev.view.addEventListener("pointermove", resizeDo);
            ev.view.addEventListener("pointerup", (event) => {
                event.view.document.body.removeChild(eventShield);
                event.view.removeEventListener("pointermove", resizeDo);
                event.view.document.body.classList.remove(resizeCol ? 'ewresizing' : 'nsresizing');
            }, {once: true});
        }
    };
    csvExport = () => {
        const fields = this.props.showDisplayFieldOnly ? this.state.curEditConfig.fields.filter(
            field => field.name === this.state.curEditConfig.displayField
        ) : this.state.curEditConfig.fields.filter(field => field.id !== 'id');
        let data = "";
        data += "id," + fields.map(field => `"${field.name.replaceAll('"', '""')}"`).join(",") + "\n";

        this.state.features.forEach(feature => {
            data += feature.id + "," + fields.map(field => {
                const value = feature.properties[field.id];
                if (value === null || value === undefined) {
                    return "null";
                } else {
                    return `"${String(feature.properties[field.id]).replaceAll('"', '""')}"`;
                }
            }).join(",") + "\n";
        });
        FileSaver.saveAs(new Blob([data], {type: "text/plain;charset=utf-8"}), this.state.loadedLayer + ".csv");
    };
    translateFieldName = (fieldName) => {
        return this.state.fieldTranslations?.[fieldName] ?? fieldName;
    };
}

export default connect((state) => ({
    editConfigs: state.layers.editConfigs,
    layers: state.layers.flat,
    filter: state.layers.filter,
    mapBbox: state.map.bbox,
    mapCrs: state.map.projection,
    mapScales: state.map.scales
}), {
    addLayerFeatures: addLayerFeatures,
    removeLayer: removeLayer,
    setCurrentTask: setCurrentTask,
    setCurrentTaskBlocked: setCurrentTaskBlocked,
    zoomToExtent: zoomToExtent,
    zoomToPoint: zoomToPoint
})(AttributeTableWidget);
