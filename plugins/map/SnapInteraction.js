/**
 * Copyright Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ol from 'openlayers';

export default class SnapInteraction extends ol.interaction.Snap {
    constructor(options) {
        super(options);
        this.perpendicular_ = options.perpendicular;
        this.layer = new ol.layer.Vector({
            source: new ol.source.Vector(),
            zIndex: Infinity
        });
        this.currentMap = null;
        this.currentDrawInteraction = null;
        this.currentModifyInteraction = null;
        this.perpendicularSnapReferences = [];

        const perpSymbol = '<svg width="16" height="16" version="1.1" xmlns="http://www.w3.org/2000/svg"><path d="m2 13h12m-6-11v12" stroke="#F00" stroke-width="2"/></svg>';
        this.perpSnapStyle = new ol.style.Style({
            image: new ol.style.Icon({
                src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(perpSymbol)}`,
                anchor: [-0.75, 0.75],
                imgSize: [16, 16]
            })
        });
        this.segmentSnapStyle = new ol.style.Style({
            image: new ol.style.RegularShape({
                stroke: new ol.style.Stroke({color: '#FF0000', width: 3}),
                points: 4,
                radius: 14,
                angle: Math.PI / 4
            })
        });
        this.vertexSnapStyle = new ol.style.Style({
            image: new ol.style.Circle({
                stroke: new ol.style.Stroke({color: '#FF0000', width: 3}),
                radius: 10
            })
        });
    }
    handleEvent(evt) {
        let result = this.snapTo(evt.pixel, evt.coordinate, evt.map);
        result = this.perpendicularSnap(evt, result);

        this.layer.getSource().clear();
        if (result) {
            evt.coordinate = result.vertex.slice(0, 2);
            evt.pixel = result.vertexPixel;
            const feature = new ol.Feature({
                geometry: new ol.geom.Point(evt.coordinate)
            });
            if (result.perpendicular) {
                feature.setStyle(this.perpSnapStyle);
            } else if (result.segment) {
                feature.setStyle(this.segmentSnapStyle);
            } else {
                feature.setStyle(this.vertexSnapStyle);
            }
            this.layer.getSource().addFeature(feature);
        }
        return ol.interaction.Pointer.prototype.handleEvent.call(this, evt);
    }
    perpendicularSnap(evt, snapResult) {
        if (!this.perpendicular_) {
            return snapResult;
        }
        const coo = snapResult?.vertex ?? evt.coordinate;
        const pixel = snapResult?.vertexPixel ?? evt.pixel;

        const perpSnap = this.perpendicularSnapReferences.reduce((res, ref) => {
            // Vector from drawing start to mouse
            const dir = [coo[0] - ref.point[0], coo[1] - ref.point[1]];
            // Project onto the perpendicular direction
            const dot = dir[0] * ref.dir[0] + dir[1] * ref.dir[1];
            const proj = [ref.point[0] + dot * ref.dir[0], ref.point[1] + dot * ref.dir[1]];
            const projPixel = this.currentMap.getPixelFromCoordinate(proj);
            // Screen-space distance from mouse to projected point
            const dist = Math.hypot(pixel[0] - projPixel[0], pixel[1] - projPixel[1]);
            return dist < res.dist ? {dist, proj, projPixel, dir: ref.dir} : res;
        }, {dist: Infinity, proj: null, projPixel: null, dir: null});
        if (perpSnap.dist < this.pixelTolerance_) {
            if (snapResult?.segment) {
                // Intersect snap segment with perpendicular direction
                const s0 = snapResult.segment[0];
                const s1 = snapResult.segment[1];
                const p = perpSnap.proj;
                const [dx, dy] = perpSnap.dir;
                const sx = s1[0] - s0[0];
                const sy = s1[1] - s0[1];
                const d = sx * dy - sy * dx;
                if (Math.abs(d) > 1e-6) {
                    const t = ((p[0] - s0[0]) * dy - (p[1] - s0[1]) * dx) / d;
                    if (t >= 0 && t <= 1) {
                        const q = [s0[0] + t * sx, s0[1] + t * sy];
                        const pPixel = perpSnap.projPixel;
                        const qPixel = this.currentMap.getPixelFromCoordinate(q);
                        // Only consider perpendicular snap if perpendicular position on snapped segment isn't further away than tolerance
                        if (Math.hypot(qPixel[0] - pPixel[0], qPixel[1] - pPixel[1]) < this.pixelTolerance_) {
                            return {
                                ...snapResult,
                                perpendicular: true,
                                vertex: q,
                                vertexPixel: this.currentMap.getPixelFromCoordinate(q)
                            };
                        }
                    }
                }
            } else {
                return {
                    ...snapResult,
                    perpendicular: true,
                    vertex: perpSnap.proj,
                    vertexPixel: perpSnap.projPixel
                };
            }
        }
        return snapResult;
    }
    setMap(map) {
        if (map) {
            map.addLayer(this.layer);
            this.currentMap = map;
        } else if (this.currentMap) {
            this.currentMap.removeLayer(this.layer);
            this.currentMap = null;
        }
        super.setMap(map);
    }
    setActive(active) {
        if (this.layer) {
            this.layer.setVisible(active);
        }
        super.setActive(active);
    }
    setSnapEdge(snap) {
        this.edge_ = snap;
    }
    setSnapVertex(snap) {
        this.vertex_ = snap;
    }
    setSnapIntersection(snap) {
        this.intersection_ = snap;
    }
    setSnapPerpendicular(snap) {
        this.perpendicular_ = snap;
    }
    attach() {
        this.perpendicularSnapReferences = [];
        if (this.currentMap) {
            const interactions = this.currentMap.getInteractions();
            for (let i = 0; i < interactions.getLength(); ++i) {
                const interaction = interactions.item(i);
                if (interaction instanceof ol.interaction.Draw) {
                    this.currentDrawInteraction = interaction;
                    this.currentDrawInteraction.on('vertexadded', this.onVertexAdded);
                } else if (interaction instanceof ol.interaction.Modify) {
                    this.currentModifyInteraction = interaction;
                    this.currentModifyInteraction.on('modifystart', this.onModifyStart);
                }
            }
        }
    }
    detach() {
        this.perpendicularSnapReferences = [];
        if (this.currentDrawInteraction) {
            this.currentDrawInteraction.un('vertexadded', this.onVertexAdded);
            this.currentDrawInteraction = null;
        } else if (this.currentModifyInteraction) {
            this.currentModifyInteraction.un('modifystart', this.onModifyStart);
            this.currentModifyInteraction = null;
        }
    }
    onVertexAdded = (data) => {
        this.perpendicularSnapReferences = [];
        this.computePerpendicularSnapReference(data.coordinate);
    };
    onModifyStart = (data) => {
        // Don't gather perpendicular snapping references on itself
        data.features.forEach(f => this.removeFeature(f));
        this.perpendicularSnapReferences = [];
        (data.target?.dragSegments_ ?? []).forEach(entry => {
            const coo = entry[0].segment[1 - entry[1]];
            this.computePerpendicularSnapReference(coo);
        });
        data.features.forEach(f => this.addFeature(f));
    };
    computePerpendicularSnapReference = (coo) => {
        // If added vertex lies on a segment, store perpendicular direction for perpendicular snapping
        const pixel = this.currentMap.getPixelFromCoordinate(coo);
        const result = this.snapTo(pixel, coo, this.currentMap);
        if (result?.segment) {
            const p1 = result.segment[0];
            const p2 = result.segment[1];
            const l = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
            if (l > 0) {
                this.perpendicularSnapReferences.push({
                    dir: [(p2[1] - p1[1]) / l, (p1[0] - p2[0]) / l],
                    point: [...result.vertex]
                });
            }
        }
    };
}
