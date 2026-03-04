/**
 * Copyright 2026 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import IdentifyUtils from "./IdentifyUtils";
import VectorLayerUtils from "./VectorLayerUtils";

export class FeatureSnapIndex {
    constructor(themeLayer, snapLayers, mapCrs, featureGridSize = 500, snapGridSize = 10) {
        this.featureGridSize = featureGridSize;
        this.featureGrid = new Map();
        this.themeLayer = themeLayer;
        this.snapLayers = snapLayers.join(",");
        this.mapCrs = mapCrs;
        this.requestOptions = {
            LAYERATTRIBS: JSON.stringify(snapLayers.reduce((res, key) => ({...res, [key]: []}), {}) ),
            with_htmlcontent: false,
            with_bbox: false,
            feature_count: 500
        };

        this.featureIds = new Set();
        this.snapGridSize = snapGridSize;
        this.nodeGrid = new Map();
        this.edgeGrid = new Map();
    }
    haveSnapLayers = () => {
        return !!this.snapLayers;
    };
    loadArea = (bbox) => {
        if (!this.snapLayers) {
            return;
        }
        const ox = Math.floor(bbox[0] / this.featureGridSize) * this.featureGridSize;
        const oy = Math.floor(bbox[1] / this.featureGridSize) * this.featureGridSize;
        for (let cx = ox; cx < bbox[2]; cx += this.featureGridSize) {
            for (let cy = oy; cy < bbox[3]; cy += this.featureGridSize) {
                const key = `${cx / this.featureGridSize},${cy / this.featureGridSize}`;
                if (!this.featureGrid.has(key)) {
                    const [xmin, ymin, xmax, ymax] = [cx, cy, cx + this.featureGridSize, cy + this.featureGridSize];
                    const filterGeom = VectorLayerUtils.geoJSONGeomToWkt({
                        type: 'Polygon',
                        coordinates: [[
                            [xmin, ymin],
                            [xmax, ymin],
                            [xmax, ymax],
                            [xmin, ymax],
                            [xmin, ymin]
                        ]]
                    }, 0);

                    const request = IdentifyUtils.buildFilterRequest(this.themeLayer, this.snapLayers, filterGeom, {projection: this.mapCrs}, this.requestOptions);
                    IdentifyUtils.sendRequest(request, (response) => {
                        if (response) {
                            const result = IdentifyUtils.parseXmlResponse(response, this.mapCrs, this.themeLayer);
                            const features = Object.values(result).reduce((res, cur) => [...res, ...cur], []);
                            features.forEach(this._addFeature);
                        }
                    });
                    this.featureGrid.set(key, 1);
                }
            }
        }
    };
    snapToNode = (pos, tolerance = Infinity) => {
        const key = this._cellKey(pos[0], pos[1]);
        const neighbors = this.nodeGrid.get(key) || [];

        let closest = null;
        let minDistSq = tolerance * tolerance;

        for (const node of neighbors) {
            const dx = node[0] - pos[0];
            const dy = node[1] - pos[1];
            const distSq = dx * dx + dy * dy;
            if (distSq < minDistSq) {
                minDistSq = distSq;
                closest = node;
            }
        }
        return closest;
    };
    snapToEdge = (pos, tolerance = Infinity) => {
        const key = this._cellKey(pos[0], pos[1]);
        const candidates = this.edgeGrid.get(key) || [];

        let closestPoint = null;
        let minDistSq = tolerance * tolerance;

        for (const [a, b] of candidates) {
            const point = this._closestPointOnSegment(pos, a, b);
            const dx = point[0] - pos[0];
            const dy = point[1] - pos[1];
            const distSq = dx * dx + dy * dy;
            if (distSq < minDistSq) {
                minDistSq = distSq;
                closestPoint = point;
            }
        }
        return closestPoint;
    };
    raycast = (origin, dir, maxDistance) => {
        let cx = Math.floor(origin[0] / this.snapGridSize);
        let cy = Math.floor(origin[1] / this.snapGridSize);

        const stepX = dir[0] > 0 ? 1 : -1;
        const stepY = dir[1] > 0 ? 1 : -1;

        const nextBoundaryX = (cx + (stepX > 0 ? 1 : 0)) * this.snapGridSize;
        const nextBoundaryY = (cy + (stepY > 0 ? 1 : 0)) * this.snapGridSize;

        let tMaxX = dir[0] !== 0 ? (nextBoundaryX - origin[0]) / dir[0] : Infinity;
        let tMaxY = dir[1] !== 0 ? (nextBoundaryY - origin[1]) / dir[1] : Infinity;

        const tDeltaX = dir[0] !== 0 ? this.snapGridSize * Math.abs(1 / dir[0]) : Infinity;
        const tDeltaY = dir[1] !== 0 ? this.snapGridSize * Math.abs(1 / dir[1]) : Infinity;

        let bestT = maxDistance;
        let bestHit = null;

        const visitedEdges = new Set();

        while (true) {
            const key = `${cx},${cy}`;
            const edges = this.edgeGrid.get(key) || [];

            for (const edge of edges) {
                if (visitedEdges.has(edge)) continue;
                visitedEdges.add(edge);

                const t = this._raySegmentIntersection(origin, dir, edge[0], edge[1]);
                if (t !== null && t >= 0 && t < bestT) {
                    bestT = t;
                    bestHit = {
                        distance: t,
                        point: [
                            origin[0] + dir[0] * t,
                            origin[1] + dir[1] * t
                        ],
                        edge
                    };
                }
            }

            if (tMaxX < tMaxY) {
                if (tMaxX > bestT || tMaxX > maxDistance) break;
                cx += stepX;
                tMaxX += tDeltaX;
            } else {
                if (tMaxY > bestT || tMaxY > maxDistance) break;
                cy += stepY;
                tMaxY += tDeltaY;
            }
        }

        return bestHit;
    };
    _cellKey = (x, y) => {
        const cx = Math.floor(x / this.snapGridSize);
        const cy = Math.floor(y / this.snapGridSize);
        return `${cx},${cy}`;
    };
    _cellsForEdge = (a, b) => {
        // bounding box of edge
        const minX = Math.min(a[0], b[0]);
        const minY = Math.min(a[1], b[1]);
        const maxX = Math.max(a[0], b[0]);
        const maxY = Math.max(a[1], b[1]);

        const cells = [];
        const startX = Math.floor(minX / this.snapGridSize);
        const endX = Math.floor(maxX / this.snapGridSize);
        const startY = Math.floor(minY / this.snapGridSize);
        const endY = Math.floor(maxY / this.snapGridSize);

        for (let cx = startX; cx <= endX; cx++) {
            for (let cy = startY; cy <= endY; cy++) {
                cells.push(`${cx},${cy}`);
            }
        }
        return cells;
    };
    _addNode = (pos) => {
        const key = this._cellKey(pos[0], pos[1]);
        if (!this.nodeGrid.has(key)) this.nodeGrid.set(key, []);
        this.nodeGrid.get(key).push(pos);
    };
    _addEdge = (a, b) => {
        const cells = this._cellsForEdge(a, b);
        const edge = [a, b];
        for (const key of cells) {
            if (!this.edgeGrid.has(key)) this.edgeGrid.set(key, []);
            this.edgeGrid.get(key).push(edge);
        }
    };
    _addGeometry = (geomType, coords) => {
        if (geomType === "Point") {
            this._addNode(coords);
        } else if (geomType === "LineString") {
            this._addNode(coords[0]);
            for (let i = 1; i < coords.length; ++i) {
                this._addEdge(coords[i - 1], coords[i]);
                this._addNode(coords[i]);
            }
        } else if (geomType === "Polygon") {
            coords.forEach(ring => {
                this._addNode(ring[0]);
                for (let i = 1; i < ring.length; ++i) {
                    this._addEdge(ring[i - 1], ring[i]);
                    this._addNode(ring[i]);
                }
            });
        }
    };
    _addFeature = (feature) => {
        if (this.featureIds.has(feature.id) || !feature.geometry) {
            return;
        }
        this.featureIds.add(feature.id);
        const geomType = feature.geometry.type;
        const coords = feature.geometry.coordinates;
        if (geomType.startsWith("Multi")) {
            coords.forEach(part => this._addGeometry(geomType.slice(5), part));
        } else {
            this._addGeometry(geomType, coords);
        }
    };
    _closestPointOnSegment = (p, a, b) => {
        const abx = b[0] - a[0];
        const aby = b[1] - a[1];
        const t = ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / (abx * abx + aby * aby);
        const clampedT = Math.max(0, Math.min(1, t));
        return [
            a[0] + abx * clampedT,
            a[1] + aby * clampedT
        ];
    };
    _raySegmentIntersection = (origin, dir, a, b) => {
        const vx = b[0] - a[0];
        const vy = b[1] - a[1];

        const det = (-dir[0] * vy + dir[1] * vx);
        if (Math.abs(det) < 1e-9) return null;

        const s = (-vy * (a[0] - origin[0]) + vx * (a[1] - origin[1])) / det;
        const t = ( dir[0] * (a[1] - origin[1]) - dir[1] * (a[0] - origin[0])) / det;

        if (s >= 0 && t >= 0 && t <= 1) return s;
        return null;
    };
}
