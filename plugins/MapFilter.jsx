/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import axios from 'axios';
import isEmpty from 'lodash.isempty';
import isEqual from 'lodash.isequal';
import PropTypes from 'prop-types';
import {v1 as uuidv1} from 'uuid';

import {LayerRole, setFilter} from '../actions/layers';
import {setPermalinkParameters} from '../actions/localConfig';
import {setCurrentTask} from '../actions/task';
import Icon from '../components/Icon';
import MapButton from '../components/MapButton';
import MapSelection from '../components/MapSelection';
import PickFeature from '../components/PickFeature';
import SideBar from '../components/SideBar';
import ButtonBar from '../components/widgets/ButtonBar';
import ComboBox from '../components/widgets/ComboBox';
import DateTimeInput from '../components/widgets/DateTimeInput';
import TextInput from '../components/widgets/TextInput';
import ToggleSwitch from '../components/widgets/ToggleSwitch';
import ConfigUtils from '../utils/ConfigUtils';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MiscUtils from '../utils/MiscUtils';

import './style/MapFilter.css';


/**
 * Allows filtering the map content via QGIS Server WMS FILTER.
 *
 * See [Map filtering](../../topics/MapFilter).
 */
class MapFilter extends React.Component {
    static propTypes = {
        /** Whether to allow custom filters. */
        allowCustomFilters: PropTypes.bool,
        /** Whether to allow filter by geometry. Requires the filter_geom plugin from qwc-qgis-server-plugins, and the filter will only be applied to postgis layers. */
        allowFilterByGeom: PropTypes.bool,
        /** Whether to display the temporal filter if temporal dimensions are found. */
        allowFilterByTime: PropTypes.bool,
        currentTask: PropTypes.string,
        filter: PropTypes.object,
        /** The style used for highlighting filter geometries. */
        highlightStyle: PropTypes.shape({
            /* Stroke color rgba array, i.e. [255, 0, 0, 0.5] */
            strokeColor: PropTypes.array,
            /* Stroke width */
            strokeWidth: PropTypes.number,
            /* Stroke dash/gap pattern array. Empty for solid line. */
            strokeDash: PropTypes.array,
            /* Fill color rgba array, i.e. [255, 0, 0, 0.33] */
            fillColor: PropTypes.array
        }),
        layers: PropTypes.array,
        /** The position slot index of the map button, from the bottom (0: bottom slot). Set to -1 to hide the button. */
        position: PropTypes.number,
        setCurrentTask: PropTypes.func,
        setFilter: PropTypes.func,
        setPermalinkParameters: PropTypes.func,
        /** The side of the application on which to display the sidebar. */
        side: PropTypes.string,
        startupParams: PropTypes.object,
        theme: PropTypes.object
    };
    static defaultProps = {
        allowFilterByTime: true,
        position: 5,
        predefinedFilters: [],
        highlightStyle: {
            strokeColor: [0, 0, 0],
            fillColor: [255, 255, 0, 0.25]
        }
    };
    state = {
        filters: {},
        geomFilter: {},
        customFilters: {},
        filterEditor: null,
        filterInvalid: false
    };
    constructor(props) {
        super(props);
        this.applyFilterTimeout = null;
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.theme !== prevProps.theme) {
            // Initialize filter state
            const predefinedFilters = this.collectPredefinedFilters(this.props.layers);
            const filters = this.initializeFilters(predefinedFilters, {});

            let geomFilter = {};
            let customFilters = {};
            if (!prevProps.theme && this.props.startupParams?.f) {
                try {
                    const startupConfig = JSON.parse(this.props.startupParams.f);
                    Object.entries(startupConfig).forEach(([filterId, values]) => {
                        if (filterId in filters) {
                            filters[filterId].active = true;
                            Object.entries(values).forEach(([fieldId, value]) => {
                                filters[filterId].values[fieldId] = value;
                            });
                        }
                    });
                    if ("__geomfilter" in startupConfig) {
                        geomFilter = {
                            geomType: "Polygon",
                            geom: {type: "Polygon", coordinates: startupConfig.__geomfilter}
                        };
                    }
                    if ("__custom" in startupConfig) {
                        customFilters = startupConfig.__custom.reduce((res, entry) => ({...res, [uuidv1()]: {
                            title: entry.title || "", layer: entry.layer, expr: JSON.stringify(entry.expr), active: true
                        }}), {});
                    }
                } catch (e) {
                    /* eslint-disable-next-line */
                    console.log("Error while parsing startup filter")
                }
            }
            this.setState({filters, geomFilter, customFilters});
        } else if (this.props.layers !== prevProps.layers) {
            const predefinedFilters = this.collectPredefinedFilters(this.props.layers);
            const prevPredefinedFilters = this.collectPredefinedFilters(prevProps.layers);
            if (!isEqual(Object.keys(predefinedFilters).sort(), Object.keys(prevPredefinedFilters).sort())) {
                this.setState(state => ({filters: this.initializeFilters(predefinedFilters, state.filters)}));
            }
        }
        if (this.state.filters !== prevState.filters || this.state.customFilters !== prevState.customFilters || this.state.geomFilter.geom !== prevState.geomFilter.geom) {
            clearTimeout(this.applyFilterTimeout);
            this.applyFilterTimeout = setTimeout(this.applyFilter, 500);
        }
    }
    collectPredefinedFilters = (layers) => {
        return layers.reduce((res, layer) => (
            {...res, ...(layer.predefinedFilters || []).reduce((res2, config) => ({...res2, [config.id]: config}), {})}
        ), {});
    };
    initializeFilters = (predefinedFilters, prevFilters) => {
        clearTimeout(this.applyFilterTimeout);
        this.applyFilterTimeout = null;

        const filters = Object.values(predefinedFilters).reduce((res, filterConfig) => ({
            ...res,
            [filterConfig.id]: prevFilters?.[filterConfig.id] ?? {
                active: false,
                filter: filterConfig.filter,
                values: filterConfig.fields.reduce((values, valueConfig) => ({
                    ...values,
                    [valueConfig.id]: valueConfig.defaultValue
                }), {})
            }
        }), {});
        const timeFilter = {};
        this.props.layers.forEach(layer => this.buildTimeFilter(layer, timeFilter));
        if (!isEmpty(timeFilter) && this.props.allowFilterByTime) {
            filters.__timefilter = {
                active: prevFilters.__timefilter?.active ?? false,
                filter: timeFilter,
                values: prevFilters.__timefilter?.values ?? {tstart: "", tend: ""},
                defaultValues: {tstart: '1800-01-01', tend: '9999-12-31'}
            };
        }
        return filters;
    };
    applyFilter = () => {
        this.applyFilterTimeout = null;
        const layerExpressions = {};
        // Recompute filter expressions
        Object.values(this.state.filters).forEach(entry => {
            if (entry.active) {
                Object.entries(entry.filter).forEach(([layer, expression]) => {
                    const replacedExpr = this.replaceExpressionVariables(expression, entry.values, entry.defaultValues || {});
                    if (replacedExpr === null) {
                        /* eslint-disable-next-line */
                        console.warn("Invalid filter expression: " + JSON.stringify(expression));
                    } else if (layerExpressions[layer]) {
                        layerExpressions[layer].push('and', replacedExpr);
                    } else {
                        layerExpressions[layer] = [replacedExpr];
                    }
                });
            }
        }, {});
        Object.values(this.state.customFilters).forEach(entry => {
            if (entry.active && entry.layer) {
                let expr = '';
                try {
                    expr = JSON.parse(entry.expr);
                } catch (e) {
                    return;
                }
                if (layerExpressions[entry.layer]) {
                    layerExpressions[entry.layer].push('and', expr);
                } else {
                    layerExpressions[entry.layer] = [expr];
                }
            }
        });
        const timeRange = this.state.filters.__timefilter?.active ? {
            tstart: this.state.filters.__timefilter.values.tstart,
            tend: this.state.filters.__timefilter.values.tend
        } : null;
        this.props.setFilter(layerExpressions, this.state.geomFilter.geom, timeRange);
        // Validate parameters with test request
        const themeLayer = this.props.layers.find(layer => layer.role === LayerRole.THEME);
        if (themeLayer) {
            const wmsParams = LayerUtils.buildWMSLayerParams(themeLayer, {filterParams: layerExpressions, filterGeom: this.state.geomFilter.geom}).params;
            const wmsLayers = wmsParams.LAYERS.split(",");
            const reqParams = {
                SERVICE: 'WMS',
                REQUEST: 'GetMap',
                VERSION: '1.3.0',
                CRS: 'EPSG:4326',
                WIDTH: 10,
                HEIGHT: 10,
                BBOX: "-0.5,-0.5,0.5,0.5",
                LAYERS: Object.keys(layerExpressions).filter(layer => wmsLayers.includes(layer)).join(","),
                csrf_token: MiscUtils.getCsrfToken()
            };
            if (wmsParams.FILTER) {
                reqParams.FILTER = wmsParams.FILTER;
            }
            if (wmsParams.FILTER_GEOM) {
                reqParams.FILTER_GEOM = wmsParams.FILTER_GEOM;
            }
            const options = {
                headers: {'content-type': 'application/x-www-form-urlencoded'},
                responseType: "blob"
            };
            axios.post(themeLayer.url, new URLSearchParams(reqParams).toString(), options).then(() => {
                this.setState({filterInvalid: false});
            }).catch(() => {
                this.setState({filterInvalid: true});
            });
        }
        const permalinkState = Object.entries(this.state.filters).reduce((res, [key, value]) => {
            if (value.active) {
                return {...res, [key]: value.values};
            } else {
                return res;
            }
        }, {});
        if (this.state.geomFilter.geom) {
            permalinkState.__geomfilter = this.state.geomFilter.geom.coordinates;
        }
        permalinkState.__custom = Object.values(this.state.customFilters).map(entry => {
            if (!entry.active) {
                return null;
            }
            let expr = null;
            try {
                expr = JSON.parse(entry.expr);
            } catch (e) {
                return null;
            }
            return {title: entry.title, layer: entry.layer, expr: expr};
        }).filter(Boolean);
        this.props.setPermalinkParameters({f: JSON.stringify(permalinkState)});
    };
    buildTimeFilter = (layer, filters) => {
        if (layer.sublayers) {
            layer.sublayers.forEach(sublayer => this.buildTimeFilter(sublayer, filters));
        } else {
            const timeDimension = (layer.dimensions || []).find(dimension => dimension.units === "ISO8601");
            if (timeDimension) {
                filters[layer.name] = [
                    [[timeDimension.fieldName, '>=', "$tstart$"], 'or', [timeDimension.fieldName, 'IS', null]],
                    'and',
                    [[timeDimension.endFieldName, '<=', "$tend$"], 'or', [timeDimension.endFieldName, 'IS', null]]
                ];
            }
        }
    };
    render() {
        let button = null;
        const taskActive = this.props.currentTask === "MapFilter";
        if (this.props.position >= 0) {
            const filterActive = !isEmpty(this.props.filter.filterParams) || !!this.props.filter.filterGeom;
            const title = LocaleUtils.tr("appmenu.items.MapFilter");
            const className = filterActive && this.state.filterInvalid ? "filter-map-button-error" : "";
            button = (
                <MapButton
                    active={taskActive}
                    className={className}
                    engaged={filterActive && !this.state.filterInvalid}
                    icon="filter"
                    key="MapFilterButton" onClick={this.filterMapButtonClicked}
                    position={this.props.position}
                    tooltip={title} />
            );
        }
        const selGeomType = this.state.geomFilter?.picking ? null : this.state.geomFilter?.geomType;
        return [
            button,
            (
                <SideBar icon="filter" id="MapFilter" key="MapFilterSidebar" onHide={this.onSidebarHide} side={this.props.side}
                    title={LocaleUtils.tr("appmenu.items.MapFilter")} width="20em">
                    {() => ({
                        body: this.renderBody()
                    })}
                </SideBar>
            ),
            this.state.geomFilter.picking ? (
                <PickFeature featureFilter={feature => (feature?.geometry?.type || "").endsWith("Polygon")} featurePicked={this.filterGeomPicked} highlightStyle={this.props.highlightStyle} key="FeaturePicker" />
            ) : null,
            <MapSelection
                active={taskActive && !!selGeomType}
                geomType={selGeomType}
                geometry={this.state.geomFilter?.geom}
                geometryChanged={this.setFilterGeometry}
                hideGeometry={this.state.geomFilter?.hideFilterGeom}
                key="MapSelection"
                styleOptions={this.props.highlightStyle} />
        ];
    }
    filterMapButtonClicked = () => {
        const mapClickAction = ConfigUtils.getPluginConfig("MapFilter").mapClickAction;
        this.props.setCurrentTask(this.props.currentTask === "MapFilter" ? null : "MapFilter", null, mapClickAction);
    };
    onSidebarHide = () => {
        this.setState(state => {
            const newState = {...state};
            if (!state.geomFilter.geom && state.geomFilter.geomType) {
                newState.geomFilter.geomType = null;
            }
            if (state.geomFilter.picking) {
                newState.geomFilter.picking = false;
            }
            return newState;
        });
    };
    renderBody = () => {
        if (this.state.filterEditor) {
            return this.renderFilterEditor();
        } else {
            return [
                this.renderInvalidWarning(),
                ...this.renderPredefinedFilters(),
                this.props.allowFilterByTime ? this.renderTimeFilter() : null,
                this.props.allowFilterByGeom ? this.renderGeomFilter() : null,
                ...this.renderCustomFilters()
            ];
        }
    };
    renderInvalidWarning = () => {
        if (this.state.filterInvalid) {
            return (
                <div className="map-filter-invalid-warning" key="InvalidFilterWarning">
                    <Icon icon="warning" /> <div>{LocaleUtils.tr("mapfilter.brokenrendering")}</div>
                </div>
            );
        }
        return null;
    };
    renderFilterEditor = () => {
        const commitButtons = [
            {key: 'Save', icon: 'ok', label: LocaleUtils.tr("mapfilter.save"), extraClasses: "button-accept"},
            {key: 'Cancel', icon: 'remove', label: LocaleUtils.tr("mapfilter.cancel"), extraClasses: "button-reject"}
        ];
        const sampleFilters = '["field", "=", "val"]\n' +
                              '[["field", ">", "val1"], "and", ["field", "<", "val2"]]';
        return (
            <div className="map-filter-editor-container">
                <TextInput
                    className={"map-filter-editor " + (this.state.filterEditor.invalid ? "map-filter-editor-invalid" : "")} multiline
                    onChange={value => this.setState(state => ({filterEditor: {...state.filterEditor, value, invalid: false}}))}
                    placeholder={sampleFilters} value={this.state.filterEditor.value} />
                {this.state.filterEditor.invalid ? (
                    <div>
                        <Icon icon="warning" /> <span>{LocaleUtils.tr("mapfilter.invalidfilter")}</span>
                    </div>
                ) : null}
                <ButtonBar buttons={commitButtons} onClick={this.commitFilterEditor}/>
            </div>
        );
    };
    commitFilterEditor = (action) => {
        if (action === 'Save') {
            // Validate expression
            const validateExpression = (values) => {
                if (Array.isArray(values[0])) {
                    // Even entries must be arrays, odd entries must be 'and' or 'or'
                    return values.every((value, idx) => {
                        return idx % 2 === 0 ? (Array.isArray(value) && validateExpression(value)) : ["and", "or"].includes(value.toLowerCase());
                    }, true);
                } else {
                    return values.length === 3 && typeof values[0] === 'string' && typeof values[1] === 'string' && ['string', 'number'].includes(typeof values[2]);
                }
            };
            let filterexpr = null;
            try {
                filterexpr = JSON.parse(this.state.filterEditor.value);
            } catch (e) {
                // Pass
            }
            if (!Array.isArray(filterexpr) || !validateExpression(filterexpr)) {
                this.setState(state => ({filterEditor: {...state.filterEditor, invalid: true}}));
                return;
            }
            this.updateCustomFilter(this.state.filterEditor.filterId, 'expr', this.state.filterEditor.value);
        }
        this.setState({filterEditor: null});
    };
    renderPredefinedFilters = () => {
        const predefinedFilters = this.collectPredefinedFilters(this.props.layers);
        return Object.values(predefinedFilters).map(config => (
            <div className="map-filter-entry" key={config.id}>
                <div className="map-filter-entry-titlebar">
                    <span className="map-filter-entry-title">{config.title ?? LocaleUtils.tr(config.titlemsgid)}</span>
                    <ToggleSwitch
                        active={this.state.filters[config.id]?.active}
                        onChange={(active) => this.toggleFilter(config.id, active)} />
                </div>
                <div className="map-filter-entry-body">
                    <table className="map-filter-entry-fields">
                        <tbody>
                            {config.fields.map(field => (
                                <tr key={field.id}>
                                    <td>{field.title ?? LocaleUtils.tr(field.titlemsgid)}: </td>
                                    <td>
                                        {
                                            field.inputConfig.type === 'select' ? (
                                                <select
                                                    onChange={ev => this.updateFieldValue(config.id, field.id, ev.target.value)}
                                                    value={this.state.filters[config.id].values[field.id]}
                                                >
                                                    {!field.defaultValue ? (
                                                        <option value="">{LocaleUtils.tr("mapfilter.select")}</option>
                                                    ) : null}
                                                    {field.inputConfig.options.map(entry => (
                                                        <option key={entry.value ?? entry} value={entry.value ?? entry}>{entry.label ?? (entry.labelmsgid ? LocaleUtils.tr(entry.labelmsgid) : entry)}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input
                                                    onChange={ev => this.updateFieldValue(config.id, field.id, ev.target.value)}
                                                    type="text"
                                                    value={this.state.filters[config.id].values[field.id] || ""}
                                                    {...field.inputConfig} />
                                            )
                                        }
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        ));
    };
    renderTimeFilter = () => {
        const timeFilter = this.state.filters.__timefilter;
        if (!timeFilter) {
            return null;
        }
        return (
            <div className="map-filter-entry" key={"__timefilter"}>
                <div className="map-filter-entry-titlebar">
                    <span className="map-filter-entry-title">{LocaleUtils.tr("mapfilter.timefilter")}</span>
                    <ToggleSwitch
                        active={timeFilter.active}
                        onChange={(active) => this.toggleFilter("__timefilter", active)} />
                </div>
                <div className="map-filter-entry-body">
                    <table className="map-filter-entry-fields">
                        <tbody>
                            <tr>
                                <td>{LocaleUtils.tr("mapfilter.timefrom")}: </td>
                                <td><DateTimeInput onChange={value => this.updateFieldValue("__timefilter", "tstart", value)} value={timeFilter.values.tstart} /></td>
                            </tr>
                            <tr>
                                <td>{LocaleUtils.tr("mapfilter.timeto")}: </td>
                                <td><DateTimeInput onChange={value => this.updateFieldValue("__timefilter", "tend", value)} value={timeFilter.values.tend} /></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };
    renderCustomFilters = () => {
        if (!this.props.allowCustomFilters) {
            return [];
        }
        const layerNames = this.props.layers.reduce((res, layer) => {
            if (layer.role === LayerRole.THEME) {
                return [...res, ...LayerUtils.getSublayerNames(layer, true, lyr => !!lyr.geometryType)];
            }
            return res;
        }, []);
        const customFilters = Object.entries(this.state.customFilters).map(([key, entry]) => (
            <div className="map-filter-entry" key={key}>
                <div className="map-filter-entry-titlebar map-filter-custom-entry-titlebar">
                    <TextInput  className="map-filter-entry-title" onChange={value => this.updateCustomFilter(key, 'title', value)} value={entry.title} />
                    <ToggleSwitch
                        active={entry.active}
                        onChange={(active) => this.updateCustomFilter(key, 'active',  active)} />
                    <Icon icon="trash" onClick={() => this.deleteCustomFilter(key)} />
                </div>
                <div className="map-filter-entry-body">
                    <table className="map-filter-entry-fields">
                        <tbody>
                            <tr>
                                <td>
                                    <ComboBox onChange={value => this.updateCustomFilter(key, 'layer', value)} placeholder={LocaleUtils.tr("mapfilter.selectlayer")} value={entry.layer}>
                                        {layerNames.map(layerName => (<div key={layerName} value={layerName}>{layerName}</div>))}
                                    </ComboBox>
                                </td>
                                <td>
                                    <input className="map-filter-custom-entry-expr" onChange={() => {}} onClick={() => this.setState({filterEditor: {filterId: key, value: entry.expr}})} readOnly value={entry.expr} />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        ));
        return [
            ...customFilters,
            (
                <div className="map-filter-add-custom" key="addcustomfilter">
                    <button className="button" onClick={this.addCustomFilter} type="button">{LocaleUtils.tr("mapfilter.addcustomfilter")}</button>
                </div>
            )
        ];
    };
    renderGeomFilter = () => {
        const geomFilter = this.state.geomFilter;
        const filterButtons = [
            {key: "Polygon", tooltip: LocaleUtils.tr("redlining.polygon"), icon: "polygon", label: LocaleUtils.tr("redlining.polygon")},
            {key: "Circle", tooltip: LocaleUtils.tr("redlining.circle"), icon: "circle", label: LocaleUtils.tr("redlining.circle")},
            {key: "Pick", tooltip: LocaleUtils.tr("redlining.pick"), icon: "pick", label: LocaleUtils.tr("redlining.pick")}
        ];
        const active = geomFilter.picking ? "Pick" : geomFilter.geomType || "";
        return (
            <div className="map-filter-entry" key={"__geomfilter"}>
                <div className="map-filter-entry-titlebar">
                    <span className="map-filter-entry-title">{LocaleUtils.tr("mapfilter.geomfilter")}</span>
                </div>
                <div className="map-filter-entry-body">
                    <ButtonBar active={active} buttons={filterButtons} onClick={this.triggerGeometryFilter} />
                    <div>
                        <label><input checked={!!geomFilter.hideFilterGeom} onChange={this.toggleHideFilterGeom} type="checkbox" /> {LocaleUtils.tr("mapfilter.hidefiltergeom")}</label>
                    </div>
                </div>
            </div>
        );
    };
    triggerGeometryFilter = (action) => {
        if (action === 'Pick') {
            this.setState((state) => ({geomFilter: {...state.geomFilter, geom: null, picking: !state.geomFilter.picking, geomType: null}}));
        } else {
            this.setState((state) => ({geomFilter: {...state.geomFilter, geom: null, picking: false, geomType: state.geomFilter.geomType === action ? null : action}}));
        }
    };
    setFilterGeometry = (geom) => {
        this.setState((state) => ({geomFilter: {...state.geomFilter, geom: geom}}));
    };
    filterGeomPicked = (layer, feature) => {
        this.setState((state) => ({geomFilter: {...state.geomFilter, geom: feature.geometry, geomType: feature.geometry.type}}));
    };
    toggleHideFilterGeom = (ev) => {
        this.setState((state) => ({geomFilter: {...state.geomFilter, hideFilterGeom: ev.target.checked}}));
    };
    toggleFilter = (filterId, active) => {
        this.setState((state) => ({
            filters: {
                ...state.filters,
                [filterId]: {
                    ...state.filters[filterId],
                    active: active
                }
            }
        }));
    };
    updateFieldValue = (filterId, fieldId, value) => {
        this.setState((state) => ({
            filters: {
                ...state.filters,
                [filterId]: {
                    ...state.filters[filterId],
                    values: {
                        ...state.filters[filterId].values,
                        [fieldId]: value
                    }
                }
            }
        }));
    };
    updateCustomFilter = (filterId, key, value) => {
        this.setState((state) => ({
            customFilters: {
                ...state.customFilters,
                [filterId]: {
                    ...state.customFilters[filterId],
                    [key]: value
                }
            }
        }));
    };
    addCustomFilter = () => {
        const key = uuidv1();
        this.setState((state) => ({
            customFilters: {
                ...state.customFilters,
                [key]: {
                    active: false,
                    title: '',
                    layer: '',
                    expr: ''
                }
            }
        }));
    };
    deleteCustomFilter = (key) => {
        this.setState((state) => {
            const newCustomFilters = {...state.customFilters};
            delete newCustomFilters[key];
            return {customFilters: newCustomFilters};
        });
    };
    replaceExpressionVariables = (expr, values, defaultValues) => {
        if (expr.length < 3 || (expr.length % 2) === 0 || typeof expr[1] !== 'string') {
            // Invalid expression: array must have at least three and odd number of entries,
            // mid entry must be a string (operator)
            return null;
        }
        const op = expr[1].toLowerCase();
        if (typeof expr[0] === 'string') {
            if (typeof expr[2] === 'string') {
                const right = Object.entries(values).reduce((res, [key, value]) => res.replace(`$${key}$`, (value || defaultValues[key]) ?? value), expr[2]);
                return [expr[0], op, right];
            } else {
                return [expr[0], op, expr[2]];
            }
        } else {
            // Even indices must be arrays, odd and|or strings
            const isAndOr = (entry) => ["and", "or"].includes(String(entry).toLowerCase());
            const invalid = expr.find((entry, idx) => (idx % 2) === 0 ? !Array.isArray(entry) : !isAndOr(entry));
            if (invalid) {
                return null;
            }
            return expr.map((entry, idx) => (idx % 2) === 0 ? this.replaceExpressionVariables(entry, values, defaultValues) : entry);
        }
    };
}

export default connect((state) => ({
    currentTask: state.task.id,
    theme: state.theme.current,
    layers: state.layers.flat,
    filter: state.layers.filter,
    startupParams: state.localConfig.startupParams
}), {
    setFilter: setFilter,
    setCurrentTask: setCurrentTask,
    setPermalinkParameters: setPermalinkParameters
})(MapFilter);
