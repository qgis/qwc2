/**
 * Copyright 2017-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';

import {LayerRole, addLayer} from '../actions/layers';
import {setSnappingConfig} from '../actions/map';
import {changeRedliningState, resetRedliningState} from '../actions/redlining';
import Icon from '../components/Icon';
import TaskBar from '../components/TaskBar';
import ButtonBar from '../components/widgets/ButtonBar';
import ColorButton from '../components/widgets/ColorButton';
import ComboBox from '../components/widgets/ComboBox';
import MenuButton from '../components/widgets/MenuButton';
import NumberInput from '../components/widgets/NumberInput';
import VectorLayerPicker from '../components/widgets/VectorLayerPicker';
import ConfigUtils from '../utils/ConfigUtils';
import {END_MARKERS} from '../utils/FeatureStyles';
import LocaleUtils from '../utils/LocaleUtils';

import './style/Redlining.css';


/**
 * Allows drawing figures and text labels on the map.
 */
class Redlining extends React.Component {
    static propTypes = {
        addLayer: PropTypes.func,
        /** Whether to allow labeling geometric figures. */
        allowGeometryLabels: PropTypes.bool,
        changeRedliningState: PropTypes.func,
        /** Default area unit. Options: `metric`, `imperial`, `sqm`, `ha`, `sqkm`, `sqft`, `acre`, `sqmi` */
        defaultAreaUnit: PropTypes.string,
        /** Default border color. In format `[r, g, b, a]`. */
        defaultBorderColor: PropTypes.array,
        /** Default fill color. In format `[r, g, b, a]`. */
        defaultFillColor: PropTypes.array,
        /** Default length unit. Options: `metric`, `imperial`, `m`, `km`, `ft`, `mi` */
        defaultLengthUnit: PropTypes.string,
        /** Default text fill color. In format `[r, g, b, a]`. */
        defaultTextFillColor: PropTypes.array,
        /** Default text outline color. In format `[r, g, b, a]`. */
        defaultTextOutlineColor: PropTypes.array,
        /** Tools to hide. Available tools: `Circle`, `Ellipse`, `Square`, `Box`, `HandDrawing`, `Transform`, `NumericInput`, `Buffer`, `Export`. */
        hiddenTools: PropTypes.array,
        layers: PropTypes.array,
        mapCrs: PropTypes.string,
        plugins: PropTypes.object,
        /** Predefined border colors. In format `[[r, g, b, a], ...]`. */
        predefinedBorderColors: PropTypes.arrayOf(PropTypes.array),
        /** Predefined dash patterns. In format `[<dash-array>, ...]`, where a dash-array is list of alternating dash and gap widths, i.e. `[8 4]` for long dashes followed by shorter gaps. */
        predefinedDashPatterns: PropTypes.arrayOf(PropTypes.array),
        /** Predefined fill colors. In format `[[r, g, b, a], ...]`. */
        predefinedFillColors: PropTypes.arrayOf(PropTypes.array),
        redlining: PropTypes.object,
        resetRedliningState: PropTypes.func,
        setCurrentTask: PropTypes.func,
        setSnappingConfig: PropTypes.func,
        /** Whether snapping is available when editing. */
        snapping: PropTypes.bool,
        /** Whether snapping is enabled by default when editing.
         *  Either `false`, `edge`, `vertex` or `true` (i.e. both vertex and edge). */
        snappingActive: PropTypes.oneOfType([PropTypes.bool, PropTypes.string])
    };
    static defaultProps = {
        allowGeometryLabels: true,
        hiddenTools: [],
        snapping: true,
        snappingActive: true,
        plugins: [],
        defaultBorderColor: [255, 0, 0, 1],
        defaultFillColor: [255, 255, 255, 1],
        defaultTextFillColor: [0, 0, 0, 1],
        defaultTextOutlineColor: [255, 255, 255, 1],
        defaultAreaUnit: 'metric',
        defaultLengthUnit: 'metric',
        predefinedDashPatterns: [[], [8, 8], [1, 8], [8, 8, 1, 8]]
    };
    state = {
        selectText: false
    };
    constructor(props) {
        super(props);
        this.labelInput = null;
        this.dashIcons = {};
    }
    componentDidMount() {
        this.componentDidUpdate({redlining: {}});
    }
    componentDidUpdate(prevProps) {
        if (
            this.props.defaultBorderColor !== prevProps.defaultBorderColor ||
            this.props.defaultFillColor !== prevProps.defaultFillColor ||
            this.props.defaultLengthUnit !== prevProps.defaultLengthUnit ||
            this.props.defaultAreaUnit !== prevProps.defaultAreaUnit ||
            this.props.defaultTextFillColor !== prevProps.defaultTextFillColor ||
            this.props.defaultTextOutlineColor !== prevProps.defaultTextOutlineColor
        ) {
            this.props.changeRedliningState(this.redliningStateDefaults());
        }
        if (prevProps.redlining.geomType !== this.props.redlining.geomType && this.props.redlining.geomType === 'Text' && !this.state.selectText) {
            this.setState({selectText: true});
        }
        if (!this.props.layers.find(layer => layer.id === this.props.redlining.layer)) {
            const vectorLayers = this.props.layers.filter(layer => layer.type === "vector" && layer.role === LayerRole.USERLAYER && !layer.readonly);
            if (vectorLayers.length >= 1) {
                this.props.changeRedliningState({layer: vectorLayers[0].id, layerTitle: vectorLayers[0].title});
            } else if (this.props.redlining.layer !== 'redlining') {
                this.props.changeRedliningState({layer: 'redlining', layerTitle: LocaleUtils.tr('redlining.layertitle')});
            }
        }
        if (this.props.predefinedDashPatterns !== prevProps.predefinedDashPatterns) {
            this.generateDashIcons();
        }
    }
    onShow = (mode, data) => {
        this.props.changeRedliningState({action: mode ?? 'Pick', geomType: data?.geomType ?? null, ...this.redliningStateDefaults()});
        this.props.setSnappingConfig(this.props.snapping, this.props.snappingActive);
        if (data && data.layerId) {
            const layer = this.props.layers.find(l => l.id === data.layerId);
            if (layer) {
                this.changeRedliningLayer(layer);
            }
        }
    };
    onHide = () => {
        this.props.resetRedliningState();
    };
    redliningStateDefaults = () => {
        return {
            style: {
                ...this.props.redlining.style,
                borderColor: this.props.defaultBorderColor,
                fillColor: this.props.defaultFillColor,
                textOutlineColor: this.props.defaultTextOutlineColor,
                textFillColor: this.props.defaultTextFillColor
            },
            lenUnit: this.props.defaultLengthUnit,
            areaUnit: this.props.defaultAreaUnit
        };
    };
    generateDashIcons = () => {
        this.dashIcons = this.props.predefinedDashPatterns.reduce((res, pattern) => {
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="16"><line x1="0" y1="8" x2="32" y2="8" stroke="black" stroke-width="2" stroke-dasharray="${pattern.join(" ")}"></line></svg>`;
            res[pattern.join(":")] = `data:image/svg+xml;base64,${btoa(svg)}`;
            return res;
        }, {});
    };
    updateRedliningStyle = (diff) => {
        const newStyle = {...this.props.redlining.style, ...diff};
        this.props.changeRedliningState({style: newStyle});
    };
    renderBody = () => {
        const toolEnabled = (tool) => !this.props.hiddenTools.includes(tool);
        const activeButton = this.props.redlining.action === "Draw" ? this.props.redlining.geomType : this.props.redlining.action;
        let drawButtons = [
            {key: "Point", tooltip: LocaleUtils.tr("redlining.point"), icon: "point", data: {action: "Draw", geomType: "Point", text: ""}},
            {key: "LineString", tooltip: LocaleUtils.tr("redlining.line"), icon: "line", data: {action: "Draw", geomType: "LineString", text: ""}},
            [
                {key: "Polygon", tooltip: LocaleUtils.tr("redlining.polygon"), icon: "polygon", data: {action: "Draw", geomType: "Polygon", text: ""}},
                toolEnabled("Circle") ? {key: "Circle", tooltip: LocaleUtils.tr("redlining.circle"), icon: "circle", data: {action: "Draw", geomType: "Circle", text: ""}} : null,
                toolEnabled("Ellipse") ? {key: "Ellipse", tooltip: LocaleUtils.tr("redlining.ellipse"), icon: "ellipse", data: {action: "Draw", geomType: "Ellipse", text: ""}} : null,
                toolEnabled("Square") ? {key: "Square", tooltip: LocaleUtils.tr("redlining.square"), icon: "box", data: {action: "Draw", geomType: "Square", text: ""}} : null,
                toolEnabled("Box") ? {key: "Box", tooltip: LocaleUtils.tr("redlining.rectangle"), icon: "rect", data: {action: "Draw", geomType: "Box", text: ""}} : null
            ].filter(Boolean),
            {key: "Text", tooltip: LocaleUtils.tr("redlining.text"), icon: "text", data: {action: "Draw", geomType: "Text", text: "", measurements: false}}
        ];
        if (ConfigUtils.isMobile()) {
            drawButtons = [drawButtons.flat()];
        }
        const activeFreeHand = this.props.redlining.freehand ? "HandDrawing" : null;
        const freehandButtons = toolEnabled("HandWriting") ? [{
            key: "HandDrawing", tooltip: LocaleUtils.tr("redlining.freehand"), icon: "freehand",
            data: {action: "Draw", geomType: this.props.redlining.geomType, text: "", freehand: !this.props.redlining.freehand},
            disabled: (this.props.redlining.geomType !== "LineString" && this.props.redlining.geomType !== "Polygon")
        }] : [];
        const editButtons = [
            {key: "Pick", tooltip: LocaleUtils.tr("redlining.pick"), icon: "nodetool", data: {action: "Pick", geomType: null, text: ""}},
            toolEnabled("Transform") ? {key: "Transform", tooltip: LocaleUtils.tr("redlining.transform"), icon: "transformtool", data: {action: "Transform", geomType: null, text: ""}} : null,
            toolEnabled("Clone") ? {key: "Clone", tooltip: LocaleUtils.tr("redlining.clone"), icon: "clone", data: {action: "Clone", geomType: null}, disabled: !this.props.redlining.selectedFeature} : null,
            {key: "Delete", tooltip: LocaleUtils.tr("redlining.delete"), icon: "trash", data: {action: "Delete", geomType: null}, disabled: !this.props.redlining.selectedFeature}
        ].filter(Boolean);
        const extraButtons = toolEnabled("NumericInput") ? [
            {key: "NumericInput", tooltip: LocaleUtils.tr("redlining.numericinput"), icon: "numericinput"},
            {key: "FeatureAttributes", tooltip: LocaleUtils.tr("redlining.attributes"), icon: "list-alt"}
        ] : [];
        for (const plugin of Object.values(this.props.plugins || {})) {
            if (toolEnabled(plugin.cfg.key)) {
                editButtons.push({
                    ...plugin.cfg,
                    tooltip: plugin.cfg.tooltip ? LocaleUtils.tr(plugin.cfg.tooltip) : undefined
                });
            }
        }
        let vectorLayers = this.props.layers.filter(layer => layer.type === "vector" && layer.role === LayerRole.USERLAYER && !layer.readonly);
        // Ensure list always contains at least a "Redlining" layer
        if (vectorLayers.length === 0) {
            vectorLayers = [{id: 'redlining', title: LocaleUtils.tr('redlining.layertitle')}, ...vectorLayers];
        }
        const haveLayer = (this.props.layers.find(l => l.id === this.props.redlining.layer)?.features?.length || 0) > 0;

        const activePlugin = Object.values(this.props.plugins || {}).find(plugin => plugin.cfg.key === this.props.redlining.action);
        const controls = activePlugin ? (<activePlugin.controls />) : this.renderStandardControls();

        return (
            <div>
                <div className="redlining-controlsbar">
                    <div className="redlining-groupcontrol">
                        <div>{LocaleUtils.tr("redlining.layer")}</div>
                        <VectorLayerPicker
                            addLayer={this.props.addLayer} layers={vectorLayers}
                            onChange={this.changeRedliningLayer} value={this.props.redlining.layer} />
                    </div>
                    <div className="redlining-groupcontrol">
                        <div>{LocaleUtils.tr("redlining.draw")}</div>
                        <div className="controlgroup">
                            <ButtonBar active={activeButton} buttons={drawButtons} onClick={(key, data) => this.actionChanged(data)} />
                            {this.props.redlining.action === "Draw" && (this.props.redlining.geomType === "LineString" || this.props.redlining.geomType === "Polygon") ?
                                <ButtonBar active={activeFreeHand} buttons={freehandButtons} onClick={(key, data) => this.actionChanged(data)} /> : null
                            }
                        </div>
                    </div>
                    <div className="redlining-groupcontrol">
                        <div>{LocaleUtils.tr("redlining.edit")}</div>
                        <ButtonBar active={activeButton} buttons={editButtons} onClick={(key, data) => this.actionChanged(data)} />
                    </div>
                    <div className="redlining-groupcontrol">
                        <div>&nbsp;</div>
                        <ButtonBar active={this.props.redlining.extraAction} buttons={extraButtons} onClick={(key) => this.props.changeRedliningState({extraAction: key})} />
                    </div>
                    {toolEnabled("Export") ? (
                        <div className="redlining-groupcontrol">
                            <div>&nbsp;</div>
                            <MenuButton className="redlining-export-menu" disabled={!haveLayer} menuIcon="export" onActivate={this.export} tooltip={LocaleUtils.tr("redlining.export")}>
                                <div className="redlining-export-menu-entry" key="GeoJSON" value="geojson">GeoJSON</div>
                                <div className="redlining-export-menu-entry" key="KML" value="kml">KML</div>
                            </MenuButton>
                        </div>
                    ) : null}
                </div>
                {controls}
            </div>
        );
    };
    export = (format) => {
        this.props.changeRedliningState({action: 'Export', format: format});
    };
    renderStandardControls = () => {
        let sizeLabel = LocaleUtils.tr("redlining.line");
        let showDash = true;
        if (["Text", "Point"].includes(this.props.redlining.geomType)) {
            sizeLabel = LocaleUtils.tr("redlining.size");
            showDash = false;
        }
        let labelPlaceholder = LocaleUtils.tr("redlining.label");
        if (this.props.redlining.geomType === "Text") {
            labelPlaceholder = LocaleUtils.tr("redlining.text");
        }
        if (this.props.redlining.action !== 'Draw' && !this.props.redlining.selectedFeature) {
            if (this.props.redlining.action === 'Transform') {
                return (
                    <div className="redlining-message">
                        {LocaleUtils.tr("redlining.ctrlhint")}
                    </div>
                );
            } else {
                return null;
            }
        }

        return (
            <div className="redlining-controlsbar">
                <div className="redlining-control">
                    <Icon className="redlining-control-icon" icon="pen" size="large" />
                    {this.props.redlining.geomType === 'Text' ? (
                        <ColorButton color={this.props.redlining.style.textOutlineColor} defaultColors={this.props.predefinedBorderColors} onColorChanged={(color) => this.updateRedliningStyle({textOutlineColor: color})} />
                    ) : (
                        <ColorButton color={this.props.redlining.style.borderColor} defaultColors={this.props.predefinedBorderColors} onColorChanged={(color) => this.updateRedliningStyle({borderColor: color})} />
                    )}
                </div>
                {this.props.redlining.geomType === 'LineString' ? null : (
                    <div className="redlining-control">
                        <Icon className="redlining-control-icon" icon="fill" size="large" />
                        {this.props.redlining.geomType === 'Text' ? (
                            <ColorButton color={this.props.redlining.style.textFillColor} defaultColors={this.props.predefinedFillColors} onColorChanged={(color) => this.updateRedliningStyle({textFillColor: color})} />
                        ) : (
                            <ColorButton color={this.props.redlining.style.fillColor} defaultColors={this.props.predefinedFillColors} onColorChanged={(color) => this.updateRedliningStyle({fillColor: color})} />
                        )}
                    </div>
                )}
                <div className="redlining-control">
                    <span>{sizeLabel}:&nbsp;</span>
                    <NumberInput max={99} min={1} mobile
                        onChange={(nr) => this.updateRedliningStyle({size: nr})}
                        value={this.props.redlining.style.size}/>
                    {showDash ? (
                        <ComboBox onChange={value => this.updateRedliningStyle({strokeDash: value.split(":").filter(Boolean).map(Number)})} value={this.props.redlining.style.strokeDash.join(":")}>
                            {this.props.predefinedDashPatterns.map(pattern => {
                                const value = pattern.join(":");
                                return (
                                    <div className="redlining-dash-combo-entry" key={value} value={value}>
                                        <img src={this.dashIcons[value]} />
                                    </div>
                                );
                            })}
                        </ComboBox>
                    ) : null}
                </div>
                {this.props.redlining.geomType === 'LineString' ? (
                    <div className="redlining-control">
                        <span>{LocaleUtils.tr("redlining.markers")}:&nbsp;</span>
                        <div className="controlgroup">
                            <ComboBox className="redlining-marker-combo" onChange={value => this.updateRedliningStyle({headmarker: value})} value={this.props.redlining.style.headmarker || ""}>
                                <div className="redlining-marker-combo-entry" value="" />
                                {Object.entries(END_MARKERS).map(([key, params]) => (
                                    <div className="redlining-marker-combo-entry" key={key} value={key}>
                                        <img src={params.src} style={{transform: 'rotate(' + params.baserotation + 'deg)'}}/>
                                    </div>
                                ))}
                            </ComboBox>
                            <ComboBox className="redlining-marker-combo" onChange={value => this.updateRedliningStyle({tailmarker: value})} value={this.props.redlining.style.tailmarker || ""}>
                                <div className="redlining-marker-combo-entry" value="" />
                                {Object.entries(END_MARKERS).map(([key, params]) => (
                                    <div className="redlining-marker-combo-entry" key={key} value={key}>
                                        <img src={params.src} style={{transform: 'rotate(' + (180 + params.baserotation) + 'deg)'}}/>
                                    </div>
                                ))}
                            </ComboBox>
                        </div>
                    </div>
                ) : null}
                <div className="redlining-control redlining-control-fill">
                    <div className="controlgroup">
                        {this.props.redlining.geomType !== 'Text' && this.props.allowGeometryLabels ? (
                            <button
                                className={"button" + (this.props.redlining.measurements ? " pressed" : "")}
                                onClick={() => this.props.changeRedliningState({measurements: !this.props.redlining.measurements, style: {...this.props.redlining.style, text: ''}})}
                                title={LocaleUtils.tr("redlining.measurements")}
                            >
                                <Icon icon="measure" />
                            </button>
                        ) : null}
                        {(this.props.redlining.geomType === 'Text' || this.props.allowGeometryLabels) && !this.props.redlining.measurements ? (
                            <input className="controlgroup-fillitem" onChange={(ev) => this.updateRedliningStyle({text: ev.target.value})} placeholder={labelPlaceholder} readOnly={this.props.redlining.measurements} ref={el => this.setLabelRef(el)} type="text" value={this.props.redlining.style.text}/>
                        ) : null}
                        {this.props.redlining.measurements && ['LineString', 'Circle'].includes(this.props.redlining.geomType) ? (
                            <select className="controlgroup-fillitem" onChange={ev => this.props.changeRedliningState({lenUnit: ev.target.value})} value={this.props.redlining.lenUnit}>
                                <option value="metric">{LocaleUtils.tr("measureComponent.metric")}</option>
                                <option value="imperial">{LocaleUtils.tr("measureComponent.imperial")}</option>
                                <option value="m">m</option>
                                <option value="km">km</option>
                                <option value="ft">ft</option>
                                <option value="mi">mi</option>
                            </select>
                        ) : null}
                        {this.props.redlining.measurements && ['Polygon', 'Ellipse', 'Square', 'Box'].includes(this.props.redlining.geomType) ? (
                            <select className="controlgroup-fillitem" onChange={ev => this.props.changeRedliningState({areaUnit: ev.target.value})} value={this.props.redlining.areaUnit}>
                                <option value="metric">{LocaleUtils.tr("measureComponent.metric")}</option>
                                <option value="imperial">{LocaleUtils.tr("measureComponent.imperial")}</option>
                                <option value="sqm">m&#178;</option>
                                <option value="ha">ha</option>
                                <option value="sqkm">km&#178;</option>
                                <option value="sqft">ft&#178;</option>
                                <option value="acre">acre</option>
                                <option value="sqmi">mi&#178;</option>
                            </select>
                        ) : null}
                    </div>
                </div>
            </div>
        );
    };
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
    };
    actionChanged = (data) => {
        if (data.action === "Draw" && data.geomType === "Text") {
            data = {...data, style: {text: LocaleUtils.tr("redlining.text")}};
        } else if (!this.props.allowGeometryLabels) {
            data = {...data, style: {text: ''}};
        }
        this.props.changeRedliningState(data);
    };
    changeRedliningLayer = (layer) => {
        const action = ["Draw", "Pick", "Transform"].includes(this.props.redlining.action) ? this.props.redlining.action : "Pick";
        this.props.changeRedliningState({layer: layer.id, layerTitle: layer.title, action: action});
    };
}

export default (plugins) => {
    return connect((state) => ({
        layers: state.layers.flat,
        redlining: state.redlining,
        mapCrs: state.map.projection,
        plugins: plugins
    }), {
        changeRedliningState: changeRedliningState,
        addLayer: addLayer,
        resetRedliningState: resetRedliningState,
        setSnappingConfig: setSnappingConfig
    })(Redlining);
};
