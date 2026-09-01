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

import {LayerRole, addLayerFeatures, removeLayer, refreshLayer} from '../actions/layers';
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
import VectorLayerUtils from '../utils/VectorLayerUtils';
import ComboBox from './widgets/ComboBox';
import FeaturesTable from './widgets/FeaturesTable';

import './style/AttributeTableWidget.css';


class AttributeTableWidget extends React.Component {
    static propTypes = {
        addLayerFeatures: PropTypes.func,
        /** Whether to allow adding records for datasets which have a geometry column. */
        allowAddForGeometryLayers: PropTypes.bool,
        editConfigs: PropTypes.object,
        filter: PropTypes.object,
        /** Whether to hide the id (primary key) column. */
        hideIdColumn: PropTypes.bool,
        iface: PropTypes.object,
        initialLayer: PropTypes.string,
        layers: PropTypes.array,
        /** Whether to limit to the extent by default. */
        limitToExtent: PropTypes.bool,
        mapBbox: PropTypes.object,
        mapCrs: PropTypes.string,
        mapScales: PropTypes.array,
        readOnly: PropTypes.bool,
        refreshLayer: PropTypes.func,
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
        curFields: null,
        features: [],
        allFeatures: null,
        totFeatureCount: 0,
        selectedFeatures: {},
        hoveredFeature: null,
        changedFeatureIdx: null,
        originalFeatureProps: null,
        pageSize: 50,
        currentPage: 0,
        filterField: "",
        filterOp: "~",
        filterVal: "",
        sortField: null,
        deleteTask: null,
        confirmDelete: false,
        limitToExtent: false,
        captchaResponse: '',
        tableReady: false
    };
    constructor(props) {
        super(props);
        this.changedFiles = {};
        this.state = AttributeTableWidget.defaultState;
        this.table = null;
        this.attribTableContents = null;
        this.state.limitToExtent = props.limitToExtent;
        this.filterWarningShown = false;
        this.pendingTextEdits = new Set();
    }
    componentDidMount() {
        if (this.props.initialLayer) {
            this.reload(this.props.initialLayer, true);
        }
    }
    componentDidUpdate(prevProps, prevState) {
        // Reload conditions when limited to extent
        if (this.state.limitToExtent && this.state.loadedLayer && (!prevState.limitToExtent || this.props.mapBbox !== prevProps.mapBbox)) {
            this.reload(this.state.loadedLayer, true, {currentPage: 0});
        } else if (!this.state.limitToExtent && prevState.limitToExtent) {
            this.reload(this.state.loadedLayer, true, {currentPage: 0});
        }
        // Highlight feature
        if (this.state.features !== prevState.features || this.state.hoveredFeature !== prevState.hoveredFeature || this.state.selectedFeatures !== prevState.selectedFeatures) {
            this.highlightFeatures();
        }
        if (this.state.loadedLayer !== prevState.loadedLayer && this.props.showDisplayFieldOnly) {
            this.setState(state => ({filterField: state.curEditConfig.displayField}));
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
        const readOnly = this.props.readOnly || editPermissions.updatable === false || this.state.confirmDelete;
        const loading = this.state.loading;
        const editing = this.state.changedFeatureIdx !== null;
        const selectionEmpty = isEmpty(this.state.selectedFeatures);
        const showIdColumn = !this.props.showDisplayFieldOnly && !this.props.hideIdColumn;

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
            const primaryKey = curEditConfig.primaryKey;
            table = (
                <FeaturesTable
                    className="attribtable-table"
                    features={this.state.features} fields={this.state.curFields} hideIdColumn={!showIdColumn}
                    hoverChanged={this.setHoveredFeature}
                    onSort={this.sortBy} primaryKey={primaryKey} readOnly={readOnly}
                    renderField={this.renderField}
                    rowIsDisabled={this.rowIsDisabled}
                    selectionChanged={this.setSelectedFeatures}
                />
            );
            const npages = Math.ceil(this.state.totFeatureCount / this.state.pageSize);
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
                    <ComboBox className="attribtable-filter-value" disabled={footbarDisabled} onChange={value => this.updateFilter("filterVal", value)} value={this.state.filterVal}>
                        <div value="">{LocaleUtils.tr("common.select")}</div>
                        {values.map(entry => (
                            <div key={entry.value} value={entry.value}>{entry.label}</div>
                        ))}
                    </ComboBox>
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
                        pageSize={this.state.pageSize} pageSizeChanged={pageSize => this.reload(this.state.selectedLayer, false, {pageSize, currentPage: 0})} />

                    <div className="attribtable-filter controlgroup">
                        <Icon icon="filter" />
                        <ComboBox disabled={footbarDisabled} onChange={value => this.updateFilter("filterField", value)} value={this.state.filterField}>
                            <div disabled value="">{LocaleUtils.tr("common.select")}</div>
                            {showIdColumn ? (
                                <div value="<id>">{this.state.curFields.find(field => field.id === primaryKey).name}</div>
                            ) : null}
                            {this.state.curFields.map(field => {
                                if (field.id !== primaryKey) {
                                    return (<option key={field.id} value={field.id}>{field.name}</option>);
                                }
                                return null;
                            })}
                        </ComboBox>
                        <ComboBox disabled={footbarDisabled} onChange={value => this.updateFilter("filterOp", value)} value={this.state.filterOp}>
                            <div value="~">~</div>
                            <div value="=">=</div>
                            <div value="!=">!=</div>
                            <div value=">">&gt;</div>
                            <div value=">=">&gt;=</div>
                            <div value="<=">&lt;=</div>
                            <div value="<">&lt;</div>
                        </ComboBox>
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
        const showEditButton = (
            !this.props.readOnly && ConfigUtils.havePlugin("Editing") && this.props.showEditFormButton
        ) && !(
            ConfigUtils.getPluginConfig("Editing")?.cfg?.omitReadOnlyDatasets && Object.values(curEditConfig?.permissions || {}).every(permission => permission === false)
        );
        const deleteButton = showDelButton ? (
            <button className="button" disabled={layerChanged || editing || selectionEmpty} onClick={() => this.setState({confirmDelete: true})} title={LocaleUtils.tr("attribtable.deletefeatures")}>
                <Icon icon="trash" />
            </button>
        ) : null;
        let captchaBar = null;
        if (captchaRequired && (editing || this.state.confirmDelete)) {
            captchaBar = (<div><ReCaptchaWidget onChange={value => this.setState({captchaResponse: value})} sitekey={ConfigUtils.getConfigProp("editServiceCaptchaSiteKey")} /></div>);
        }

        const editLayers = Object.entries(this.props.editConfigs).map(([wmsName, serviceConfigs]) => (
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
                return {value: wmsName + "#" + layerName, title: layerTitle};
            })
        )).flat().filter(Boolean).sort((a, b) => a.title.localeCompare(b.title));
        return (
            <div className="AttributeTable">
                <div className="attribtable-toolbar">
                    {this.props.showLayerSelection ? (
                        <ComboBox disabled={loading || editing} onChange={value => this.setState({selectedLayer: value})} value={this.state.selectedLayer || ""}>
                            <div disabled value="">{LocaleUtils.tr("common.selectlayer")}</div>
                            {editLayers.map(entry => (
                                <div key={entry.value} value={entry.value}>{entry.title}</div>
                            ))}
                        </ComboBox>
                    ) : null}
                    <button className="button" disabled={!this.state.selectedLayer || editing || loading} onClick={() => this.reload(this.state.selectedLayer, true)} title={LocaleUtils.tr("attribtable.reload")}>
                        <Icon icon="refresh" />
                    </button>
                    {showAddButton ? (
                        <button className="button" disabled={nolayer || editing || loading || layerChanged} onClick={this.addFeature} title={LocaleUtils.tr("attribtable.addfeature")}>
                            <Icon icon="plus" />
                        </button>
                    ) : null}
                    <button className="button" disabled={layerChanged || selectionEmpty} onClick={this.zoomToSelection} title={LocaleUtils.tr("attribtable.zoomtoselection")}>
                        <Icon icon="search" />
                    </button>
                    {showEditButton ? (
                        <button className="button" disabled={layerChanged || editing || Object.keys(this.state.selectedFeatures).length !== 1} onClick={this.switchToFormEditMode} title={LocaleUtils.tr("attribtable.formeditmode")}>
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
    rowIsDisabled = (idx) => {
        return this.state.changedFeatureIdx !== null && this.state.changedFeatureIdx !== idx;
    };
    setSelectedFeatures = (features) => {
        this.setState({selectedFeatures: features});
    };
    setHoveredFeature = (feature) => {
        this.setState({hoveredFeature: feature});
    };
    renderField = (feature, field, featureidx, rowdisabled) => {
        const editConfig = this.state.curEditConfig;
        const mapPrefix = editConfig.editDataset.split(".")[0];
        const updateField = (fieldid, val, emptynull = false) => this.updateField(featureidx, fieldid, val, emptynull);

        let value = feature.properties[field.id];
        if (value === undefined || value === null) {
            value = "";
        }
        const constraints = field.constraints || {};
        const disabled = constraints.readOnly || rowdisabled;
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
                    editIface={this.props.iface} fieldId={field.id} filterExpr={filterExpr} keyvalrel={constraints.keyvalrel?.replace?.(new RegExp(`^${mapPrefix}\\.`), '')}
                    mapPrefix={mapPrefix} multiSelect={constraints.allowMulti === true} name={field.id} readOnly={constraints.readOnly || disabled}
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
                    onChange={updateTextField} required={constraints.required} value={String(value)} />
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
            const fieldTranslations = this.props.layers.find(layer => layer.wms_name === wmsName)?.translations?.layers?.[layerName]?.fields ?? {};
            const fields = (this.props.showDisplayFieldOnly ? editConfig.fields.filter(
                field => field.name === editConfig.displayField
            ) : editConfig.fields.filter(field => (
                (this.props.showHiddenFields || field.constraints?.hidden !== true)
            ))).map(field => ({
                ...field,
                name: fieldTranslations?.[field.name] ?? field.name
            }));

            if (selectedLayer !== state.loadedLayer) {
                KeyValCache.clear();
                FeatureCache.clear();
                Object.assign(newState, AttributeTableWidget.defaultState);
                newState.limitToExtent = state.limitToExtent;
                newState.curEditConfig = editConfig;
                newState.curFields = fields;
            }
            newState.selectedLayer = selectedLayer;
            newState.selectedFeatures = {};
            newState.tableReady = false;
            this.pendingTextEdits = new Set();

            const options = {
                bbox: newState.limitToExtent ? this.props.mapBbox.bounds : null,
                filter: this.props.filter.filterParams?.[selectedLayer],
                filterGeom: this.props.filter.filterGeom,
                fields: this.props.showDisplayFieldOnly ? [editConfig.displayField, "geometry"] : null
            };
            // If sort or filter field is virtual, query full feature set and sort/filter client side
            const fieldMap = (newState.curEditConfig?.fields || []).reduce((res, field) => ({...res, [field.id]: field}), {});
            const clientSideFilterSort = (newState.filterVal && fieldMap[newState.filterField]?.expression) || fieldMap[newState.sortField?.field]?.expression;

            if (!forceReload && clientSideFilterSort && newState.allFeatures) {
                return {...newState, features: this.filteredSortedFeatures(newState.allFeatures, newState)};
            } else {
                Object.assign(newState, {allFeatures: null, features: []});
                if (clientSideFilterSort) {
                    /* eslint-disable-next-line no-alert */
                    if (!this.filterWarningShown && !forceReload && !confirm(LocaleUtils.tr("attribtable.fulldatasetload"))) {
                        return {};
                    }
                    this.filterWarningShown = true;
                } else {
                    if (this.props.filter.filterParams?.[selectedLayer] && newState.filterVal) {
                        options.filter = [this.props.filter.filterParams?.[selectedLayer], 'and', [newState.filterField, newState.filterOp, newState.filterVal]];
                    } else if (newState.filterVal) {
                        options.filter = [[newState.filterField, newState.filterOp, newState.filterVal]];
                    } else {
                        // NOTE: set offset/limit only when not filtering. Query all filtered features so that they can be highlighted.
                        options.offset = newState.currentPage * newState.pageSize;
                        options.limit = newState.pageSize;
                    }
                    options.sortby = newState.sortField ? ((newState.sortField.dir < 0 ? "-" : "") + newState.sortField.field) : null;
                }
                newState.loading = true;
                this.props.iface.getFeatures(
                    editConfig, this.props.mapCrs, (result) => {
                        if (result) {
                            this.setState({
                                loading: false,
                                allFeatures: clientSideFilterSort ? result.features : null,
                                features: clientSideFilterSort ? this.filteredSortedFeatures(result.features, newState) : result.features,
                                totFeatureCount: result.numberMatched ?? result.features.length,
                                loadedLayer: newState.selectedLayer
                            });
                        } else {
                            // eslint-disable-next-line
                            alert(LocaleUtils.tr("attribtable.loadfailed"));
                            this.setState({loading: false});
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
            const pk = this.state.curEditConfig.primaryKey ?? "id";
            const sortFieldValue = state.sortField.field === pk ? (feature) => feature.id : (feature) => feature.properties[state.sortField.field];
            return filteredFeatures.sort((f1, f2) => {
                const v1 = String(sortFieldValue(f1));
                const v2 = String(sortFieldValue(f2));
                return v1.localeCompare(v2, undefined, {numeric: true, sensitivity: 'base'}) * state.sortField.dir;
            });
        } else {
            return filteredFeatures;
        }
    };
    updateFilter = (stateField, val) => {
        const newState = {filterField: this.state.filterField, filterOp: this.state.filterOp, filterVal: this.state.filterVal};
        newState[stateField] = val;
        // Reset page if a reload is triggered (either filter changed with a set filter value, or filter value cleared)
        if (newState.filterField && (newState.filterVal || (this.state.filterVal && !newState.filterVal))) {
            newState.currentPage = 0;
            this.reload(this.state.selectedLayer, false, newState);
        } else {
            this.setState({[stateField]: val});
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
            this.setState(state => ({
                features: [...state.features, feature],
                changedFeatureIdx: state.features.length,
                filterVal: ""
            }), () => {
                if (this.attribTableContents) {
                    this.attribTableContents.firstElementChild.scrollTop = this.attribTableContents.firstElementChild.scrollHeight;
                }
            });
            this.props.setCurrentTaskBlocked(true, LocaleUtils.tr("editing.unsavedchanged"));
        });
    };
    deleteSelectedFeatured = () => {
        this.setState((state) => {
            const featureIds = Object.keys(state.selectedFeatures);
            featureIds.forEach(featureId => {
                this.props.iface.deleteFeature(state.curEditConfig, featureId, (success) => {
                    this.onFeatureDeleted(featureId, success);
                }, state.captchaResponse);
            });
            return {deleteTask: {
                pending: featureIds,
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
                if (newState.deleteTask.deleted.length >= state.features.length) {
                    newState.currentPage = Math.max(0, state.currentPage - 1);
                }
                newState.deleteTask = null;
                newState.confirmDelete = false;
                reload = true;
            }
            return newState;
        }, () => {
            if (reload) {
                const mapPrefix = this.state.curEditConfig.editDataset.split(".")[0];
                this.props.refreshLayer(layer => layer.wms_name === mapPrefix);
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

        if (!feature.id) {
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
            const mapPrefix = this.state.curEditConfig.editDataset.split(".")[0];
            this.props.refreshLayer(layer => layer.wms_name === mapPrefix);
            this.reload(this.state.loadedLayer, true, {changedFeatureIdx: null, originalFeatureProps: null, newFeature: null});
        }
        this.props.setCurrentTaskBlocked(false);
    };
    discard = () => {
        this.changedFiles = {};
        this.setState((state) => {
            const featureidx = state.changedFeatureIdx;
            const newFeatures = [...state.features];
            if (!newFeatures[featureidx].id) {
                newFeatures.pop();
            } else {
                newFeatures[featureidx] = {...newFeatures[featureidx]};
                newFeatures[featureidx].properties = state.originalFeatureProps;
            }
            return {features: newFeatures, changedFeatureIdx: null, originalFeatureProps: null, newFeature: null};
        });
        this.props.setCurrentTaskBlocked(false);
    };
    highlightFeatures = () => {
        let features = [];
        if (this.state.hoveredFeature) {
            features = [this.state.hoveredFeature];
        } else if (!isEmpty(this.state.selectedFeatures)) {
            features = Object.values(this.state.selectedFeatures);
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
            features: Object.values(this.state.selectedFeatures)
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
        const feature = Object.values(this.state.selectedFeatures)[0];
        this.props.setCurrentTask("Editing", null, null, {layer: this.state.loadedLayer, feature: feature});
    };
    csvExport = () => {
        const formatCsv = (features) => {
            const primaryKey = this.state.curEditConfig.primaryKey ?? "id";
            const fields = this.props.showDisplayFieldOnly ? this.state.curEditConfig.fields.filter(
                field => field.name === this.state.curEditConfig.displayField
            ) : this.state.curEditConfig.fields.filter(field => field.id !== primaryKey);
            let data = "";
            data += primaryKey + "," + fields.map(field => `"${field.name.replaceAll('"', '""')}"`).join(",") + "\n";

            features.forEach(feature => {
                data += feature.id + "," + fields.map(field => {
                    const value = feature.properties[field.id];
                    if (value === null || value === undefined) {
                        return "null";
                    } else {
                        return `"${String(feature.properties[field.id]).replaceAll('"', '""')}"`;
                    }
                }).join(",") + "\n";
            });

            FileSaver.saveAs(new Blob([data], {type: "text/plain;charset=utf-8"}), this.state.loadedLayer.split("#").slice(-1)[0] + ".csv");
        };

        // Use full-table-load if available
        if (this.state.allFeatures) {
            formatCsv(this.state.allFeatures);
        } else {
            const state = this.state;
            const options = {
                bbox: state.limitToExtent ? this.props.mapBbox.bounds : null,
                filter: this.props.filter.filterParams?.[state.loadedLayer],
                filterGeom: this.props.filter.filterGeom,
                fields: this.props.showDisplayFieldOnly ? [state.curEditConfig.displayField, "geometry"] : null,
                sortby: state.sortField ? ((state.sortField.dir < 0 ? "-" : "") + state.sortField.field) : null
            };
            if (this.props.filter.filterParams?.[state.loadedLayer] && state.filterVal) {
                options.filter = [this.props.filter.filterParams?.[this.state.loadedLayer], 'and', [state.filterField, state.filterOp, state.filterVal]];
            } else if (state.filterVal) {
                options.filter = [[state.filterField, state.filterOp, state.filterVal]];
            }

            this.setState({loading: true});
            this.props.iface.getFeatures(
                this.state.curEditConfig, this.props.mapCrs, (result) => {
                    if (result) {
                        formatCsv(result.features);
                    } else {
                        // eslint-disable-next-line
                        alert(LocaleUtils.tr("attribtable.loadfailed"));
                    }
                    this.setState({loading: false});
                }, options
            );
        }
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
    refreshLayer: refreshLayer,
    removeLayer: removeLayer,
    setCurrentTask: setCurrentTask,
    setCurrentTaskBlocked: setCurrentTaskBlocked,
    zoomToExtent: zoomToExtent,
    zoomToPoint: zoomToPoint
})(AttributeTableWidget);
