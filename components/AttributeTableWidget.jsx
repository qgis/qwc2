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
        featureCount: 0,
        allFeatures: null,
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
        newFeature: null,
        confirmDelete: false,
        limitToExtent: false,
        captchaResponse: '',
        clientSideData: false
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
            this.reload(this.props.initialLayer, true);
        }
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.state.newFeature && !prevState.newFeature) {
            if (this.attribTableContents) {
                this.attribTableContents.scrollTop = this.attribTableContents.scrollHeight;
            }
        }
        // Reload conditions when limited to extent
        if (this.state.limitToExtent && this.state.loadedLayer && (!prevState.limitToExtent || this.props.mapBbox !== prevProps.mapBbox)) {
            this.reload(this.state.loadedLayer, true, {currentPage: 0});
        } else if (!this.state.limitToExtent && prevState.limitToExtent) {
            this.reload(this.state.loadedLayer, true, {currentPage: 0});
        }
        // Highlight feature
        if (this.state.highlightedFeature !== prevState.highlightedFeature || this.state.features !== prevState.features) {
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
        const loading = this.state.loading;
        const editing = this.state.changedFeatureIdx !== null || this.state.newFeature;

        let loadOverlay = null;
        if (loading) {
            loadOverlay = (
                <div className="attribtable-overlay">
                    <Spinner /><span>{LocaleUtils.tr("common.loading")}</span>
                </div>
            );
        } else if (this.state.selectedLayer && this.state.selectedLayer !== this.state.loadedLayer) {
            loadOverlay = (
                <div className="attribtable-overlay">
                    <span>{LocaleUtils.tr("attribtable.pleasereload")}</span>
                </div>
            );
        } else if (this.state.deleteTask) {
            loadOverlay = (
                <div className="attribtable-overlay">
                    <Spinner /><span>{LocaleUtils.tr("attribtable.deleting")}</span>
                </div>
            );
        }
        let table = null;
        let footbar = null;
        if (curEditConfig && this.state.features && this.state.selectedLayer === this.state.loadedLayer) {
            const primaryKey = curEditConfig.primaryKey ?? "id";
            const mapPrefix = this.state.curEditConfig.editDataset.split(".")[0];
            const fields = this.props.showDisplayFieldOnly ? curEditConfig.fields.filter(
                field => field.name === curEditConfig.displayField
            ) : curEditConfig.fields.filter(field => (
                field.id !== primaryKey &&
                (this.props.showHiddenFields || field.constraints?.hidden !== true)
            ));
            const indexOffset = this.state.currentPage * this.state.pageSize;
            const features = this.state.features.slice(indexOffset, indexOffset + this.state.pageSize);
            table = (
                <table className="attribtable-table" ref={el => { this.table = el; }}>
                    <thead>
                        <tr>
                            <th />
                            {!this.props.showDisplayFieldOnly ? (
                                <th onClick={() => this.sortBy(primaryKey)} onKeyDown={MiscUtils.checkKeyActivate} tabIndex={0} title={this.translateFieldName(primaryKey)}>
                                    <span>
                                        <span className="attribtable-table-headername">{this.translateFieldName(primaryKey)}</span>
                                        {this.renderSortIndicator(primaryKey)}
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
                        {features.map((feature, sliceidx) => {
                            const featureidx = indexOffset + sliceidx;
                            const disabled = readOnly || (editing && this.state.changedFeatureIdx !== featureidx);
                            const updateField = (fieldid, val, emptynull = false) => this.updateField(featureidx, fieldid, val, emptynull);
                            return (
                                <tr className={disabled && !this.props.readOnly ? "row-disabled" : ""} key={feature.id}
                                    onMouseEnter={() => this.setState({highlightedFeature: feature})}
                                    onMouseLeave={() => this.setState(state => ({highlightedFeature: state.highlightedFeature === feature ? null : state.highlightedFeature}))}
                                >
                                    <td>
                                        <span>
                                            {sliceidx > 0 ? this.renderRowResizeHandle(sliceidx, 't') : null}
                                            {<input checked={this.state.selectedFeatures[feature.id] === true} onChange={(ev) => this.setState((state) => ({selectedFeatures: {...state.selectedFeatures, [feature.id]: ev.target.checked}}))} type="checkbox" />}
                                            {this.renderRowResizeHandle(sliceidx + 1, 'b')}
                                        </span>
                                    </td>
                                    {!this.props.showDisplayFieldOnly ? (
                                        <td>{feature.id}</td>
                                    ) : null}
                                    {fields.map(field => (
                                        <td key={field.id}>
                                            {this.renderField(feature, curEditConfig, mapPrefix, field, updateField, disabled || (!!this.state.filterVal && field.id === this.state.filterField))}
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                        {this.state.newFeature ? (
                            <tr>
                                <td>
                                    <span>
                                        {features.length > 0 ? this.renderRowResizeHandle(features.length, 't') : null}
                                        {<input disabled type="checkbox" />}
                                        {this.renderRowResizeHandle(features.length + 1, 'b')}
                                    </span>
                                </td>
                                {!this.props.showDisplayFieldOnly ? (
                                    <td>{this.state.newFeature.id}</td>
                                ) : null}
                                {fields.map(field => (
                                    <td key={field.id}>
                                        {this.renderField(this.state.newFeature, curEditConfig, mapPrefix, field, this.updateNewFeatureField, false)}
                                    </td>
                                ))}
                            </tr>
                        ) : null}
                    </tbody>
                </table>
            );
            const npages = Math.ceil(this.state.featureCount / this.state.pageSize);
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
            const footbarDisabled = loading || editing;
            const fieldConfig = this.state.curEditConfig.fields.find(field => field.id === this.state.filterField);
            let valueInput = null;
            if (fieldConfig?.constraints?.values || fieldConfig?.constraints?.keyvalrel) {
                let values = fieldConfig.constraints.values;
                if (fieldConfig.constraints.keyvalrel) {
                    values = KeyValCache.getSync(this.props.iface, fieldConfig.constraints.keyvalrel);
                }
                valueInput = (
                    <select className="attribtable-filter-value" disabled={footbarDisabled} onChange={ev => this.updateFilter("filterVal", ev.target.value)} value={this.state.filterVal}>
                        <option value="">{LocaleUtils.tr("common.select")}</option>
                        {values.map(entry => (
                            <option key={entry.value} value={entry.value}>{entry.label}</option>
                        ))}
                    </select>
                );
            } else {
                valueInput = (
                    <TextInput className="attribtable-filter-value" disabled={footbarDisabled} onChange={value => this.updateFilter("filterVal", value)} value={this.state.filterVal} />
                );
            }
            footbar = (
                <div className="attribtable-footbar">
                    <NavBar
                        currentPage={this.state.currentPage} disabled={footbarDisabled}
                        nPages={npages} pageChanged={currentPage => this.setState({currentPage}, this.reload)}
                        pageSize={this.state.pageSize} pageSizeChanged={pageSize => this.setState({pageSize, currentPage: 0})} />

                    <div className="attribtable-filter controlgroup">
                        <Icon icon="filter" />
                        <select disabled={footbarDisabled} onChange={ev => this.updateFilter("filterField", ev.target.value)} value={this.state.filterField}>
                            <option value="<id>">{this.translateFieldName("id")}</option>
                            {fields.map(field => (
                                <option key={field.id} value={field.id}>{this.translateFieldName(field.name)}</option>
                            ))}
                        </select>
                        <select disabled={footbarDisabled} onChange={ev => this.updateFilter("filterOp", ev.target.value)} value={this.state.filterOp}>
                            <option value="~">~</option>
                            <option value="=">=</option>
                            <option value="!=">!=</option>
                            <option value=">">&gt;</option>
                            <option value=">=">&gt;=</option>
                            <option value="<=">&lt;=</option>
                            <option value="<">&lt;</option>
                        </select>
                        {valueInput}
                    </div>
                    {this.props.showLimitToExtent ? (
                        <div>
                            <label><input checked={this.state.limitToExtent} disabled={loading} onChange={(ev) => this.setState({limitToExtent: ev.target.checked})} type="checkbox" /> {LocaleUtils.tr("attribtable.limittoextent")}</label>
                        </div>
                    ) : null}
                </div>
            );
        }
        const nolayer = curEditConfig === null;
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
        if (captchaRequired && (editing || this.state.confirmDelete)) {
            captchaBar = (<div><ReCaptchaWidget onChange={value => this.setState({captchaResponse: value})} sitekey={ConfigUtils.getConfigProp("editServiceCaptchaSiteKey")} /></div>);
        }

        return (
            <div className="AttributeTable">
                <div className="attribtable-toolbar">
                    {this.props.showLayerSelection ? (
                        <select disabled={loading || editing} onChange={ev => this.setState({selectedLayer: ev.target.value})} value={this.state.selectedLayer || ""}>
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
                    <button className="button" disabled={!this.state.selectedLayer || editing || loading} onClick={() => this.reload(this.state.loadedLayer, true)} title={LocaleUtils.tr("attribtable.reload")}>
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
                    {editing ? (
                        <button className="button button-accept" disabled={captchaPending} onClick={this.commit}>
                            <Icon icon="ok" />
                            <span>{LocaleUtils.tr("attribtable.commit")}</span>
                        </button>
                    ) : null}
                    {editing ? (
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
                    {loadOverlay}
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
    renderField = (feature, editConfig, mapPrefix, field, updateField, fielddisabled) => {
        let value = feature.properties[field.id];
        if (value === undefined || value === null) {
            value = "";
        }
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
    reload = (selectedLayer = null, forceReload = false, stateChange = {}) => {
        this.setState((state) => {
            selectedLayer = selectedLayer || state.selectedLayer;
            const [wmsName, layerName] = selectedLayer.split("#");
            const newState = {...state, ...stateChange};
            const editConfig = this.props.editConfigs[wmsName][layerName];
            if (selectedLayer !== state.loadedLayer) {
                KeyValCache.clear();
                FeatureCache.clear();
                Object.assign(newState, AttributeTableWidget.defaultState);
                newState.limitToExtent = state.limitToExtent;
                newState.curEditConfig = editConfig;
                newState.fieldTranslations = this.props.layers.find(layer => layer.wms_name === wmsName)?.translations?.layers?.[layerName]?.fields ?? {};
            }
            newState.selectedLayer = selectedLayer;

            const options = {
                bbox: newState.limitToExtent ? this.props.mapBbox.bounds : null,
                filter: this.props.filter.filterParams?.[selectedLayer],
                filterGeom: this.props.filter.filterGeom,
                fields: this.props.showDisplayFieldOnly ? [editConfig.displayField, "geometry"] : null
            };
            // If sort or filter field is virtual, query full feature set and sort/filter client side
            const fieldMap = (newState.curEditConfig?.fields || []).reduce((res, field) => ({...res, [field.id]: field}), {});
            const clientSideFilterSort = newState.clientSideData || (newState.filterVal && fieldMap[newState.filterField]?.expression) || fieldMap[newState.sortField?.field]?.expression;

            if (!forceReload && clientSideFilterSort && newState.allFeatures) {
                return {...newState, features: this.filteredSortedFeatures(newState.allFeatures, newState)};
            } else {
                if (clientSideFilterSort) {
                    /* eslint-disable-next-line no-alert */
                    if (!forceReload && !confirm(LocaleUtils.tr("attribtable.fulldatasetload"))) {
                        return {};
                    }
                } else {
                    if (this.props.filter.filterParams?.[selectedLayer] && newState.filterVal) {
                        options.filter = [this.props.filter.filterParams?.[selectedLayer], 'and', [newState.filterField, newState.filterOp.replace(), newState.filterVal]];
                    } else if (newState.filterVal) {
                        options.filter = [[newState.filterField, newState.filterOp.replace(), newState.filterVal]];
                    }
                    options.offset = newState.currentPage * newState.pageSize;
                    options.limit = newState.pageSize;
                    options.sortby = newState.sortField ? ((newState.sortField.dir < 0 ? "-" : "") + newState.sortField.field) : null;
                }
                newState.loading = true;
                this.props.iface.getFeatures(
                    editConfig, this.props.mapCrs, (result) => {
                        if (result) {
                            const featuresSlice = result.features || [];
                            const featureCount = result.numberMatched ?? featuresSlice.length;
                            const features = new Array(featureCount);
                            features.splice(options.offset, featuresSlice.length, ...featuresSlice);
                            this.setState({
                                loading: false,
                                allFeatures: options.limit === undefined || result.numberMatched === undefined ? features : null,
                                features: clientSideFilterSort ? this.filteredSortedFeatures(features, newState) : features,
                                featureCount: featureCount,
                                loadedLayer: newState.selectedLayer,
                                clientSideData: result.numberMatched === undefined
                            });
                        } else {
                            // eslint-disable-next-line
                            alert(LocaleUtils.tr("attribtable.loadfailed"));
                            this.setState({loading: false, features: [], featureCount: 0});
                        }
                    }, options
                );
            }
            return newState;
        });
    };
    filteredSortedFeatures = (features, state) => {
        let filteredFeatures = features;
        if (state.filterVal) {
            const filterVal = state.filterVal.toLowerCase();
            let test = null;
            if (state.filterOp === "~") {
                test = (x) => (String(x).toLowerCase().includes(filterVal));
            } else if (state.filterOp === "=") {
                test = (x) => (String(x).toLowerCase() === filterVal);
            } else if (state.filterOp === "!=") {
                test = (x) => (String(x).toLowerCase() !== filterVal);
            } else if (state.filterOp === ">") {
                test = (x) => (Number(x) > Number(filterVal));
            } else if (state.filterOp === ">=") {
                test = (x) => (Number(x) >= Number(filterVal));
            } else if (state.filterOp === "<=") {
                test = (x) => (Number(x) <= Number(filterVal));
            } else if (state.filterOp === "<") {
                test = (x) => (Number(x) < Number(filterVal));
            }
            const filterFieldValue = state.filterField === "<id>" ? (feature) => feature.id : (feature) => {
                return feature.properties[state.filterField];
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
    sortBy = (field) => {
        const newState = {sortField: this.state.sortField};
        if (newState.sortField && newState.sortField.field === field) {
            newState.sortField = {field: field, dir: -newState.sortField.dir};
        } else {
            newState.sortField = {field: field, dir: 1};
        }
        this.reload(this.state.selectedLayer, false, newState);
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
            this.setState({
                newFeature: feature,
                filterVal: ""
            });
            this.props.setCurrentTaskBlocked(true, LocaleUtils.tr("editing.unsavedchanged"));
        });
    };
    deleteSelectedFeatured = () => {
        this.setState((state) => {
            const features = state.features.filter(feature => state.selectedFeatures[feature.id] === true);
            features.forEach(feature => {
                this.props.iface.deleteFeature(state.curEditConfig, feature.id, (success) => {
                    this.onFeatureDeleted(feature.id, success);
                }, state.captchaResponse);
            });
            return {deleteTask: {
                pending: features.map(feature => feature.id),
                failed: [],
                deleted: []
            }};
        });
    };
    onFeatureDeleted = (featureid, success) => {
        let reload = false;
        this.setState((state) => {
            const newState = {
                deleteTask: {
                    ...state.deleteTask,
                    pending: state.deleteTask.pending.filter(entry => entry !== featureid),
                    failed: success ? state.deleteTask.failed : [...state.deleteTask.failed, featureid],
                    deleted: !success ? state.deleteTask.deleted : [...state.deleteTask.deleted, featureid]
                }
            };
            if (isEmpty(newState.deleteTask.pending)) {
                if (!isEmpty(newState.deleteTask.failed)) {
                    // eslint-disable-next-line
                    alert(LocaleUtils.tr("attribtable.deletefailed"));
                }
                // Compute new page taking into account number of deleted features
                newState.currentPage = Math.max(0, state.currentPage - Math.floor(newState.deleteTask.deleted.length / state.pageSize));
                newState.deleteTask = null;
                newState.confirmDelete = false;
                reload = true;
            }
            return newState;
        }, () => {
            if (reload) {
                this.reload(this.state.loadedLayer, true);
            }
        });
    };
    updateField = (featureidx, fieldid, value, emptynull) => {
        this.props.setCurrentTaskBlocked(true, LocaleUtils.tr("editing.unsavedchanged"));
        this.setState((state) => {
            value = value === "" && emptynull ? null : value;
            const newFeatures = [...state.features];
            newFeatures[featureidx] = {...newFeatures[featureidx]};
            newFeatures[featureidx].properties = {...newFeatures[featureidx].properties, [fieldid]: value};
            const originalFeatureProps = state.originalFeatureProps || {...state.features[featureidx].properties};
            return {features: newFeatures, changedFeatureIdx: featureidx, originalFeatureProps: originalFeatureProps};
        });
    };
    updateNewFeatureField = (fieldid, value, emptynull) => {
        this.setState(state => {
            value = value === "" && emptynull ? null : value;
            return {newFeature: {...state.newFeature, properties: {...state.newFeature.properties, [fieldid]: value}}};
        });
    };
    commit = () => {
        const feature = this.state.newFeature ?? {
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
            this.reload(this.state.loadedLayer, true, {changedFeatureIdx: null, originalFeatureProps: null, newFeature: null});
        }
        this.props.setCurrentTaskBlocked(false);
    };
    discard = () => {
        this.changedFiles = {};
        this.setState((state) => {
            const newFeatures = [...state.features];
            if (!state.newFeature) {
                const featureidx = state.changedFeatureIdx;
                newFeatures[featureidx] = {...newFeatures[featureidx]};
                newFeatures[featureidx].properties = state.originalFeatureProps;
            }
            return {features: newFeatures, changedFeatureIdx: null, originalFeatureProps: null, newFeature: null};
        });
        this.props.setCurrentTaskBlocked(false);
    };
    highlightFeatures = () => {
        let features = [];
        if (this.state.highlightedFeature) {
            features.push(this.state.highlightedFeature);
        } else if (this.state.filterVal) {
            features = this.state.features;
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
            features: this.state.features.filter(feature => this.state.selectedFeatures[feature.id] === true && feature.geometry)
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
        const feature = this.state.features.find(f => this.state.selectedFeatures[f.id] === true);
        this.props.setCurrentTask("Editing", null, null, {layer: this.state.loadedLayer, feature: feature});
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
