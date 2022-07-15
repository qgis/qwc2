/**
 * Copyright 2017-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import NumericInput from 'react-numeric-input2';
import Mousetrap from 'mousetrap';
import {changeRedliningState} from '../actions/redlining';
import {LayerRole, addLayer} from '../actions/layers';
import {setSnappingConfig} from '../actions/map';
import TaskBar from '../components/TaskBar';
import ButtonBar from '../components/widgets/ButtonBar';
import ColorButton from '../components/widgets/ColorButton';
import VectorLayerPicker from '../components/widgets/VectorLayerPicker';
import LocaleUtils from '../utils/LocaleUtils';

import './style/Redlining.css';


class Redlining extends React.Component {
    static propTypes = {
        addLayer: PropTypes.func,
        allowGeometryLabels: PropTypes.bool,
        changeRedliningState: PropTypes.func,
        layers: PropTypes.array,
        mobile: PropTypes.bool,
        plugins: PropTypes.object,
        redlining: PropTypes.object,
        setCurrentTask: PropTypes.func,
        setSnappingConfig: PropTypes.func,
        snapping: PropTypes.bool,
        snappingActive: PropTypes.bool
    }
    static defaultProps = {
        allowGeometryLabels: true,
        snapping: true,
        snappingActive: true,
        plugins: []
    }
    state = {
        selectText: false
    }
    constructor(props) {
        super(props);
        this.labelInput = null;
        window.addEventListener('keydown', this.keyPressed);
    }
    componentDidUpdate(prevProps, prevState) {
        if (prevProps.redlining.geomType !== this.props.redlining.geomType && this.props.redlining.geomType === 'Text' && !this.state.selectText) {
            this.setState({selectText: true});
        }
        if (!this.props.layers.find(layer => layer.id === this.props.redlining.layer) && this.props.redlining.layer !== 'redlining') {
            this.props.changeRedliningState({layer: 'redlining', layerTitle: 'Redlining'});
        }
    }
    componentWillUnmount() {
        window.removeEventListener('keydown', this.keyPressed);
    }
    keyPressed = (ev) => {
        if (ev.keyCode === 27) {
            if (this.props.redlining.action === 'Draw' && !this.props.redlining.selectedFeature) {
                this.props.changeRedliningState({action: 'Delete'});
            }
        }
    };
    onShow = (mode) => {
        this.props.changeRedliningState({action: mode || 'Pick', geomType: null});
        this.props.setSnappingConfig(this.props.snapping, this.props.snappingActive);
        Mousetrap.bind('del', this.triggerDelete);
    }
    onHide = () => {
        this.props.changeRedliningState({action: null, geomType: null});
        Mousetrap.unbind('del', this.triggerDelete);
    }
    updateRedliningState = (diff) => {
        const newState = {...this.props.redlining, ...diff};
        this.props.changeRedliningState(newState);
    }
    updateRedliningStyle = (diff) => {
        const newStyle = {...this.props.redlining.style, ...diff};
        this.updateRedliningState({style: newStyle});
    }
    renderBody = () => {
        const activeButton = this.props.redlining.action === "Draw" ? this.props.redlining.geomType : this.props.redlining.action;
        const drawButtons = [
            {key: "Point", tooltip: LocaleUtils.trmsg("redlining.point"), icon: "point", data: {action: "Draw", geomType: "Point", text: ""}},
            {key: "LineString", tooltip: LocaleUtils.trmsg("redlining.line"), icon: "line", data: {action: "Draw", geomType: "LineString", text: ""}},
            {key: "Polygon", tooltip: LocaleUtils.trmsg("redlining.polygon"), icon: "polygon", data: {action: "Draw", geomType: "Polygon", text: ""}},
            {key: "Circle", tooltip: LocaleUtils.trmsg("redlining.circle"), icon: "circle", data: {action: "Draw", geomType: "Circle", text: ""}},
            {key: "Text", tooltip: LocaleUtils.trmsg("redlining.text"), icon: "text", data: {action: "Draw", geomType: "Text", text: ""}}
        ];
        const activeFreeHand = this.props.redlining.freehand ? "HandDrawing" : null;
        const freehandButtons = [{
            key: "HandDrawing", tooltip: LocaleUtils.trmsg("redlining.freehand"), icon: "freehand",
            data: {action: "Draw", geomType: this.props.redlining.geomType, text: "", freehand: !this.props.redlining.freehand},
            disabled: (this.props.redlining.geomType !== "LineString" && this.props.redlining.geomType !== "Polygon")
        }];
        const editButtons = [
            {key: "Pick", tooltip: LocaleUtils.trmsg("redlining.pick"), icon: "pick", data: {action: "Pick", geomType: null, text: ""}},
            {key: "Delete", tooltip: LocaleUtils.trmsg("redlining.delete"), icon: "trash", data: {action: "Delete", geomType: null}, disabled: !this.props.redlining.selectedFeature}
        ];
        for (const plugin of Object.values(this.props.plugins || {})) {
            editButtons.push(plugin.cfg);
        }
        let vectorLayers = this.props.layers.filter(layer => layer.type === "vector" && layer.role === LayerRole.USERLAYER && !layer.readonly);
        // Ensure list always contains "Redlining" layer
        if (!vectorLayers.find(layer => layer.id === 'redlining')) {
            vectorLayers = [{id: 'redlining', title: 'Redlining'}, ...vectorLayers];
        }

        const activePlugin = Object.values(this.props.plugins || {}).find(plugin => plugin.cfg.key === this.props.redlining.action);
        const controls = activePlugin ? (<activePlugin.controls />) : this.renderStandardControls();

        return (
            <div>
                <div className="redlining-buttongroups">
                    <div className="redlining-group">
                        <div>{LocaleUtils.tr("redlining.layer")}</div>
                        <VectorLayerPicker
                            addLayer={this.props.addLayer} layers={vectorLayers}
                            onChange={this.changeRedliningLayer} value={this.props.redlining.layer} />
                    </div>
                    <div className="redlining-group">
                        <div>{LocaleUtils.tr("redlining.draw")}</div>
                        <span>
                            <ButtonBar active={activeButton} buttons={drawButtons} onClick={(key, data) => this.actionChanged(data)} />
                            {this.props.redlining.action === "Draw" && (this.props.redlining.geomType === "LineString" || this.props.redlining.geomType === "Polygon") ?
                                <ButtonBar active={activeFreeHand} buttons={freehandButtons} onClick={(key, data) => this.actionChanged(data)} /> : null
                            }
                        </span>
                    </div>
                    <div className="redlining-group">
                        <div>{LocaleUtils.tr("redlining.edit")}</div>
                        <ButtonBar active={activeButton} buttons={editButtons} onClick={(key, data) => this.actionChanged(data)} />
                    </div>
                </div>
                {controls}
            </div>
        );
    }
    renderStandardControls = () => {
        let sizeLabel = LocaleUtils.tr("redlining.size");
        if (this.props.redlining.geomType === "LineString") {
            sizeLabel = LocaleUtils.tr("redlining.width");
        } else if (this.props.redlining.geomType === "Polygon") {
            sizeLabel = LocaleUtils.tr("redlining.border");
        }
        let labelPlaceholder = LocaleUtils.tr("redlining.label");
        if (this.props.redlining.geomType === "Text") {
            labelPlaceholder = LocaleUtils.tr("redlining.text");
        }

        return (
            <div className="redlining-controlsbar">
                <span>
                    <span>{LocaleUtils.tr("redlining.outline")}:&nbsp;</span>
                    <ColorButton color={this.props.redlining.style.borderColor} onColorChanged={(color) => this.updateRedliningStyle({borderColor: color})} />
                </span>
                {this.props.redlining.geomType === 'LineString' ? null : (
                    <span>
                        <span>{LocaleUtils.tr("redlining.fill")}:&nbsp;</span>
                        <ColorButton color={this.props.redlining.style.fillColor} onColorChanged={(color) => this.updateRedliningStyle({fillColor: color})} />
                    </span>
                )}
                <span>
                    <span>{sizeLabel}:&nbsp;</span>
                    <NumericInput max={99} min={1}
                        mobile onChange={(nr) => this.updateRedliningStyle({size: nr})} precision={0} step={1}
                        strict value={this.props.redlining.style.size}/>
                </span>
                {(this.props.redlining.geomType === 'Text' || this.props.allowGeometryLabels) ? (
                    <span>
                        <input className="redlining-label" onChange={(ev) => this.updateRedliningStyle({text: ev.target.value})} placeholder={labelPlaceholder} ref={el => this.setLabelRef(el)} type="text" value={this.props.redlining.style.text}/>
                    </span>
                ) : null}
            </div>
        );
    }
    render() {
        return (
            <TaskBar onHide={this.onHide} onShow={this.onShow} task="Redlining">
                {() => ({
                    body: this.renderBody()
                })}
            </TaskBar>
        );
    }
    setLabelRef = (el) => {
        this.labelInput = el;
        if (el && this.state.selectText) {
            el.focus();
            el.select();
            this.setState({selectText: false});
        }
    }
    triggerDelete = () => {
        this.updateRedliningState({action: "Delete", geomType: null});
    }
    actionChanged = (data) => {
        if (data.action === "Draw" && data.geomType === "Text") {
            data = {...data, text: LocaleUtils.tr("redlining.text")};
        }
        this.updateRedliningState(data);
    }
    changeRedliningLayer = (layer) => {
        this.updateRedliningState({layer: layer.id, layerTitle: layer.title});
    }
}

export default (plugins) => {
    return connect((state) => ({
        layers: state.layers.flat,
        redlining: state.redlining,
        mobile: state.browser.mobile,
        plugins: plugins
    }), {
        changeRedliningState: changeRedliningState,
        addLayer: addLayer,
        setSnappingConfig: setSnappingConfig
    })(Redlining);
};
