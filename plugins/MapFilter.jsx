/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import classNames from 'classnames';
import isEmpty from 'lodash.isempty';
import {LayerRole, setFilter} from '../actions/layers';
import {setCurrentTask} from '../actions/task';
import Icon from '../components/Icon';
import SideBar from '../components/SideBar';
import DateTimeInput from '../components/widgets/DateTimeInput';
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
 *         "<layer>": <data_service_expression>
 *     },
 *     fields: {
 *         id: "<value_id>",
 *         title: "<value_title">,
 *         titlemsgid: "<value_title_msgid">",
 *         defaultValue: <default_value>,
 *         inputConfig: {<input_field_opts>}
 *     }
 * }
 * ```
 * You can set the startup filter configuration by specifying a `f` URL-parameter with a JSON-serialized string as follows:
 *
 * ```
 * f={"<filter_id>": {"<field_id>": <value>, ...}, ...}
 * ```
 * Whenever an startup filter value is specified, the filter is automatically enabled.
 *
 * *Note*: When specifying `f`, you should also specify `t` as the startup filter configuraiton needs to match the filters of the desired theme.
 */
class MapFilter extends React.Component {
    static propTypes = {
        allowFilterByTime: PropTypes.bool,
        currentTask: PropTypes.string,
        layers: PropTypes.array,
        mapMargins: PropTypes.object,
        /** The position slot index of the map button, from the bottom (0: bottom slot). Set to -1 to hide the button. */
        position: PropTypes.number,
        setCurrentTask: PropTypes.func,
        setFilter: PropTypes.func,
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
        timeFilter: null
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
            if (!prevProps.theme && this.props.startupParams?.f) {
                try {
                    const startupConfig = JSON.parse(this.props.startupParams.f);
                    Object.entries(startupConfig).forEach(([filterId, values]) => {
                        filters[filterId].active = true;
                        Object.entries(values).forEach(([fieldId, value]) => {
                            filters[filterId].values[fieldId] = value;
                        });
                    });
                } catch (e) {
                    // Pass
                }
            }
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
            this.setState({filters: filters});
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
        if (this.state.filters !== prevState.filters) {
            const layerExpressions = {};
            // Recompute filter expressions
            Object.values(this.state.filters).forEach(entry => {
                if (entry.active) {
                    Object.entries(entry.filter).forEach(([layer, expression]) => {
                        const replacedExpr = this.replaceExpressionVariables(expression, entry.values, entry.defaultValues || {});
                        if (replacedExpr === null) {
                            console.warn("Invalid filter expression: " + JSON.stringify(expression));
                        } else if (layerExpressions[layer]) {
                            layerExpressions[layer].push('and', replacedExpr);
                        } else {
                            layerExpressions[layer] = [replacedExpr];
                        }
                    });
                }
            }, {});
            this.props.setFilter(layerExpressions);
        }
    }
    buildTimeFilter = (layer, filters) => {
        if (layer.sublayers) {
            layer.sublayers.forEach(sublayer => this.buildTimeFilter(sublayer, filters));
        } else {
            const timeDimension = (layer.dimensions || []).find(dimension => dimension.units === "ISO8601");
            if (timeDimension) {
                filters[layer.name] = [
                    [[timeDimension.fieldName, '>=', "'$tstart$'"], 'or', [timeDimension.fieldName, 'IS', 'NULL']],
                    'and',
                    [[timeDimension.endFieldName, '<=', "'$tend$'"], 'or', [timeDimension.endFieldName, 'IS', "NULL"]]
                ];
            }
        }
    };
    render() {
        let button = null;
        if (this.props.position >= 0) {
            const right = this.props.mapMargins.right;
            const bottom = this.props.mapMargins.bottom;
            const style = {
                right: 'calc(1.5em + ' + right + 'px)',
                bottom: 'calc(' + bottom + 'px + ' + (5 + 4 * this.props.position) + 'em)'
            };
            const haveFilter = !isEmpty(this.props.layers.find(layer => layer.role === LayerRole.THEME)?.filterParams);
            const classes = classNames({
                "map-button": true,
                "map-button-active": this.props.currentTask === "MapFilter",
                "map-button-engaged": haveFilter
            });
            const title = LocaleUtils.tr("appmenu.items.MapFilter");
            button = (
                <button className={classes} key="MapFilterButton" onClick={this.buttonClicked}
                    style={style} title={title}>
                    <Icon icon="filter" />
                </button>
            );
        }
        return [
            button,
            (
                <SideBar icon="filter" id="MapFilter" key="MapFilterSidebar" onShow={this.onShow} side={this.props.side}
                    title="appmenu.items.MapFilter" width="20em">
                    {() => ({
                        body: this.renderBody()
                    })}
                </SideBar>
            )
        ];
    }
    buttonClicked = () => {
        const mapClickAction = ConfigUtils.getPluginConfig("MapFilter").mapClickAction;
        this.props.setCurrentTask(this.props.currentTask === "MapFilter" ? null : "MapFilter", null, mapClickAction);
    };
    renderBody = () => {
        return [
            ...this.renderPredefinedFilters(),
            this.renderTimeFilter()
        ];
    };
    renderPredefinedFilters = () => {
        return (this.props.theme.predefinedFilters || []).map(config => (
            <div className="map-filter-entry" key={config.id}>
                <div className="map-filter-entry-title">
                    <span>{config.title || LocaleUtils.tr(config.titlemsgid)}</span>
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
                                            disabled={!this.state.filters[config.id]?.active}
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
                <div className="map-filter-entry-title">
                    <span>{LocaleUtils.tr("mapfilter.timefilter")}</span>
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
    replaceExpressionVariables = (expr, values, defaultValues) => {
        if (expr.length < 3 || (expr.length % 2) === 0 || typeof expr[1] !== 'string') {
            // Invalid expression: array must have at least three and odd number of entries,
            // mid entry must be a string (operator)
            return null;
        }
        const op = expr[1].toLowerCase();
        if (typeof expr[0] === 'string' && typeof expr[2] === 'string') {
            const right = Object.entries(values).reduce((res, [key, value]) => res.replace(`$${key}$`, (value || defaultValues[key]) ?? value), expr[2]);
            return [expr[0], op, right];
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
    setCurrentTask: setCurrentTask
})(MapFilter);
