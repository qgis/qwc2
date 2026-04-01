/**
 * Copyright 2026 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import ColorMap from '@giro3d/giro3d/core/ColorMap';
import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer';
import DrawTool, { conditions } from '@giro3d/giro3d/interactions/DrawTool';
import SunExposure from '@giro3d/giro3d/interactions/SunExposure';
import VectorSource from '@giro3d/giro3d/sources/VectorSource';
import colormap from 'colormap';
import ol from 'openlayers';
import PropTypes from 'prop-types';
import {Box3, Color} from 'three';

import Icon from '../../components/Icon';
import SideBar from '../../components/SideBar';
import Input from '../../components/widgets/Input';
import NumberInput from '../../components/widgets/NumberInput';
import Spinner from '../../components/widgets/Spinner';
import ToggleSwitch from '../../components/widgets/ToggleSwitch';
import LocaleUtils from '../../utils/LocaleUtils';

import './style/SunExposure3D.css';


/**
 * Compute sun exposure of terrain and objects within a selected area on the 3D map.
 */
export default class SunExposure3D extends React.Component {
    static propTypes = {
        sceneContext: PropTypes.object
    };
    state = {
        busy: false,
        exportPolygon: null,
        date: "",
        start: "09:00",
        end: "11:00",
        spatialResolution: 1,
        temporalResolution: 15,
        visualization: 'irradiation',
        pointCloudEntity: null,
        colorMaps: null,
        helpersVisible: false,
        terrain: true
    };
    constructor(props) {
        super(props);
        this.drawTool = null;
        this.drawLayer = null;
        this.state.date = (new Date()).toISOString().split("T")[0];
    }
    onShow = () => {
        this.abortController = new AbortController();
        this.drawTool = new DrawTool({
            instance: this.props.sceneContext.scene
        });
        this.drawLayer = new ColorLayer({
            source: new VectorSource({
                data: [],
                format: new ol.format.GeoJSON(),
                style: this.featureStyleFunction
            })
        });
        this.props.sceneContext.map.addLayer(this.drawLayer);

        this.restart();
    };
    onHide = () => {
        this.abortController.abort();
        this.abortController = null;
        this.drawTool.dispose();
        this.drawTool = null;
        this.props.sceneContext.map.removeLayer(this.drawLayer, {dispose: true});
        this.drawLayer = null;
        this.setState({busy: false, exportPolygon: null});
    };
    formatChanged = (ev) => {
        this.setState({selectedFormat: ev.target.value});
    };
    renderBody = () => {
        const computeDisabled = this.state.busy || this.state.exportPolygon === null;
        return (
            <div className="sunexposure3d-body">
                <form onSubmit={this.computeArea}>
                    <table className="sunexposure3d-options-table">
                        <tbody>
                            <tr>
                                <td>{LocaleUtils.tr("common.date")}</td>
                                <td><Input onChange={value => this.setState({date: value})} type="date" value={this.state.date} /></td>
                            </tr>
                            <tr>
                                <td>{LocaleUtils.tr("sunexposure3d.start")}</td>
                                <td><Input onChange={value => this.setState({start: value})} type="time" value={this.state.start} /></td>
                            </tr>
                            <tr>
                                <td>{LocaleUtils.tr("sunexposure3d.end")}</td>
                                <td><Input onChange={value => this.setState({end: value})} type="time" value={this.state.end} /></td>
                            </tr>
                            <tr>
                                <td>{LocaleUtils.tr("sunexposure3d.spatialres")}</td>
                                <td><NumberInput decimals={1} max={50} min={0.5} onChange={value => this.setState({spatialResolution: value})} suffix=" m" value={this.state.spatialResolution} /></td>
                            </tr>
                            <tr>
                                <td>{LocaleUtils.tr("sunexposure3d.tempres")}</td>
                                <td><NumberInput max={60} min={1} onChange={value => this.setState({temporalResolution: value})} suffix=" min" value={this.state.temporalResolution} /></td>
                            </tr>
                            <tr>
                                <td>{LocaleUtils.tr("sunexposure3d.includeterrain")}</td>
                                <td><ToggleSwitch active={this.state.terrain} onChange={value => this.setState({terrain: value})} /></td>
                            </tr>
                        </tbody>
                    </table>
                    <div className="button-bar">
                        <button className="button" disabled={computeDisabled} type="submit">
                            {this.state.busy ? (<Spinner />) : (<Icon icon="ok" />)}
                            <span>{this.state.busy ? LocaleUtils.tr("common.wait") : LocaleUtils.tr("common.compute")}</span>
                        </button>
                    </div>
                    {this.state.pointCloudEntity ? this.renderResultControls() : null}
                </form>
            </div>
        );
    };
    renderResultControls = () => {
        const attr = this.state.visualization;
        const colorMap = this.state.colorMaps[attr];
        // Note that irradiation is technically in Watt-hour/m², but for readability,
        // we convert to Kilowatt-hour/m² to be displayed in the UI.
        const factor = attr === 'irradiation' ? 0.001 : 1;
        const gradStops = colorMap.colors.map((color, i, a) => (
            `rgb(${color.r * 255}, ${color.g * 255}, ${color.b * 255}) ${Math.round(i / (a.length - 1) * 100)}%`
        )).join(",");

        const gradMin = Math.abs(colorMap.min * factor).toFixed(2);
        const gradMax = Math.abs(colorMap.max * factor).toFixed(2);
        const units = {
            meanIrradiance: "W/m²",
            irradiation: "KWh/m²",
            hoursOfSunlight: "hrs"
        };
        const colormapStyle = {
            background: `linear-gradient(90deg, ${gradStops}`
        };

        return (
            <div className="sunexposure3d-result-controls">
                <div className="sunexposure3d-visualization">
                    <span>
                        Visualization
                    </span>
                    <select onChange={this.setVisualization} value={this.state.visualization}>
                        <option value="irradiation">{LocaleUtils.tr("sunexposure3d.irradiation")}</option>
                        <option value="meanIrradiance">{LocaleUtils.tr("sunexposure3d.meanIrradiance")}</option>
                        <option value="hoursOfSunlight">{LocaleUtils.tr("sunexposure3d.hoursOfSunlight")}</option>
                    </select>
                </div>
                <div className="sunexposure3d-colormap" style={colormapStyle} />
                <div className="sunexposure3d-gradient-labels">
                    <span>{gradMin}</span>
                    <span>{units[attr]}</span>
                    <span>{gradMax}</span>
                </div>
                <div className="button-bar">
                    <button className="button" onClick={this.clearResult} type="button">
                        <Icon icon="clear" /><span>{LocaleUtils.tr("common.clear")}</span>
                    </button>
                </div>
            </div>
        );
    };
    setVisualization = (ev) => {
        this.state.pointCloudEntity.setActiveAttribute(ev.target.value);
        this.setState({visualization: ev.target.value});
    };
    clearResult = () => {
        this.props.sceneContext.getMap().instance.remove(this.state.pointCloudEntity);
        this.setState({pointCloudEntity: null});
    };
    render() {
        return (
            <SideBar icon={"sunexp"}
                id="SunExposure3D" onHide={this.onHide} onShow={this.onShow}
                title={LocaleUtils.tr("appmenu.items.SunExposure3D")} width="25em"
            >
                {() => ({
                    body: this.renderBody()
                })}
            </SideBar>
        );
    }
    restart = () => {
        if (this.abortController) {
            this.abortController.abort();
        }
        this.abortController = new AbortController();
        const pick = (e) => this.props.sceneContext.scene.pickObjectsAt(e, {sortByDistance: true, where: [this.props.sceneContext.getMap()]});
        const options = {
            signal: this.abortController.signal,
            endCondition: conditions.doubleClick,
            pick: pick
        };
        this.drawTool.createPolygon(options).then(this.selectArea).catch(() => {});
    };
    selectArea = (polygon) => {
        if (polygon === null) {
            this.restart();
            return;
        }
        this.drawLayer.source.clear();

        const polyGeoJson = polygon.toGeoJSON();
        const feature = (new ol.format.GeoJSON()).readFeature(polyGeoJson, {
            dataProjection: "EPSG:4326",
            featureProjection: this.props.sceneContext.mapCrs
        });
        this.drawLayer.source.addFeature(feature);
        this.props.sceneContext.scene.remove(polygon);
        this.setState({exportPolygon: polygon.points});

        // Setup for next selection
        this.restart();
    };
    featureStyleFunction = () => {
        return [
            new ol.style.Style({
                fill: new ol.style.Fill({
                    color: [41, 120, 180, 0.5]
                })
            }),
            new ol.style.Style({
                stroke: new ol.style.Stroke({
                    color: [255, 255, 255],
                    width: 4
                })
            }),
            new ol.style.Style({
                stroke: new ol.style.Stroke({
                    color: [41, 120, 180],
                    width: 1.5
                })
            })
        ];
    };
    computeArea = (ev) => {
        if (this.state.pointCloudEntity) {
            this.props.sceneContext.getMap().instance.remove(this.state.pointCloudEntity);
        }
        ev.preventDefault();
        this.setState({busy: true, pointCloudEntity: null, colorMaps: null, visualization: 'irradiation'});
        const box = new Box3().setFromPoints([...this.state.exportPolygon]);
        box.min.setZ(0);
        box.max.setZ(8000);
        const [yyyy, mm, dd] = this.state.date.split("-").map(Number);
        const [HHstart, MMstart] = this.state.start.split(":").map(Number);
        const [HHend, MMend] = this.state.end.split(":").map(Number);
        const start = new Date(yyyy, mm - 1, dd, HHstart, MMstart);
        const end = new Date(yyyy, mm - 1, dd, HHend, MMend);
        const colorMaps = {
            meanIrradiance: new ColorMap({ colors: colormap({ colormap: 'magma', nshades: 256}).map(v => new Color(v)), min: 0, max: 0 }),
            irradiation: new ColorMap({ colors: colormap({ colormap: 'jet', nshades: 256}).map(v => new Color(v)), min: 0, max: 0 }),
            hoursOfSunlight: new ColorMap({ colors: colormap({ colormap: 'RdBu', nshades: 256}).map(v => new Color(v)), min: 0, max: 0 })
        };
        const objects = [];
        if (this.state.terrain) {
            objects.push(this.props.sceneContext.getMap());
        }
        objects.push(...this.props.sceneContext.collisionObjects);

        const sunExposure = new SunExposure({
            instance: this.props.sceneContext.getMap().instance,
            showHelpers: this.state.helpersVisible,
            objects: objects,
            limits: box,
            spatialResolution: this.state.spatialResolution,
            colorMap: colorMaps.irradiation,
            start,
            end,
            temporalResolution: this.state.temporalResolution * 60
        });
        sunExposure.compute().then(result => {
            colorMaps.meanIrradiance.min = result.variables.meanIrradiance.min;
            colorMaps.meanIrradiance.max = result.variables.meanIrradiance.max;

            colorMaps.irradiation.min = result.variables.irradiation.min;
            colorMaps.irradiation.max = result.variables.irradiation.max;

            colorMaps.hoursOfSunlight.min = result.variables.hoursOfSunlight.min;
            colorMaps.hoursOfSunlight.max = result.variables.hoursOfSunlight.max;

            result.entity.setAttributeColorMap('meanIrradiance', colorMaps.meanIrradiance);
            result.entity.setAttributeColorMap('irradiation', colorMaps.irradiation);
            result.entity.setAttributeColorMap('hoursOfSunlight', colorMaps.hoursOfSunlight);

            result.entity.setActiveAttribute("irradiation");

            this.setState({busy: false, pointCloudEntity: result.entity, colorMaps: colorMaps});
        });
    };
}
