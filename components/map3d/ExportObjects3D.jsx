/**
 * Copyright 2025 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import ColorLayer from '@giro3d/giro3d/core/layer/ColorLayer';
import DrawTool, { conditions } from '@giro3d/giro3d/interactions/DrawTool';
import VectorSource from '@giro3d/giro3d/sources/VectorSource';
import FileSaver from 'file-saver';
import isEmpty from 'lodash.isempty';
import ol from 'openlayers';
import pointInPolygon from 'point-in-polygon';
import PropTypes from 'prop-types';
import {Box3, BufferGeometry, Float32BufferAttribute, Group, Matrix4, Mesh, MeshStandardMaterial, Quaternion, Scene, Vector3} from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';

import {setCurrentTask} from '../../actions/task';
import LocaleUtils from '../../utils/LocaleUtils';
import VectorLayerUtils from '../../utils/VectorLayerUtils';
import SideBar from '../SideBar';
import Spinner from '../widgets/Spinner';


class ExportObjects3D extends React.Component {
    static propTypes = {
        sceneContext: PropTypes.object,
        setCurrentTask: PropTypes.func
    };
    state = {
        selectedFormat: "model/gltf+json",
        minimized: false,
        exporting: false,
        exportPolygon: null
    };
    constructor(props) {
        super(props);
        this.measureTool = null;
        this.drawLayer = null;
    }
    onShow = () => {
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

        this.restart();
    };
    onHide = () => {
        this.abortController.abort();
        this.abortController = null;
        this.measureTool.dispose();
        this.measureTool = null;
        this.props.sceneContext.map.removeLayer(this.drawLayer, {dispose: true});
        this.drawLayer = null;
    };
    formatChanged = (ev) => {
        this.setState({selectedFormat: ev.target.value});
    };
    renderBody = () => {
        const exportDisabled = this.state.exporting || this.state.exportPolygon === null;
        const formatMap = {
            "model/gltf+json": "GLTF"
        };
        return (
            <div className="mapexport-body">
                <form onSubmit={this.exportArea}>
                    <table className="options-table">
                        <tbody>
                            <tr>
                                <td>{LocaleUtils.tr("mapexport.format")}</td>
                                <td>
                                    <select name="FORMAT" onChange={this.formatChanged} value={this.state.selectedFormat}>
                                        {Object.entries(formatMap).map(([format, label]) => (
                                            <option key={format} value={format}>{label}</option>
                                        ))}
                                    </select>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <div className="button-bar">
                        <button className="button" disabled={exportDisabled} type="submit">
                            {this.state.exporting ? (
                                <span className="mapexport-wait"><Spinner /> {LocaleUtils.tr("mapexport.wait")}</span>
                            ) : LocaleUtils.tr("mapexport.submit")}
                        </button>
                    </div>
                </form>
            </div>
        );
    };
    render() {
        return (
            <SideBar extraClasses="MapExport" icon={"export"}
                id="ExportObjects3D" onHide={this.onHide} onShow={this.onShow}
                title={LocaleUtils.tr("appmenu.items.ExportObjects3D")} width="20em"
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
        this.measureTool.createPolygon(options).then(this.selectArea).catch(() => {});
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
        this.setState({exportPolygon: feature.getGeometry().getCoordinates()});

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
    exportArea = (ev) => {
        ev.preventDefault();
        if (this.state.selectedFormat === "model/gltf+json") {
            this.exportToGltf();
        }
    };
    exportToGltf = () => {
        this.setState({exporting: true});
        const bbox = VectorLayerUtils.computeFeatureBBox({type: "Polygon", coordinates: this.state.exportPolygon});
        // Create a bounding box in world space
        const selectionBox = new Box3().setFromPoints([
            new Vector3(bbox[0], bbox[1], 0),
            new Vector3(bbox[2], bbox[3], 8000)
        ]);
        const exportGroup = new Group();
        exportGroup.rotation.set(-Math.PI / 2, 0, 0); // GLTF is Y-UP

        Object.entries(this.props.sceneContext.sceneObjects).forEach(([objectId, options]) => {
            if (!options.layertree || !options.visibility) {
                return;
            }
            const object = this.props.sceneContext.getSceneObject(objectId);
            if (object.tiles) {
                this.addTileToExportGroup(object.tiles, exportGroup, selectionBox);
            } else {
                this.addObjectToExportGroup(object, exportGroup, selectionBox);
            }
        });
        const exportScene = new Scene();
        exportScene.add(exportGroup);
        const exporter = new GLTFExporter();
        exporter.parse(exportScene, (gltf) => {
            const blob = new Blob([JSON.stringify(gltf)], {type: 'application/json'});
            FileSaver.saveAs(blob, "scene.gltf");
            this.setState({exporting: false});
        });
    };
    addTileToExportGroup = (tiles, exportGroup, selectionBox) => {
        tiles.group.traverse( c => {
            if (c.geometry) {
                const bbox = c.geometry.boundingBox.applyMatrix4(c.matrixWorld);
                if (!selectionBox.intersectsBox(bbox)) {
                    return;
                }
                const batchidAttr = c.geometry.getAttribute( '_batchid' );
                const posAttr = c.geometry.getAttribute('position');
                const norAttr = c.geometry.getAttribute('normal');
                const batches = {};
                batchidAttr.array.forEach((batchId, idx) => {
                    if (!batches[batchId]) {
                        batches[batchId] = {
                            position: [],
                            normal: [],
                            bbox: new Box3()
                        };
                    }
                    const pos = posAttr.array.slice(3 * idx, 3 * idx + 3);
                    const nor = norAttr.array.slice(3 * idx, 3 * idx + 3);
                    batches[batchId].position.push(...pos);
                    batches[batchId].normal.push(...nor);
                    batches[batchId].bbox.expandByPoint(new Vector3(...pos).applyMatrix4(c.matrixWorld));
                });
                Object.values(batches).forEach(batch => {
                    if (
                        selectionBox.intersectsBox(batch.bbox) &&
                        this.bboxInExportPolygon(batch.bbox)
                    ) {
                        // Express coordinates wrt center of batch object bbox
                        const prevPosition = new Vector3();
                        c.matrixWorld.decompose(prevPosition, new Quaternion(), new Vector3());
                        const newPosition = new Vector3();
                        batch.bbox.getCenter(newPosition);
                        const offset = new Vector3().subVectors(newPosition, prevPosition);
                        for (let i = 0; i < batch.position.length / 3; ++i) {
                            batch.position[3 * i + 0] -= offset.x;
                            batch.position[3 * i + 1] -= offset.y;
                            batch.position[3 * i + 2] -= offset.z;
                        }
                        // Construct mesh
                        const material = new MeshStandardMaterial({color: 0xffffff});
                        const geometry = new BufferGeometry();
                        geometry.setAttribute('position', new Float32BufferAttribute(batch.position, 3));
                        geometry.setAttribute('normal', new Float32BufferAttribute(batch.normal, 3));
                        const mesh = new Mesh(geometry, material);
                        mesh.applyMatrix4(c.matrixWorld.clone().multiply(new Matrix4().makeTranslation(offset)));
                        exportGroup.add(mesh);
                    }
                });
            }
        });
    };
    addObjectToExportGroup = (object, exportGroup, selectionBox) => {
        object.children.forEach(child => {
            const objBox = new Box3().setFromObject(child);
            if (
                selectionBox.intersectsBox(objBox) &&
                this.bboxInExportPolygon(objBox)
            ) {
                exportGroup.add(child.clone());
            }
        });
    };
    bboxInExportPolygon = (box3) => {
        const polygon = this.state.exportPolygon[0];

        const [xmin, ymin, xmax, ymax] = [box3.min.x, box3.min.y, box3.max.x, box3.max.y];

        function doLinesIntersect(p1, p2, p3, p4) {
            // Helper function to check if two line segments (p1-p2 and p3-p4) intersect
            function ccw(A, B, C) {
                return (C[1] - A[1]) * (B[0] - A[0]) > (B[1] - A[1]) * (C[0] - A[0]);
            }
            return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
        }

        // Check if any bbox vertex is inside the polygon
        if (
            pointInPolygon([xmin, ymin], polygon) ||
            pointInPolygon([xmax, ymin], polygon) ||
            pointInPolygon([xmax, ymax], polygon) ||
            pointInPolygon([xmax, ymin], polygon)
        ) {
            return true;
        }

        // Check if any edge of the polygon intersects the bbox
        for (let i = 0; i < polygon.length - 1; i++) {
            const [x1, y1] = polygon[i];
            const [x2, y2] = polygon[i + 1];

            if (
                doLinesIntersect([x1, y1], [x2, y2], [xmin, ymin], [xmin, ymax]) ||
                doLinesIntersect([x1, y1], [x2, y2], [xmin, ymax], [xmax, ymax]) ||
                doLinesIntersect([x1, y1], [x2, y2], [xmax, ymax], [xmax, ymin]) ||
                doLinesIntersect([x1, y1], [x2, y2], [xmax, ymin], [xmin, ymin])
            ) {
                return true;
            }
        }
        return false;
    };
}

export default connect((state) => ({
    theme: state.theme.current
}), {
    setCurrentTask: setCurrentTask
})(ExportObjects3D);
