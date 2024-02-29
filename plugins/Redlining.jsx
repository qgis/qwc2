/**
 * Copyright 2017-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import NumericInput from 'react-numeric-input2';
import {connect} from 'react-redux';

import FileSaver from 'file-saver';
import Mousetrap from 'mousetrap';
import ol from 'openlayers';
import PropTypes from 'prop-types';

import {LayerRole, addLayer} from '../actions/layers';
import {setSnappingConfig} from '../actions/map';
import {changeRedliningState} from '../actions/redlining';
import Icon from '../components/Icon';
import TaskBar from '../components/TaskBar';
import ButtonBar from '../components/widgets/ButtonBar';
import ColorButton from '../components/widgets/ColorButton';
import ComboBox from '../components/widgets/ComboBox';
import MenuButton from '../components/widgets/MenuButton';
import VectorLayerPicker from '../components/widgets/VectorLayerPicker';
import {END_MARKERS} from '../utils/FeatureStyles';
import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';
import VectorLayerUtils from '../utils/VectorLayerUtils';

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
        layers: PropTypes.array,
        mapCrs: PropTypes.string,
        mobile: PropTypes.bool,
        plugins: PropTypes.object,
        redlining: PropTypes.object,
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
        snapping: true,
        snappingActive: true,
        plugins: []
    };
    state = {
        selectText: false
    };
    constructor(props) {
        super(props);
        this.labelInput = null;
        window.addEventListener('keydown', this.keyPressed);
    }
    componentDidUpdate(prevProps) {
        if (prevProps.redlining.geomType !== this.props.redlining.geomType && this.props.redlining.geomType === 'Text' && !this.state.selectText) {
            this.setState({selectText: true});
        }
        if (!this.props.layers.find(layer => layer.id === this.props.redlining.layer)) {
            const vectorLayers = this.props.layers.filter(layer => layer.type === "vector" && layer.role === LayerRole.USERLAYER && !layer.readonly);
            if (vectorLayers.length >= 1) {
                this.props.changeRedliningState({layer: vectorLayers[0].id, layerTitle: vectorLayers[0].title});
            } else if (this.props.redlining.layer !== 'redlining') {
                this.props.changeRedliningState({layer: 'redlining', layerTitle: 'Redlining'});
            }
        }
    }
    componentWillUnmount() {
        window.removeEventListener('keydown', this.keyPressed);
    }
    keyPressed = (ev) => {
        if (this.props.redlining.action && ev.keyCode === 27) {
            if (this.props.redlining.action === 'Draw' && !this.props.redlining.selectedFeature) {
                this.props.changeRedliningState({action: 'Delete'});
            }
        }
    };
    onShow = (mode, data) => {
        this.props.changeRedliningState({action: mode || 'Pick', geomType: null});
        this.props.setSnappingConfig(this.props.snapping, this.props.snappingActive);
        Mousetrap.bind('del', this.triggerDelete);
        if (data && data.layerId) {
            const layer = this.props.layers.find(l => l.id === data.layerId);
            if (layer) {
                this.changeRedliningLayer(layer);
            }
        }
    };
    onHide = () => {
        this.props.changeRedliningState({action: null, geomType: null, numericInput: false});
        Mousetrap.unbind('del', this.triggerDelete);
    };
    updateRedliningState = (diff) => {
        const newState = {...this.props.redlining, ...diff};
        this.props.changeRedliningState(newState);
    };
    updateRedliningStyle = (diff) => {
        const newStyle = {...this.props.redlining.style, ...diff};
        this.updateRedliningState({style: newStyle});
    };
    renderBody = () => {
        const activeButton = this.props.redlining.action === "Draw" ? this.props.redlining.geomType : this.props.redlining.action;
        let drawButtons = [
            {key: "Point", tooltip: LocaleUtils.trmsg("redlining.point"), icon: "point", data: {action: "Draw", geomType: "Point", text: ""}},
            {key: "LineString", tooltip: LocaleUtils.trmsg("redlining.line"), icon: "line", data: {action: "Draw", geomType: "LineString", text: ""}},
            {key: "Polygon", tooltip: LocaleUtils.trmsg("redlining.polygon"), icon: "polygon", data: {action: "Draw", geomType: "Polygon", text: ""}},
            [
                {key: "Circle", tooltip: LocaleUtils.trmsg("redlining.circle"), icon: "circle", data: {action: "Draw", geomType: "Circle", text: ""}},
                {key: "Ellipse", tooltip: LocaleUtils.trmsg("redlining.ellipse"), icon: "ellipse", data: {action: "Draw", geomType: "Ellipse", text: ""}},
                {key: "Square", tooltip: LocaleUtils.trmsg("redlining.square"), icon: "box", data: {action: "Draw", geomType: "Square", text: ""}},
                {key: "Box", tooltip: LocaleUtils.trmsg("redlining.rectangle"), icon: "rect", data: {action: "Draw", geomType: "Box", text: ""}}
            ],
            {key: "Text", tooltip: LocaleUtils.trmsg("redlining.text"), icon: "text", data: {action: "Draw", geomType: "Text", text: "", measurements: false}}
        ];
        if (this.props.mobile) {
            drawButtons = [drawButtons.flat()];
        }
        const activeFreeHand = this.props.redlining.freehand ? "HandDrawing" : null;
        const freehandButtons = [{
            key: "HandDrawing", tooltip: LocaleUtils.trmsg("redlining.freehand"), icon: "freehand",
            data: {action: "Draw", geomType: this.props.redlining.geomType, text: "", freehand: !this.props.redlining.freehand},
            disabled: (this.props.redlining.geomType !== "LineString" && this.props.redlining.geomType !== "Polygon")
        }];
        const editButtons = [
            {key: "Pick", tooltip: LocaleUtils.trmsg("redlining.pick"), icon: "nodetool", data: {action: "Pick", geomType: null, text: ""}},
            {key: "Transform", tooltip: LocaleUtils.trmsg("redlining.transform"), icon: "transformtool", data: {action: "Transform", geomType: null, text: ""}},
            {key: "Delete", tooltip: LocaleUtils.trmsg("redlining.delete"), icon: "trash", data: {action: "Delete", geomType: null}, disabled: !this.props.redlining.selectedFeature}
        ];
        const extraButtons = [
            {key: "NumericInput", tooltip: LocaleUtils.trmsg("redlining.numericinput"), icon: "numericinput"}
        ];
        for (const plugin of Object.values(this.props.plugins || {})) {
            editButtons.push(plugin.cfg);
        }
        let vectorLayers = this.props.layers.filter(layer => layer.type === "vector" && layer.role === LayerRole.USERLAYER && !layer.readonly);
        // Ensure list always contains at least a "Redlining" layer
        if (vectorLayers.length === 0) {
            vectorLayers = [{id: 'redlining', title: 'Redlining'}, ...vectorLayers];
        }
        const haveLayer = this.props.layers.find(l => l.id === this.props.redlining.layer) !== undefined;

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
                    <div className="redlining-group">
                        <div>&nbsp;</div>
                        <ButtonBar active={this.props.redlining.numericInput ? "NumericInput" : null} buttons={extraButtons} onClick={() => this.updateRedliningState({numericInput: !this.props.redlining.numericInput})} />
                    </div>
                    <div className="redlining-group">
                        <div>&nbsp;</div>
                        <MenuButton className="redlining-export-menu" disabled={!haveLayer} menuIcon="export" onActivate={this.export}>
                            <div className="redlining-export-menu-entry" key="GeoJSON" value="geojson">GeoJSON</div>
                            <div className="redlining-export-menu-entry" key="KML" value="kml">KML</div>
                        </MenuButton>
                    </div>
                </div>
                {controls}
            </div>
        );
    };
    export = (type) => {
        if (type === "geojson") {
            const layer = this.props.layers.find(l => l.id === this.props.redlining.layer);
            if (!layer) {
                return;
            }
            const geojson = JSON.stringify({
                type: "FeatureCollection",
                features: layer.features.map(feature => ({...feature, geometry: VectorLayerUtils.reprojectGeometry(feature.geometry, feature.crs || this.props.mapCrs, 'EPSG:4326')}))
            }, null, ' ');
            FileSaver.saveAs(new Blob([geojson], {type: "text/plain;charset=utf-8"}), layer.title + ".json");
        } else if (type === "kml") {
            const getNativeLayer = MapUtils.getHook(MapUtils.GET_NATIVE_LAYER);
            const layer = this.props.layers.find(l => l.id === this.props.redlining.layer);
            const nativeLayer = getNativeLayer(this.props.redlining.layer);
            if (!nativeLayer) {
                return;
            }
            const kmlFormat = new ol.format.KML();
            const features = nativeLayer.getSource().getFeatures().map(feature => {
                // Circle is not supported by kml format
                if (feature.getGeometry() instanceof ol.geom.Circle) {
                    feature = feature.clone();
                    feature.setGeometry(ol.geom.polygonFromCircle(feature.getGeometry()));
                }
                return feature;
            });
            const data = kmlFormat.writeFeatures(features, {featureProjection: this.props.mapCrs});
            FileSaver.saveAs(new Blob([data], {type: "application/vnd.google-earth.kml+xml"}), layer.title + ".kml");
        }
    };
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
        if (this.props.redlining.action !== 'Draw' && !this.props.redlining.selectedFeature) {
            return null;
        }

        return (
            <div className="redlining-controlsbar">
                <span>
                    <Icon className="redlining-control-icon" icon="pen" size="large" />
                    <ColorButton color={this.props.redlining.style.borderColor} onColorChanged={(color) => this.updateRedliningStyle({borderColor: color})} />
                </span>
                {this.props.redlining.geomType === 'LineString' ? null : (
                    <span>
                        <Icon className="redlining-control-icon" icon="fill" size="large" />
                        <ColorButton color={this.props.redlining.style.fillColor} onColorChanged={(color) => this.updateRedliningStyle({fillColor: color})} />
                    </span>
                )}
                <span>
                    <span>{sizeLabel}:&nbsp;</span>
                    <NumericInput max={99} min={1}
                        mobile onChange={(nr) => this.updateRedliningStyle({size: nr})} precision={0} step={1}
                        strict value={this.props.redlining.style.size}/>
                </span>
                {this.props.redlining.geomType === 'LineString' ? (
                    <span>
                        <span>{LocaleUtils.tr("redlining.markers")}:&nbsp;</span>
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
                    </span>
                ) : null}
                {this.props.redlining.geomType !== 'Text' ? (
                    <button
                        className={"button" + (this.props.redlining.measurements ? " pressed" : "")}
                        onClick={() => this.updateRedliningState({measurements: !this.props.redlining.measurements, style: {...this.props.redlining.style, text: ''}})}
                        title={LocaleUtils.tr("redlining.measurements")}
                    >
                        <Icon icon="measure" />
                    </button>
                ) : null}
                {(this.props.redlining.geomType === 'Text' || this.props.allowGeometryLabels) && !this.props.redlining.measurements ? (
                    <input className="redlining-label" onChange={(ev) => this.updateRedliningStyle({text: ev.target.value})} placeholder={labelPlaceholder} readOnly={this.props.redlining.measurements} ref={el => this.setLabelRef(el)} type="text" value={this.props.redlining.style.text}/>
                ) : null}
                {this.props.redlining.measurements && ['LineString', 'Circle'].includes(this.props.redlining.geomType) ? (
                    <select className="redlining-unit" onChange={ev => this.updateRedliningState({lenUnit: ev.target.value})} value={this.props.redlining.lenUnit}>
                        <option value="metric">{LocaleUtils.tr("measureComponent.metric")}</option>
                        <option value="imperial">{LocaleUtils.tr("measureComponent.imperial")}</option>
                        <option value="m">m</option>
                        <option value="km">km</option>
                        <option value="ft">ft</option>
                        <option value="mi">mi</option>
                    </select>
                ) : null}
                {this.props.redlining.measurements && ['Polygon', 'Ellipse', 'Square', 'Box'].includes(this.props.redlining.geomType) ? (
                    <select className="redlining-unit" onChange={ev => this.updateRedliningState({areaUnit: ev.target.value})} value={this.props.redlining.areaUnit}>
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
    triggerDelete = () => {
        this.updateRedliningState({action: "Delete", geomType: null});
    };
    actionChanged = (data) => {
        if (data.action === "Draw" && data.geomType === "Text") {
            data = {...data, text: LocaleUtils.tr("redlining.text")};
        }
        this.updateRedliningState(data);
    };
    changeRedliningLayer = (layer) => {
        this.updateRedliningState({layer: layer.id, layerTitle: layer.title});
    };
}

export default (plugins) => {
    return connect((state) => ({
        layers: state.layers.flat,
        redlining: state.redlining,
        mapCrs: state.map.projection,
        mobile: state.browser.mobile,
        plugins: plugins
    }), {
        changeRedliningState: changeRedliningState,
        addLayer: addLayer,
        setSnappingConfig: setSnappingConfig
    })(Redlining);
};
