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
import classNames from 'classnames';
import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';
import {v1 as uuidv1} from 'uuid';

import {LayerRole, setFilter} from '../actions/layers';
import {setPermalinkParameters} from '../actions/localConfig';
import {setCurrentTask} from '../actions/task';
import Icon from '../components/Icon';
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

import './style/MapFilter.css';


/**
 * Allows exporting a selected portion of the map to a variety of formats.
 *
 * You can set predefined filter expressions for a theme item as follows:
 *
 * ```json
 * predefinedFilters: {
 *     id: "<filter_id>",
 *     title: "<filter_title>",
 *     titlemsgid: "<filter_title_msgid>",
 *     filter: {
 *         "<layer>": <data_service_filter_expression>
 *     },
 *     fields: {
 *         id: "<value_id>",
 *         title: "<value_title">,
 *         titlemsgid: "<value_title_msgid>",
 *         defaultValue: <default_value>,
 *         inputConfig: {<input_field_opts>}
 *     }
 * }
 * ```
 *
 * The data service filter expressions are of the form `["<name>", "<op>", <value>]`, you can also specify complex expressions concatenated with `and|or` as follows:
 *
 * ```json
 * [["<name>", "<op>", <value>],"and|or",["<name>","<op>",<value>],...]
 * ```
 *
 * You can set the startup filter configuration by specifying a `f` URL-parameter with a JSON-serialized string as follows:
 *
 * ```
 * f={"<filter_id>": {"<field_id>": <value>, ...}, ...}
 * ```
 *
 * To control the temporal filter, the filter ID is `__timefilter`, and the field IDs are `tmin` and `tmax`, with values an ISO date or datetime string (`YYYY-MM-DD` or `YYYY-MM-DDTHH:MM:SS`).
 *
 * To control the spatial filter, the syntax is `"__geomfilter": <GeoJSON polygon coodinates array>`.
 *
 * To specify custom filters, the syntax is `"__custom": [{"title": "<title>", "layer": "<layername>", "expr": <JSON filter expr>}, ...]`.
 *
 * Whenever an startup filter value is specified, the filter is automatically enabled.
 *
 * *Note*: When specifying `f`, you should also specify `t` as the startup filter configuraiton needs to match the filters of the desired theme.
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
        layers: PropTypes.array,
        mapMargins: PropTypes.object,
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
        predefinedFilters: []
    };
    state = {
        filters: {},
        geomFilter: {},
        customFilters: {},
        filterEditor: null,
        filterInvalid: false
    };
    componentDidUpdate(prevProps, prevState) {
        if (this.props.theme !== prevProps.theme) {
            // Initialize filter state
            const filters = (this.props.theme.predefinedFilters || []).reduce((res, filterConfig) => ({
                ...res,
                [filterConfig.id]: {
                    active: false,
                    filter: filterConfig.filter,
                    values: filterConfig.fields.reduce((values, valueConfig) => ({
                        ...values,
                        [valueConfig.id]: valueConfig.defaultValue
                    }), {})
                }
            }), {});
            if (this.props.layers !== prevProps.layers) {
                const timeFilter = {};
                this.props.layers.forEach(layer => this.buildTimeFilter(layer, timeFilter));
                if (!isEmpty(timeFilter) && this.props.allowFilterByTime) {
                    filters.__timefilter = {
                        active: false,
                        filter: timeFilter,
                        values: {tstart: "", tend: ""},
                        defaultValues: {tstart: '1800-01-01', tend: '9999-12-31'}
                    };
                }
            }
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
            this.setState({filters: filters, customFilters: customFilters, geomFilter: geomFilter});
        } else if (this.props.layers !== prevProps.layers) {
            const timeFilter = {};
            this.props.layers.forEach(layer => this.buildTimeFilter(layer, timeFilter));
            if (!isEmpty(timeFilter) && this.props.allowFilterByTime) {
                const newFilters = {...this.state.filters};
                newFilters.__timefilter = {
                    active: newFilters.__timefilter?.active ?? false,
                    filter: timeFilter,
                    values: newFilters.__timefilter?.values ?? {tstart: "", tend: ""},
                    defaultValues: {tstart: '0000-01-01', tend: '9999-12-31'}
                };
            }
        }
        if (this.state.filters !== prevState.filters || this.state.customFilters !== prevState.customFilters || this.state.geomFilter.geom !== prevState.geomFilter.geom) {
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
            this.props.setFilter(layerExpressions, this.state.geomFilter.geom);
            // Validate parameters with test request
            const themeLayer = this.props.layers.find(layer => layer.role === LayerRole.THEME);
            const wmsParams = LayerUtils.buildWMSLayerParams({...themeLayer, filterParams: layerExpressions, filterGeom: this.state.geomFilter.geom}).params;
            const wmsLayers = wmsParams.LAYERS.split(",");
            const reqParams = {
                SERVICE: 'WMS',
                REQUEST: 'GetMap',
                VERSION: '1.3.0',
                CRS: 'EPSG:4326',
                WIDTH: 10,
                HEIGHT: 10,
                BBOX: "-0.5,-0.5,0.5,0.5",
                FILTER: wmsParams.FILTER,
                FILTER_GEOM: wmsParams.FILTER_GEOM,
                LAYERS: Object.keys(layerExpressions).filter(layer => wmsLayers.includes(layer)).join(",")
            };
            axios.get(themeLayer.url, {params: reqParams}).then(() => {
                this.setState({filterInvalid: false});
            }).catch(() => {
                this.setState({filterInvalid: true});
            });
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
        }
    }
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
            const right = this.props.mapMargins.right;
            const bottom = this.props.mapMargins.bottom;
            const style = {
                right: 'calc(1.5em + ' + right + 'px)',
                bottom: 'calc(' + bottom + 'px + ' + (5 + 4 * this.props.position) + 'em)'
            };
            const themeLayer = this.props.layers.find(layer => layer.role === LayerRole.THEME);
            const filterActive = !isEmpty(themeLayer?.filterParams) || !!themeLayer?.filterGeom;
            const classes = classNames({
                "map-button": true,
                "map-button-active": taskActive,
                "map-button-engaged": filterActive && !this.state.filterInvalid,
                "filter-map-button-error": filterActive && this.state.filterInvalid
            });
            const title = LocaleUtils.tr("appmenu.items.MapFilter");
            button = (
                <button className={classes} key="MapFilterButton" onClick={this.filterMapButtonClicked}
                    style={style} title={title}>
                    <Icon icon="filter" />
                </button>
            );
        }
        return [
            button,
            (
                <SideBar icon="filter" id="MapFilter" key="MapFilterSidebar" onHide={this.onSidebarHide} side={this.props.side}
                    title="appmenu.items.MapFilter" width="20em">
                    {() => ({
                        body: this.renderBody()
                    })}
                </SideBar>
            ),
            this.state.geomFilter.picking ? (
                <PickFeature featureFilter={feature => feature?.geometry?.type === "Polygon"} featurePicked={this.filterGeomPicked} key="FeaturePicker" />
            ) : null,
            <MapSelection
                active={taskActive && !!this.state.geomFilter?.geomType}
                geomType={this.state.geomFilter?.geomType}
                geometry={this.state.geomFilter?.geom}
                geometryChanged={this.setFilterGeometry}
                key="MapSelection"
                styleOptions={{strokeColor: [0, 0, 0], fillColor: [255, 255, 0, 0.25]}} />
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
            {key: 'Save', icon: 'ok', label: LocaleUtils.trmsg("mapfilter.save"), extraClasses: "button-accept"},
            {key: 'Cancel', icon: 'remove', label: LocaleUtils.trmsg("mapfilter.cancel"), extraClasses: "button-reject"}
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
        return (this.props.theme.predefinedFilters || []).map(config => (
            <div className="map-filter-entry" key={config.id}>
                <div className="map-filter-entry-titlebar">
                    <span className="map-filter-entry-title">{config.title || LocaleUtils.tr(config.titlemsgid)}</span>
                    <ToggleSwitch
                        active={this.state.filters[config.id]?.active}
                        onChange={(active) => this.toggleFilter(config.id, active)} />
                </div>
                <div className="map-filter-entry-body">
                    <table className="map-filter-entry-fields">
                        <tbody>
                            {config.fields.map(field => (
                                <tr key={field.id}>
                                    <td>{field.title || LocaleUtils.tr(field.titlemsgid)}: </td>
                                    <td>
                                        <input
                                            onChange={ev => this.updateFieldValue(config.id, field.id, ev.target.value)}
                                            type="text"
                                            value={this.state.filters[config.id].values[field.id]}
                                            {...field.inputConfig} />
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
            {key: "Polygon", tooltip: LocaleUtils.trmsg("redlining.polygon"), icon: "polygon", label: LocaleUtils.trmsg("redlining.polygon")},
            {key: "Circle", tooltip: LocaleUtils.trmsg("redlining.circle"), icon: "circle", label: LocaleUtils.trmsg("redlining.circle")},
            {key: "Pick", tooltip: LocaleUtils.trmsg("redlining.pick"), icon: "pick", label: LocaleUtils.trmsg("redlining.pick")}
        ];
        const active = geomFilter.picking ? "Pick" : geomFilter.geomType || "";
        return (
            <div className="map-filter-entry" key={"__geomfilter"}>
                <div className="map-filter-entry-titlebar">
                    <span className="map-filter-entry-title">{LocaleUtils.tr("mapfilter.geomfilter")}</span>
                </div>
                <div className="map-filter-entry-body">
                    <ButtonBar active={active} buttons={filterButtons} onClick={this.triggerGeometryFilter} />
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
        this.setState((state) => ({geomFilter: {...state.geomFilter, picking: false, geom: feature.geometry, geomType: feature.geometry.type}}));
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
    mapMargins: state.windows.mapMargins,
    theme: state.theme.current,
    layers: state.layers.flat,
    startupParams: state.localConfig.startupParams
}), {
    setFilter: setFilter,
    setCurrentTask: setCurrentTask,
    setPermalinkParameters: setPermalinkParameters
})(MapFilter);
