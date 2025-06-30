/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer';
import Shape from '@giro3d/giro3d/entities/Shape';
import DrawTool, {conditions} from "@giro3d/giro3d/interactions/DrawTool.js";
import VectorSource from '@giro3d/giro3d/sources/VectorSource';
import ol from 'openlayers';
import pointInPolygon from 'point-in-polygon';
import PropTypes from 'prop-types';
import {CurvePath, LineCurve, Vector2, Vector3} from 'three';

import ConfigUtils from '../../utils/ConfigUtils';
import CoordinatesUtils from '../../utils/CoordinatesUtils';
import LocaleUtils from '../../utils/LocaleUtils';
import MeasureUtils from '../../utils/MeasureUtils';
import TaskBar from '../TaskBar';
import ButtonBar from '../widgets/ButtonBar';
import CopyButton from '../widgets/CopyButton';
import HeightProfile3D from './HeightProfile3D';

import '../../plugins/style/Measure.css';


export default class Measure3D extends React.Component {
    static propTypes = {
        maxSampleCount: PropTypes.number,
        minMeasureLength: PropTypes.number,
        sceneContext: PropTypes.object
    };
    static defaultProps = {
        maxSampleCount: 500,
        minMeasureLength: 1
    };
    state = {
        mode: null,
        result: null,
        lenUnit: 'metric',
        areaUnit: 'metric',
        elevUnit: 'absolute'
    };
    constructor(props) {
        super(props);
        this.measureTool = null;
        this.drawLayer = null;
        this.measurementObjects = [];
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.state.mode && this.state.mode !== prevState.mode) {
            this.clearResult();
            this.restart();
        }
        if (this.state.elevUnit !== prevState.elevUnit) {
            // Re-render height label
            this.measurementObjects[0].rebuildLabels();
            this.props.sceneContext.scene.notifyChange();
        }
    }
    onShow = (mode) => {
        this.setState({mode: mode ?? 'Point'});
        this.abortController = new AbortController();
        this.measureTool = new DrawTool({
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
    };
    onHide = () => {
        this.clearResult();
        this.setState({mode: null});
        this.abortController.abort();
        this.abortController = null;
        this.measureTool.dispose();
        this.measureTool = null;
        this.props.sceneContext.map.removeLayer(this.drawLayer, {dispose: true});
        this.drawLayer = null;
    };
    renderModeSwitcher = () => {
        const buttons = [
            {key: "Point", label: LocaleUtils.tr("measureComponent.pointLabel")},
            {key: "HeightDiff", label: LocaleUtils.tr("measureComponent.heightDiffLabel")},
            {key: "LineString", label: LocaleUtils.tr("measureComponent.lengthLabel")},
            {key: "Polygon", label: LocaleUtils.tr("measureComponent.areaLabel")}
        ];
        return (
            <ButtonBar active={this.state.mode} buttons={buttons} onClick={mode => this.setState({mode, result: null})} />
        );
    };
    renderResult = () => {
        if (!this.state.result) {
            return null;
        }
        let text = "";
        let unitSelector = null;

        if (this.state.mode === "Point") {
            text = CoordinatesUtils.getFormattedCoordinate(this.state.result.pos.slice(0, 2), this.props.sceneContext.mapCrs);
            const prec = ConfigUtils.getConfigProp("measurementPrecision");
            text += ", " + (this.state.result.ground > 0 && this.state.elevUnit === 'ground' ? this.state.result.ground : this.state.result.pos[2]).toFixed(prec);
            if (this.state.result.ground > 0) {
                unitSelector = (
                    <select onChange={ev => this.setState({elevUnit: ev.target.value})} value={this.state.elevUnit}>
                        <option value="ground">{LocaleUtils.tr("measureComponent.ground")}</option>
                        <option value="absolute">{LocaleUtils.tr("measureComponent.absolute")}</option>
                    </select>
                );
            } else {
                unitSelector = (
                    <span className="measure-unit-label">{LocaleUtils.tr("measureComponent.absolute")}</span>
                );
            }
        } else if (this.state.mode === "HeightDiff") {
            text = (this.state.result || []).length === 2 ? MeasureUtils.formatMeasurement(Math.abs(this.state.result[1].z - this.state.result[0].z), false, this.state.lenUnit) : "";
            unitSelector = (
                <select onChange={ev => this.setState({lenUnit: ev.target.value})} value={this.state.lenUnit}>
                    <option value="metric">{LocaleUtils.tr("measureComponent.metric")}</option>
                    <option value="imperial">{LocaleUtils.tr("measureComponent.imperial")}</option>
                    <option value="m">m</option>
                    <option value="km">km</option>
                    <option value="ft">ft</option>
                    <option value="mi">mi</option>
                </select>
            );
        } else if (this.state.mode === "LineString") {
            text = MeasureUtils.formatMeasurement(this.state.result.length, false, this.state.lenUnit);
            unitSelector = (
                <select onChange={ev => this.setState({lenUnit: ev.target.value})} value={this.state.lenUnit}>
                    <option value="metric">{LocaleUtils.tr("measureComponent.metric")}</option>
                    <option value="imperial">{LocaleUtils.tr("measureComponent.imperial")}</option>
                    <option value="m">m</option>
                    <option value="km">km</option>
                    <option value="ft">ft</option>
                    <option value="mi">mi</option>
                </select>
            );
        } else if (this.state.mode === "Polygon") {
            text = MeasureUtils.formatMeasurement(this.state.result, true, this.state.areaUnit);
            unitSelector = (
                <select onChange={ev => this.setState({areaUnit: ev.target.value})} value={this.state.areaUnit}>
                    <option value="metric">{LocaleUtils.tr("measureComponent.metric")}</option>
                    <option value="imperial">{LocaleUtils.tr("measureComponent.imperial")}</option>
                    <option value="sqm">m&#178;</option>
                    <option value="ha">ha</option>
                    <option value="sqkm">km&#178;</option>
                    <option value="sqft">ft&#178;</option>
                    <option value="acre">acre</option>
                    <option value="sqmi">mi&#178;</option>
                </select>
            );
        }
        return (
            <div className="measure-result controlgroup">
                <input className="measure-result-field" readOnly type="text" value={text} />
                {unitSelector}
                <CopyButton text={text} />
            </div>
        );
    };
    render() {
        return [
            (
                <TaskBar key="TaskBar" onHide={this.onHide} onShow={this.onShow} task="Measure3D">
                    {() => ({
                        body: (
                            <div className="measure-body">
                                {this.renderModeSwitcher()}
                                {this.renderResult()}
                            </div>
                        )
                    })}
                </TaskBar>
            ),
            this.state.result?.profile ? (
                <HeightProfile3D data={this.state.result.profile} key="HeightProfile" sceneContext={this.props.sceneContext} />
            ) : null
        ];
    }
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
    clearResult = () => {
        this.drawLayer.source.clear();
        this.measurementObjects.forEach(object => {
            this.props.sceneContext.scene.remove(object);
        });
        this.measurementObjects = [];
        this.setState({result: null});
    };
    restart = () => {
        if (this.abortController) {
            this.abortController.abort();
        }
        this.abortController = new AbortController();
        const terrainPick = (e) => this.props.sceneContext.scene.pickObjectsAt(e, {sortByDistance: true, where: [this.props.sceneContext.getMap()]});
        const options = {
            signal: this.abortController.signal,
            endCondition: conditions.doubleClick,
            pick: null // default pick
        };
        if (this.state.mode === 'Point') {
            this.measureTool.createPoint(options).then(this.measurePoint).catch(() => {});
        } else if (this.state.mode === 'LineString') {
            options.pick = terrainPick;
            this.measureTool.createLineString(options).then(this.measureLine).catch(() => {});
        } else if (this.state.mode === 'Polygon') {
            options.pick = terrainPick;
            this.measureTool.createPolygon(options).then(this.measureArea).catch(() => {});
        } else if (this.state.mode === 'HeightDiff') {
            this.measureTool.createPoint(options).then(this.measureHeightDiff).catch(() => {});
        }
    };
    measurePoint = (point) => {
        if (point === null) {
            this.restart();
            return;
        }
        this.clearResult();
        const pos = point.points[0];

        // Measure point above terrain
        this.props.sceneContext.getTerrainHeightFromDTM([pos.x, pos.y]).then(elevation => {
            const ground = pos.z - elevation > 0.3 ? pos.z - elevation : 0;

            const elevationLabelFormatter = (options) => {
                if (options.index === 0) {
                    return MeasureUtils.formatMeasurement(elevation, false, "m") + " " + LocaleUtils.tr("measureComponent.absolute");
                } else if (ground > 0 && this.state.elevUnit === "ground") {
                    return MeasureUtils.formatMeasurement(pos.z - elevation, false, "m") + " " + LocaleUtils.tr("measureComponent.ground");
                } else {
                    return MeasureUtils.formatMeasurement(pos.z, false, LocaleUtils.tr("measureComponent.absolute"));
                }
            };
            let shape = null;
            if (ground > 0) {
                // Add line
                shape = new Shape({
                    showVertexLabels: true,
                    showLine: true,
                    showVertices: true,
                    vertexLabelFormatter: elevationLabelFormatter
                });
                shape.setPoints([new Vector3(pos.x, pos.y, elevation), pos]);
            } else {
                // Add point
                shape = new Shape({
                    showVertexLabels: true,
                    showLine: false,
                    showVertices: true,
                    vertexLabelFormatter: elevationLabelFormatter
                });
                shape.setPoints([new Vector3(pos.x, pos.y, pos.z)]);
            }
            this.props.sceneContext.scene.add(shape);
            this.measurementObjects.push(shape);
            this.props.sceneContext.scene.remove(point);

            this.setState({result: {pos: [pos.x, pos.y, pos.z], ground: ground}});

            // Setup for next measurement
            this.restart();
        });
    };
    measureHeightDiff = (point) => {
        if (point === null) {
            this.restart();
            return;
        }
        if ((this.state.result || []).length >= 2) {
            this.clearResult();
        }
        const pos = point.points[0];

        if ((this.state.result || []).length === 1) {
            // Add line if two points drawn
            const points = [this.state.result[0], pos];
            if (points[0].z > points[1].z) {
                points.reverse();
            }
            const line = new Shape({
                showVertexLabels: true,
                vertexLabelFormatter: (options) => options.index === 2 ? MeasureUtils.formatMeasurement(points[1].z - points[0].z, false, this.state.lenUnit) : null,
                showLine: true
            });
            line.setPoints([
                new Vector3(points[0].x, points[0].y, points[0].z),
                new Vector3(points[1].x, points[1].y, points[0].z),
                new Vector3(points[1].x, points[1].y, points[1].z)
            ]);
            this.props.sceneContext.scene.add(line);
            this.measurementObjects.push(line);
        } else {
            // Add first drawn point
            const shape = new Shape({
                showVertices: true
            });
            shape.setPoints([new Vector3(pos.x, pos.y, pos.z)]);
            this.props.sceneContext.scene.add(shape);
            this.measurementObjects.push(shape);
        }
        this.props.sceneContext.scene.remove(point);
        this.setState(state => ({
            result: [...(state.result || []), {x: pos.x, y: pos.y, z: pos.z}]
        }));

        this.restart();
    };
    measureLine = (lineString) => {
        if (lineString === null) {
            this.restart();
            return;
        }
        this.clearResult();
        const features = (new ol.format.GeoJSON()).readFeatures(lineString.toGeoJSON(), {
            dataProjection: "EPSG:4326",
            featureProjection: this.props.sceneContext.mapCrs
        });
        this.drawLayer.source.addFeatures(features);
        this.props.sceneContext.scene.remove(lineString);

        // Compute 2d length and nSamples spaced points
        const path = new CurvePath();
        let len2d = 0;
        for (let i = 0; i < lineString.points.length - 1; i++) {
            const v0 = lineString.points[i];
            const v1 = lineString.points[i + 1];

            const line = new LineCurve(
                new Vector2(v0.x, v0.y),
                new Vector2(v1.x, v1.y),
            );
            path.add(line);
            len2d += Math.sqrt((v1.x - v0.x) * (v1.x - v0.x) + (v1.y - v0.y) * (v1.y - v0.y));
        }
        const nSamples = Math.min(this.props.maxSampleCount, Math.round(len2d / this.props.minMeasureLength));

        const points = path.getSpacedPoints(nSamples - 1).map(p => [p.x, p.y]);
        this.props.sceneContext.getTerrainHeightFromDTM(points).then(elevations => {
            const line3d = points.map((p, i) => [p[0], p[1], elevations[i], 0]);
            let len3d = 0;
            for (let i = 1; i < nSamples; ++i) {
                const dx = line3d[i][0] - line3d[i - 1][0];
                const dy = line3d[i][1] - line3d[i - 1][1];
                const dz = line3d[i][2] - line3d[i - 1][2];
                len3d += Math.sqrt(dx * dx + dy * dy + dz * dz);
                line3d[i][3] = len3d; // Also store incremental length for height profie
            }
            this.setState({result: {length: len3d, profile: line3d}});

            // Setup for next measurement
            this.restart();
        });
    };
    measureArea = (polygon) => {
        if (polygon === null) {
            this.restart();
            return;
        }
        this.clearResult();

        const features = (new ol.format.GeoJSON()).readFeatures(polygon.toGeoJSON(), {
            dataProjection: "EPSG:4326",
            featureProjection: this.props.sceneContext.mapCrs
        });
        this.drawLayer.source.addFeatures(features);
        this.props.sceneContext.scene.remove(polygon);

        // Compute boundingbox of polygon, divide boundingbox into quads,
        // compute quad area on terrain for each quad in polygon
        const bbox = [
            polygon.points[0].x, polygon.points[0].y,
            polygon.points[0].x, polygon.points[0].y
        ];
        const coordinates = polygon.points.map(v => {
            bbox[0] = Math.min(bbox[0], v.x);
            bbox[1] = Math.min(bbox[1], v.y);
            bbox[2] = Math.max(bbox[2], v.x);
            bbox[3] = Math.max(bbox[3], v.y);
            return [v.x, v.y];
        });
        const quadSize = this.props.minMeasureLength;
        const numX = Math.min(this.props.maxSampleCount, Math.round((bbox[2] - bbox[0]) / quadSize));
        const numY = Math.min(this.props.maxSampleCount, Math.round((bbox[3] - bbox[1]) / quadSize));
        const deltaX = (bbox[2] - bbox[0]) / numX;
        const deltaY = (bbox[3] - bbox[1]) / numY;
        let area = 0;
        const elevationCache = new Array(numX * numY);
        for (let iX = 0; iX < numX; ++iX) {
            for (let iY = 0; iY < numY; ++iY) {
                // If quad center lies in polygon, consider it
                const p = [bbox[0] + iX * deltaX, bbox[1] + iY * deltaY];
                const c = [p[0] + 0.5 * deltaX, p[1] + 0.5 * deltaY];
                if (!pointInPolygon(c, coordinates)) {
                    continue;
                }
                // Get elevations
                const z1 = elevationCache[iY * numX + iX] ?? (elevationCache[iY * numX + iX] = this.getElevation(p));
                const z2 = elevationCache[iY * numX + iX + 1] ?? (elevationCache[iY * numX + iX + 1] = this.getElevation([p[0] + deltaX, p[1]]));
                const z3 = elevationCache[(iY + 1) * numX + iX + 1] ?? (elevationCache[(iY + 1) * numX + iX + 1] = this.getElevation([p[0] + deltaX, p[1] + deltaY]));
                const z4 = elevationCache[(iY + 1) * numX + iX] ?? (elevationCache[(iY + 1) * numX + iX] = this.getElevation([p[0], p[1] + deltaY]));
                // Divide quad along diagonal with smaller elevation difference
                const dz1 = Math.abs(z3 - z1);
                const dz2 = Math.abs(z4 - z2);
                if (dz1 < dz2) {
                    const area1 = this.triangleArea([-deltaX, 0, z1 - z2], [0, deltaY, z3 - z2]);
                    const area2 = this.triangleArea([0, -deltaY, z1 - z4], [deltaX, 0, z3 - z4]);
                    area += area1 + area2;
                } else {
                    const area1 = this.triangleArea([deltaX, 0, z2 - z1], [0, deltaY, z4 - z1]);
                    const area2 = this.triangleArea([-deltaX, 0, z4 - z3], [0, -deltaY, z1 - z3]);
                    area += area1 + area2;
                }
            }
        }
        this.setState({result: area});

        // Setup for next measurement
        this.restart();
    };
    measureHeight = (lineString) => {
        if (lineString === null) {
            this.restart();
            return;
        }
        this.clearResult();
        this.measurementObjects.push(lineString);

        // Setup for next measurement
        this.restart();
    };
    getElevation = (point) => {
        return this.props.sceneContext.getTerrainHeightFromMap(point);
    };
    triangleArea = (u, v) => {
        const cross = [u[1] * v[2] - u[2] * v[1], u[0] * v[2] - u[2] * v[0], u[0] * v[1] - u[1] * v[0]];
        return 0.5 * Math.sqrt(cross[0] * cross[0] + cross[1] * cross[1] + cross[2] * cross[2]);
    };
}
