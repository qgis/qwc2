/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';
import {createSelector} from 'reselect';

import {addLayerFeatures, LayerRole, removeLayer} from '../actions/layers';
import displayCrsSelector from '../selectors/displaycrs';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import LocaleUtils from '../utils/LocaleUtils';
import VectorLayerUtils from '../utils/VectorLayerUtils';
import Icon from './Icon';
import ResizeableWindow from './ResizeableWindow';
import TextInput from './widgets/TextInput';

import './style/NumericInputWindow.css';


class NumericInputWindow extends React.Component {
    static propTypes = {
        addLayerFeatures: PropTypes.func,
        displayCrs: PropTypes.string,
        feature: PropTypes.object,
        mapCrs: PropTypes.string,
        onClose: PropTypes.func,
        onFeatureChanged: PropTypes.func,
        removeLayer: PropTypes.func
    };
    state = {
        highlightedNode: null,
        displayCrs: null,
        feature: null,
        geometry: null
    };
    componentDidMount() {
        this.componentDidUpdate({});
    }
    componentDidUpdate(prevProps) {
        if (prevProps.feature && this.props.feature !== prevProps.feature) {
            this.props.removeLayer("numericinputselection");
        }
    }
    static getDerivedStateFromProps(nextProps, state) {
        const newState = {feature: nextProps.feature, displayCrs: nextProps.displayCrs};
        if (state.feature && !nextProps.feature) {
            newState.geometry = null;
        } else if (nextProps.feature && (nextProps.feature !== state.feature || nextProps.displayCrs !== state.displayCrs)) {
            newState.geometry = VectorLayerUtils.reprojectGeometry(nextProps.feature.geometry, nextProps.mapCrs, nextProps.displayCrs);
        }
        return newState;
    }
    render() {
        const shapeInputForms = {
            Point: this.renderPointInputForm,
            LineString: this.renderCoordinateListInputForm,
            Polygon: this.renderCoordinateListInputForm,
            Circle: this.renderCircleInputForm,
            Box: this.renderBoxInputForm,
            Square: this.renderBoxInputForm
        };
        let body = null;
        if (!this.state.geometry) {
            body = (<span>{LocaleUtils.tr("numericinput.nofeature")}</span>);
        } else if (shapeInputForms[this.state.feature.shape]) {
            body = shapeInputForms[this.state.feature.shape]();
        } else {
            body = LocaleUtils.tr("numericinput.featureunsupported");
        }

        return (
            <ResizeableWindow icon="numericinput" initialHeight={320} initialWidth={320}
                onClose={this.props.onClose} scrollable title={LocaleUtils.tr("numericinput.windowtitle")} >
                <div className="numeric-input-widget-body" role="body">{body}</div>
            </ResizeableWindow>
        );
    }
    coordinatesChanged = (coordinates) => {
        this.props.onFeatureChanged({
            ...this.state.feature,
            geometry: VectorLayerUtils.reprojectGeometry({
                ...this.state.geometry,
                coordinates: coordinates
            }, this.state.displayCrs, this.props.mapCrs)
        });
    };
    renderOrdinateInput = (ordinate, onChange) => {
        const decimals = CoordinatesUtils.getUnits(this.state.displayCrs) === 'degrees' ? 4 : 0;
        const value = ordinate.toFixed(decimals);
        return (
            <TextInput onChange={(text) => this.onOrdinateChanged(text, onChange)} value={value} />
        );
    };
    onOrdinateChanged = (text, onChange) => {
        const number = parseFloat(text);
        if (!isNaN(number)) {
            onChange(number);
        }
    };
    renderPointInputForm = () => {
        const coordinates = this.state.geometry.coordinates;
        return (
            <table>
                <tbody>
                    <tr>
                        <td>x:&nbsp;</td><td>{this.renderOrdinateInput(coordinates[0], value => this.updatePoint(value, 0))}</td>
                        <td>y:&nbsp;</td><td>{this.renderOrdinateInput(coordinates[1], value => this.updatePoint(value, 1))}</td>
                    </tr>
                </tbody>
            </table>
        );
    };
    updatePoint = (number, ord) => {
        const newCoordinates = [...this.state.geometry.coordinates];
        newCoordinates[ord] = number;
        this.coordinatesChanged(newCoordinates);
    };
    renderCoordinateListInputForm = () => {
        let coordinates = this.state.geometry.coordinates;
        if (this.state.feature.shape === 'Polygon') {
            coordinates = coordinates[0];
        }
        return (
            <table>
                <tbody>
                    {coordinates.map((entry, idx) => (
                        <tr key={"coo" + idx} onMouseEnter={() => this.highlightListCoordinate(idx)} onMouseLeave={() => this.clearListCoordinateHighlight(idx)}>
                            <td><Icon icon="plus" onClick={() => this.insertCoordinate(idx)} /></td>
                            <td>x:&nbsp;</td><td>{this.renderOrdinateInput(coordinates[idx][0], value => this.updateListCoordinate(value, idx, 0))}</td>
                            <td>y:&nbsp;</td><td>{this.renderOrdinateInput(coordinates[idx][1], value => this.updateListCoordinate(value, idx, 1))}</td>
                            <td><Icon icon="trash" onClick={() => this.removeCoordinate(idx)}/></td>
                        </tr>
                    ))}
                    <tr>
                        <td><Icon icon="plus" onClick={() => this.insertCoordinate(coordinates.length)} /></td>
                        <td colSpan="5" />
                    </tr>
                </tbody>
            </table>
        );
    };
    updateListCoordinate = (number, nodeidx, ord) => {
        const newCoordinates = [...this.state.geometry.coordinates];
        let newpoint = null;
        if (this.state.feature.shape === 'Polygon') {
            newCoordinates[0] = [...newCoordinates[0]];
            newCoordinates[0][nodeidx] = [...newCoordinates[0][nodeidx]];
            newCoordinates[0][nodeidx][ord] = number;
            newpoint = newCoordinates[0][nodeidx];
        } else {
            newCoordinates[nodeidx] = [...newCoordinates[nodeidx]];
            newCoordinates[nodeidx][ord] = number;
            newpoint = newCoordinates[nodeidx];
        }
        this.coordinatesChanged(newCoordinates);
        this.highlightListCoordinate(nodeidx, newpoint);
    };
    computeInsPoint = (coordinates, idx) => {
        if (idx === 0) {
            return [...coordinates[0]];
        } else if (idx > coordinates.length - 1) {
            return [...coordinates[coordinates.length - 1]];
        } else {
            return [
                0.5 * (coordinates[idx - 1][0] + coordinates[idx][0]),
                0.5 * (coordinates[idx - 1][1] + coordinates[idx][1])
            ];
        }
    };
    insertCoordinate = (idx) => {
        const newCoordinates = [...this.state.geometry.coordinates];
        if (this.state.feature.shape === 'Polygon') {
            newCoordinates[0] = [...newCoordinates[0]];
            newCoordinates[0].splice(idx, 0, this.computeInsPoint(newCoordinates[0], idx));
        } else {
            newCoordinates.splice(idx, 0, this.computeInsPoint(newCoordinates, idx));
        }
        this.coordinatesChanged(newCoordinates);
        this.props.removeLayer("numericinputselection");
    };
    removeCoordinate = (idx) => {
        const newCoordinates = [...this.state.geometry.coordinates];
        if (this.state.feature.shape === 'Polygon') {
            newCoordinates[0] = [...newCoordinates[0]];
            newCoordinates[0].splice(idx, 1);
        } else {
            newCoordinates.splice(idx, 1);
        }
        this.coordinatesChanged(newCoordinates);
        this.props.removeLayer("numericinputselection");
    };
    highlightListCoordinate = (idx, newpoint = null) => {
        const isPolygon = this.state.feature.shape === 'Polygon';
        const coordinates = this.state.geometry.coordinates;
        const point = CoordinatesUtils.reproject(newpoint || (isPolygon ? coordinates[0][idx] : coordinates[idx]), this.state.displayCrs, this.props.mapCrs);
        this.setState({highlightedNode: idx});
        const feature = {
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: point
            }
        };
        const sellayer = {
            id: "numericinputselection",
            role: LayerRole.SELECTION
        };
        this.props.addLayerFeatures(sellayer, [feature], true);
    };
    clearListCoordinateHighlight = (idx) => {
        if (this.state.highlightedNode === idx) {
            this.setState({highlightedNode: null});
            this.props.removeLayer("numericinputselection");
        }
    };
    renderCircleInputForm = () => {
        const circleParams = this.state.feature.circleParams;
        const center = CoordinatesUtils.reproject(circleParams.center, this.props.mapCrs, this.state.displayCrs);
        return (
            <table>
                <tbody>
                    <tr>
                        <td>x:&nbsp;</td><td>{this.renderOrdinateInput(center[0], value => this.updateCircle(value, center[1], circleParams.radius))}</td>
                    </tr>
                    <tr>
                        <td>y:&nbsp;</td><td>{this.renderOrdinateInput(center[1], value => this.updateCircle(center[0], value, circleParams.radius))}</td>
                    </tr>
                    <tr>
                        <td>r:&nbsp;</td><td>{this.renderOrdinateInput(circleParams.radius, value => this.updateCircle(center[0], center[1], value))}</td>
                    </tr>
                </tbody>
            </table>
        );
    };
    updateCircle = (x, y, r) => {
        const center = CoordinatesUtils.reproject([x, y], this.state.displayCrs, this.props.mapCrs);
        const newFeature = {
            ...this.state.feature,
            circleParams: {
                center: center,
                radius: r
            }
        };
        this.props.onFeatureChanged(newFeature);
    };
    renderBoxInputForm = () => {
        const shape = this.state.feature.shape;
        const coordinates = this.state.geometry.coordinates[0];
        const x = 0.5 * (coordinates[0][0] + coordinates[2][0]);
        const y = 0.5 * (coordinates[0][1] + coordinates[2][1]);
        const d1x = Math.abs(coordinates[1][0] - coordinates[0][0]);
        const d1y = Math.abs(coordinates[1][1] - coordinates[0][1]);
        const w = Math.sqrt(d1x * d1x + d1y * d1y);
        const r = Math.atan2(d1y / w, d1x / w) / Math.PI * 180;

        let d2x = 0;
        let d2y = 0;
        let h = w;
        if (shape === "Box") {
            d2x = Math.abs(coordinates[2][0] - coordinates[1][0]);
            d2y = Math.abs(coordinates[2][1] - coordinates[1][1]);
            h = Math.sqrt(d2x * d2x + d2y * d2y);
        }
        return (
            <table>
                <tbody>
                    <tr>
                        <td>x:&nbsp;</td><td>{this.renderOrdinateInput(x, value => this.updateBox(value, y, w, h, r))}</td>
                    </tr>
                    <tr>
                        <td>y:&nbsp;</td><td>{this.renderOrdinateInput(y, value => this.updateBox(x, value, w, h, r))}</td>
                    </tr>
                    {shape === "Box" ? [(
                        <tr key="w">
                            <td>{LocaleUtils.tr("numericinput.width")}:&nbsp;</td><td>{this.renderOrdinateInput(w, value => this.updateBox(x, y, value, h, r))}</td>
                        </tr>
                    ), (
                        <tr key="h">
                            <td>{LocaleUtils.tr("numericinput.height")}:&nbsp;</td><td>{this.renderOrdinateInput(h, value => this.updateBox(x, y, w, value, r))}</td>
                        </tr>
                    )] : (
                        <tr>
                            <td>{LocaleUtils.tr("numericinput.side")}:&nbsp;</td><td>{this.renderOrdinateInput(w, value => this.updateBox(x, y, value, value, r))}</td>
                        </tr>
                    )}
                    <tr>
                        <td>{LocaleUtils.tr("numericinput.angle")}:&nbsp;</td><td>{this.renderOrdinateInput(r, value => this.updateBox(x, y, w, h, value))}</td>
                    </tr>
                </tbody>
            </table>
        );
    };
    updateBox = (x, y, w, h, r) => {
        const alpha = r / 180 * Math.PI;
        const w2 = 0.5 * w;
        const h2 = 0.5 * h;
        const cosa = Math.cos(alpha);
        const sina = Math.sin(alpha);
        const newCoordinates = [[
            [x + cosa * w2 - sina * h2, y + sina * w2 + cosa * h2],
            [x - cosa * w2 - sina * h2, y - sina * w2 + cosa * h2],
            [x - cosa * w2 + sina * h2, y - sina * w2 - cosa * h2],
            [x + cosa * w2 + sina * h2, y + sina * w2 - cosa * h2],
            [x + cosa * w2 - sina * h2, y + sina * w2 + cosa * h2]
        ]];
        this.coordinatesChanged(newCoordinates);
    };
}

const selector = createSelector([state => state, displayCrsSelector], (state, displaycrs) => ({
    displayCrs: displaycrs,
    mapCrs: state.map.projection
}));

export default connect(selector, {
    addLayerFeatures: addLayerFeatures,
    removeLayer: removeLayer
})(NumericInputWindow);
