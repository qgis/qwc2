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
import {setFilter} from '../actions/layers';
import SideBar from '../components/SideBar';
import ToggleSwitch from '../components/widgets/ToggleSwitch';
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
 */
class MapFilter extends React.Component {
    static propTypes = {
        setFilter: PropTypes.func,
        /** The side of the application on which to display the sidebar. */
        side: PropTypes.string,
        theme: PropTypes.object
    };
    static defaultProps = {
        predefinedFilters: []
    };
    state = {
        filters: {}
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
            this.setState({filters: filters});
        }
        if (this.state.filters !== prevState.filters) {
            const layerExpressions = {};
            // Recompute filter expressions
            Object.values(this.state.filters).forEach(entry => {
                if (entry.active) {
                    Object.entries(entry.filter).forEach(([layer, expression]) => {
                        const replacedExpr = this.replaceExpressionVariables(expression, entry.values);
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
    render() {
        return (
            <SideBar icon="filter" id="MapFilter" onShow={this.onShow} side={this.props.side}
                title="appmenu.items.MapFilter" width="20em">
                {() => ({
                    body: this.renderBody()
                })}
            </SideBar>
        );
    }
    renderBody = () => {
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
                                    <td>{field.title || LocaleUtils.tr(field.titlemsgid)}</td>
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
    replaceExpressionVariables = (expr, values) => {
        if (expr.length < 3 || (expr.length % 2) === 0 || typeof expr[1] !== 'string') {
            // Invalid expression: array must have at least three and odd number of entries,
            // mid entry must be a string (operator)
            return null;
        }
        const op = expr[1].toLowerCase();
        if (typeof expr[0] === 'string' && typeof expr[2] === 'string') {
            const right = Object.entries(values).reduce((res, [key, value]) => res.replace(`$${key}$`, value), expr[2]);
            return [expr[0], op, right];
        } else {
            // Even indices must be arrays, odd and|or strings
            const isAndOr = (entry) => ["and", "or"].includes(String(entry).toLowerCase());
            const invalid = expr.find((entry, idx) => (idx % 2) === 0 ? !Array.isArray(entry) : !isAndOr(entry));
            if (invalid) {
                return null;
            }
            return expr.map((entry, idx) => (idx % 2) === 0 ? this.replaceExpressionVariables(entry, values) : entry);
        }
    };
}

export default connect((state) => ({
    theme: state.theme.current
}), {
    setFilter: setFilter
})(MapFilter);
