/**
 * Copyright 2026 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import classNames from 'classnames';
import PropTypes from 'prop-types';

import LocaleUtils from '../../utils/LocaleUtils';
import MiscUtils from '../../utils/MiscUtils';
import Icon from '../Icon';

import './style/FeaturesTable.css';


export default class FeaturesTable extends React.PureComponent {
    static propTypes = {
        allowSelect: PropTypes.bool,
        allowSelectAll: PropTypes.bool,
        features: PropTypes.array,
        fields: PropTypes.array,
        hideIdColumn: PropTypes.bool,
        hoverChanged: PropTypes.func,
        onSort: PropTypes.func,
        primaryKey: PropTypes.string,
        readOnly: PropTypes.bool,
        renderField: PropTypes.func,
        rowIsDisabled: PropTypes.func,
        selectionChanged: PropTypes.func,
        style: PropTypes.object
    };
    static defaultProps = {
        allowSelect: true,
        renderField: (feature, field) => feature.properties[field.name],
        primaryKey: "id"
    };
    state = {
        sortField: null,
        sortedFeatures: null,
        selectedFeatures: {}
    };
    constructor(props) {
        super(props);
        this.table = null;
        this.hoveredFeature = null;
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.features !== prevProps.features) {
            this.setState(state => {
                const newState = {};
                if (!this.props.onSort && state.sortField) {
                    newState.sortedFeatures = this.sortedFeatures(state.sortField);
                }
                if (state.selectedFeatures) {
                    const newFeatureIds = new Set([...this.props.features.map(f => f.id)]);
                    newState.selectedFeatures = Object.fromEntries(
                        Object.entries(state.selectedFeatures).filter(([key]) => newFeatureIds.has(key))
                    );
                }
                return newState;
            });
        }
        if (this.state.selectedFeatures !== prevState.selectedFeatures) {
            this.props.selectionChanged?.(this.state.selectedFeatures);
        }
    }
    render() {
        const features = this.state.sortedFeatures ?? this.props.features;
        const fields = this.props.fields.filter(field => field.id !== this.props.primaryKey);
        const pkfield = this.props.fields.find(field => field.id === this.props.primaryKey);
        const showSelColumn = this.props.allowSelect;
        const showIdColumn = !this.props.hideIdColumn;
        const className = classNames({
            "featurestable": true,
            "featurestable-selectable": showSelColumn
        });
        let selectAll = null;
        if (this.props.allowSelectAll) {
            let icon;
            const nSelectedFeatures = Object.keys(this.state.selectedFeatures).length;
            if (nSelectedFeatures === this.props.features.length) {
                icon = "checked";
            } else if (nSelectedFeatures > 0) {
                icon = "tristate";
            } else {
                icon = "unchecked";
            }
            selectAll = (<Icon icon={icon} onClick={this.toggleSelectAll} />);
        }
        return (
            <div className="featurestable-frame">
                <table className={className} ref={el => { this.table = el; }} style={this.props.style}>
                    <thead>
                        <tr>
                            {showSelColumn ? (<th>{selectAll}</th>) : null}
                            {showIdColumn ? (
                                <th onClick={() => this.sortBy(pkfield.name)} onKeyDown={MiscUtils.checkKeyActivate} tabIndex={0} title={pkfield.name}>
                                    <span>
                                        <span className="featurestable-headername">{pkfield.name}</span>
                                        {this.renderSortIndicator(pkfield.name)}
                                        {this.renderColumnResizeHandle(showSelColumn, 'r')}
                                    </span>
                                </th>
                            ) : null}
                            {fields.map((field, idx) => (
                                <th key={field.id} onClick={() => this.sortBy(field.id)} onKeyDown={MiscUtils.checkKeyActivate} tabIndex={0} title={field.name}>
                                    <span>
                                        <span className="featurestable-headername">
                                            {field.name}
                                            {field.expression ? (<Icon icon="epsilon" title={LocaleUtils.tr("attribtable.calculatedfield")} />) : null}
                                        </span>
                                        {this.renderSortIndicator(field.id)}
                                        {idx < fields.length - 1 ? this.renderColumnResizeHandle(idx + showSelColumn + showIdColumn, 'r') : null}
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {features.map((feature, idx) => {
                            const disabled = this.props.readOnly || this.props.rowIsDisabled?.(idx);
                            return (
                                <tr className={disabled && !this.props.readOnly ? "row-disabled" : ""} key={feature.id}
                                    onMouseEnter={() => this.onFeatureHoverIn(feature)}
                                    onMouseLeave={() => this.onFeatureHoverLeave(feature)}
                                >
                                    {showSelColumn ? (
                                        <td>
                                            <span>
                                                {idx > 0 ? this.renderRowResizeHandle(idx, 't') : null}
                                                <Icon icon={feature.id in this.state.selectedFeatures ? "checked" : "unchecked"} onClick={() => this.toggleFeatureSelected(feature)} />
                                                {this.renderRowResizeHandle(idx + 1, 'b')}
                                            </span>
                                        </td>
                                    ) : null}
                                    {showIdColumn ? (
                                        <td>{feature.id}</td>
                                    ) : null}
                                    {fields.map(field => (
                                        <td key={field.id}>
                                            {this.props.renderField(feature, field)}
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    }
    sortBy = (field) => {
        this.setState(state => {
            let sortField = state.sortField;
            if (sortField && sortField.field === field) {
                sortField = {field: field, dir: -sortField.dir};
            } else {
                sortField = {field: field, dir: 1};
            }
            let sortedFeatures = null;
            if (this.props.onSort) {
                this.props.onSort(field);
            } else {
                sortedFeatures = this.sortedFeatures(sortField);
            }
            return {sortField, sortedFeatures};
        });
    };
    renderSortIndicator = (field) => {
        if (this.state.sortField && this.state.sortField.field === field) {
            return (<Icon icon={this.state.sortField.dir > 0 ? "chevron-down" : "chevron-up"} />);
        } else {
            return null;
        }
    };
    renderColumnResizeHandle = (col, pos) => {
        return (
            <span className={"featurestable-" + pos + "draghandle"}
                onPointerDown={(ev) => this.resizeTable(ev, col, true)} />
        );
    };
    renderRowResizeHandle = (row, pos) => {
        return (
            <span className={"featurestable-" + pos + "draghandle"}
                onPointerDown={(ev) => this.resizeTable(ev, row, false)} />
        );
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
                initial: initial,
                newsize: initial
            };
            const contentsEl = element.parentElement.parentElement.parentElement.parentElement;
            const origin = contentsEl.getBoundingClientRect()[resizeCol ? "left" : "top"];
            const resizeLine = document.createElement('div');
            if (resizeCol) {
                resizeLine.className = 'attribtable-resize-line-vert';
                resizeLine.style.left = (resize.anchor - origin + contentsEl.scrollLeft) + "px";
            } else {
                resizeLine.className = 'attribtable-resize-line-horiz';
                resizeLine.style.top = (resize.anchor - origin + contentsEl.scrollTop) + "px";
            }
            contentsEl.appendChild(resizeLine);
            const resizeDo = resizeCol ? (event) => {
                resizeLine.style.left = (event.clientX - origin + contentsEl.scrollLeft) + "px";
                resize.newsize = resize.initial + event.clientX - resize.anchor;
            } : (event) => {
                resizeLine.style.top = (event.clientY - origin + contentsEl.scrollTop) + "px";
                resize.newsize = resize.initial + event.clientY - resize.anchor;
            };
            const eventShield = ev.view.document.createElement("div");
            eventShield.className = '__event_shield';
            ev.view.document.body.appendChild(eventShield);
            ev.view.document.body.classList.add(resizeCol ? 'ewresizing' : 'nsresizing');
            ev.view.addEventListener("pointermove", resizeDo);
            ev.view.addEventListener("pointerup", (event) => {
                event.view.document.body.removeChild(eventShield);
                contentsEl.removeChild(resizeLine);
                event.view.removeEventListener("pointermove", resizeDo);
                event.view.document.body.classList.remove(resizeCol ? 'ewresizing' : 'nsresizing');
                if (resizeCol) {
                    resize.element.style.minWidth = Math.max((resize.newsize), 16) + "px";
                    resize.element.style.width = Math.max((resize.newsize), 16) + "px";
                } else {
                    resize.element.style.height = Math.max((resize.newsize), 16) + "px";
                }
            }, {once: true});
        }
    };
    toggleSelectAll = () => {
        this.setState(state => {
            if (Object.keys(state.selectedFeatures).length > 0) {
                return {selectedFeatures: {}};
            } else {
                return {selectedFeatures: this.props.features.reduce((res, f) => ({...res, [f.id]: f}), {})};
            }
        });
    };
    toggleFeatureSelected = (feature) => {
        this.setState(state => {
            if (feature.id in state.selectedFeatures) {
                // eslint-disable-next-line no-unused-vars
                const {[feature.id]: _, ...selectedFeatures} = state.selectedFeatures;
                return {selectedFeatures};
            } else {
                return {selectedFeatures: {...state.selectedFeatures, [feature.id]: feature}};
            }
        });
    };
    sortedFeatures = (sortField) => {
        const pk = this.props.primaryKey;
        const sortFieldValue = sortField.field === pk ? (f) => f.id : (f) => f.properties[sortField.field];
        return [...this.props.features].sort((f1, f2) => {
            const v1 = String(sortFieldValue(f1));
            const v2 = String(sortFieldValue(f2));
            return v1.localeCompare(v2, undefined, {numeric: true, sensitivity: 'base'}) * sortField.dir;
        });
    };
    onFeatureHoverIn = (feature) => {
        this.hoveredFeature = feature;
        this.props.hoverChanged(feature);
    };
    onFeatureHoverLeave = (feature) => {
        if (this.hoveredFeature === feature) {
            this.hoveredFeature = null;
            this.props.hoverChanged(null);
        }
    };
}
