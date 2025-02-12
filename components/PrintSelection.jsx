/**
 * Copyright 2024 Stadtwerke München GmbH
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import isEqual from 'lodash.isequal';
import ol from 'openlayers';
import PropTypes from 'prop-types';

import FeatureStyles from '../utils/FeatureStyles';
import MapUtils from '../utils/MapUtils';


export default class PrintSelection extends React.Component {
    static propTypes = {
        allowRotation: PropTypes.bool,
        allowScaling: PropTypes.bool,
        allowTranslation: PropTypes.bool,
        center: PropTypes.arrayOf(PropTypes.number),
        fixedFrame: PropTypes.shape({
            width: PropTypes.number, // in meters
            height: PropTypes.number // in meters
        }),
        geometryChanged: PropTypes.func,
        printSeriesChanged: PropTypes.func,
        printSeriesEnabled: PropTypes.bool,
        printSeriesGridSize: PropTypes.number,
        printSeriesOverlap: PropTypes.number,
        printSeriesSelected: PropTypes.arrayOf(PropTypes.string),
        rotation: PropTypes.number,
        scale: PropTypes.number
    };
    static defaultProps = {
        allowRotation: true,
        allowScaling: true,
        allowTranslation: true,
        fixedFrame: null,
        geometryChanged: () => {},
        printSeriesChanged: () => {},
        printSeriesEnabled: false,
        printSeriesGridSize: 2,
        printSeriesOverlap: 0,
        printSeriesSelected: [],
        rotation: 0,
        scale: 1000
    };
    constructor(props) {
        super(props);

        this.map = MapUtils.getHook(MapUtils.GET_MAP);

        // create a layer to draw on
        this.source = new ol.source.Vector();
        this.selectionLayer = new ol.layer.Vector({
            source: this.source,
            zIndex: 1000000,
            style: this.layerStyle
        });

        // create a geometry for the background feature
        const extent = this.map.getView().getProjection().getExtent() ?? [
            Number.MIN_SAFE_INTEGER,
            Number.MIN_SAFE_INTEGER,
            Number.MAX_SAFE_INTEGER,
            Number.MAX_SAFE_INTEGER
        ];
        const geometry = ol.geom.polygonFromExtent(extent);

        this.backgroundFeature = new ol.Feature(geometry);
        this.source.addFeature(this.backgroundFeature);

        this.printSeriesFeature = new ol.Feature(geometry);
        this.source.addFeature(this.printSeriesFeature);

        this.feature = null;
        this.initialWidth = null;
        this.initialHeight = null;
        this.seriesGeometries = [];

        this.translateInteraction = null;
        this.scaleRotateInteraction = null;
        this.selectPrintSeriesInteraction = null;
        this.drawInteraction = null;

        this.isInteracting = false;
    }
    componentDidUpdate(prevProps) {
        if (
            !isEqual(prevProps.fixedFrame, this.props.fixedFrame) ||
            !isEqual(prevProps.center, this.props.center) ||
            prevProps.rotation !== this.props.rotation ||
            prevProps.scale !== this.props.scale
        ) {
            if (!this.isInteracting) {
                this.recomputeFeature();
            }
        }
        if (
            prevProps.printSeriesEnabled !== this.props.printSeriesEnabled ||
            prevProps.printSeriesOverlap !== this.props.printSeriesOverlap ||
            prevProps.printSeriesSelected !== this.props.printSeriesSelected
        ) {
            this.geometryChanged();
        }
    }
    recomputeFeature() {
        // delete the old feature
        if (this.feature !== null) {
            // remove old feature
            this.source.removeFeature(this.feature);
            this.feature = null;
            this.initialWidth = null;
            this.initialHeight = null;
            this.seriesGeometries = [];
        }
        // render the current feature if given a fixed frame
        if (this.props.fixedFrame !== null) {
            // calculate actual width and height
            const {width, height} = MapUtils.transformExtent(
                this.map.getView().getProjection(),
                this.props.center,
                this.props.fixedFrame.width,
                this.props.fixedFrame.height
            );
            // add rectangle
            const x1 = this.props.center[0] + 0.5 * width;
            const x2 = this.props.center[0] - 0.5 * width;
            const y1 = this.props.center[1] + 0.5 * height;
            const y2 = this.props.center[1] - 0.5 * height;
            const geometry = new ol.geom.Polygon([
                [
                    [x1, y1],
                    [x1, y2],
                    [x2, y2],
                    [x2, y1],
                    [x1, y1]
                ]
            ]);
            // rotate and scale rectangle
            if (this.props.rotation) {
                geometry.rotate(this.props.rotation * Math.PI / 180, this.props.center);
            }
            if (this.props.scale) {
                geometry.scale(this.props.scale / 1000, undefined, this.props.center);
            }
            // add feature to layer
            this.feature = new ol.Feature(geometry);
            this.feature.on('change', this.geometryChanged);
            this.source.addFeature(this.feature);
            // store initial width and height for future updates
            this.initialWidth = width;
            this.initialHeight = height;
            // update geometry to new extent
            this.geometryChanged();
        }
    }
    componentDidMount() {
        this.map.addLayer(this.selectionLayer);
        this.addInteractions();
        this.recomputeFeature();
    }
    componentWillUnmount() {
        this.map.removeLayer(this.selectionLayer);
        this.removeInteractions();
    }
    addInteractions() {
        // move the selection
        const translateCondition = (ev) => {
            return ol.events.condition.primaryAction(ev)
                && this.props.fixedFrame
                && this.props.allowTranslation;
        };
        this.translateInteraction = new ol.interaction.Translate({
            condition: translateCondition,
            // add condition to filter for correct cursor selection
            filter: feature => this.props.fixedFrame && this.props.allowTranslation && feature === this.feature,
            layers: [this.selectionLayer]
        });
        this.translateInteraction.on('translatestart', () => {
            this.isInteracting = true;
        });
        this.translateInteraction.on('translateend', () => {
            this.isInteracting = false;
        });

        // scale and rotate the selection
        const modifyCondition = (ev) => {
            return ol.events.condition.primaryAction(ev)
                && this.props.fixedFrame
                && (this.props.allowScaling || this.props.allowRotation);
        };
        this.scaleRotateInteraction = new ol.interaction.Modify({
            source: this.source,
            condition: modifyCondition,
            deleteCondition: ol.events.condition.never,
            insertVertexCondition: ol.events.condition.never,
            pixelTolerance: 20,
            style: this.scaleRotateStyle
        });
        this.scaleRotateInteraction.on('modifystart', (ev) => {
            this.isInteracting = true;
            this.map.getViewport().style.cursor = 'grabbing';
            ev.features.forEach((feature) => {
                feature.set(
                    'modifyGeometry',
                    {geometry: feature.getGeometry().clone()},
                    true,
                );
            });
        });
        this.scaleRotateInteraction.on('modifyend', (ev) => {
            this.isInteracting = false;
            this.map.getViewport().style.cursor = '';
            ev.features.forEach((feature) => {
                const modifyGeometry = feature.get('modifyGeometry');
                if (modifyGeometry) {
                    feature.setGeometry(modifyGeometry.geometry);
                    feature.unset('modifyGeometry', true);
                }
            });
        });

        // select frames for printing a series
        this.selectPrintSeriesInteraction = new ol.interaction.Select({
            filter: feature => feature === this.printSeriesFeature,
            layers: [this.selectionLayer],
            condition: ol.events.condition.click,
            addCondition: ol.events.condition.always,
            removeCondition: ol.events.condition.always,
            style: null
        });
        this.selectPrintSeriesInteraction.on('select', (ev) => {
            const coordinate = ev.mapBrowserEvent.coordinate;
            const intersecting = this.seriesGeometries.find((entry) => !isEqual(entry.index, [0, 0]) && entry.geometry.intersectsCoordinate(coordinate));

            if (intersecting) {
                let selected = this.props.printSeriesSelected;
                if (selected.includes(intersecting.index.join(','))) {
                    selected = selected.filter(index => index !== intersecting.index.join(','));
                } else {
                    selected = [...selected, intersecting.index.join(',')];
                }
                this.props.printSeriesChanged(selected);
            }
        });

        // select a new area when no frame is given (only added when no fixed frame is given)
        const drawCondition = (ev) => {
            return ol.events.condition.primaryAction(ev)
                && !this.props.fixedFrame;
        };
        this.drawInteraction = new ol.interaction.Draw({
            source: this.source,
            type: 'Circle',
            style: FeatureStyles.printInteraction(),
            geometryFunction: ol.interaction.createBox(),
            condition: ol.events.condition.never,
            freehandCondition: drawCondition
        });
        this.drawInteraction.on('drawstart', (ev) => {
            this.isInteracting = true;
            this.feature = ev.feature;
            this.feature.on('change', this.geometryChanged);
        });
        this.drawInteraction.on('drawend', () => {
            this.isInteracting = false;
            this.geometryChanged();
        });

        // register interactions
        this.map.addInteraction(this.translateInteraction);
        this.map.addInteraction(this.scaleRotateInteraction);
        this.map.addInteraction(this.selectPrintSeriesInteraction);
        this.map.addInteraction(this.drawInteraction);
    }
    removeInteractions() {
        if (this.translateInteraction !== null) {
            this.map.removeInteraction(this.translateInteraction);
            this.translateInteraction = null;
        }
        if (this.scaleRotateInteraction !== null) {
            this.map.removeInteraction(this.scaleRotateInteraction);
            this.scaleRotateInteraction = null;
        }
        if (this.selectPrintSeriesInteraction !== null) {
            this.map.removeInteraction(this.selectPrintSeriesInteraction);
            this.selectPrintSeriesInteraction = null;
        }
        if (this.drawInteraction !== null) {
            this.map.removeInteraction(this.drawInteraction);
            this.drawInteraction = null;
        }
    }
    getGeometry = () => {
        const modifyGeometry = this.feature.get('modifyGeometry');
        return modifyGeometry ? modifyGeometry.geometry : this.feature.getGeometry();
    };
    getBackgroundGeometry = (feature) => {
        const background = feature.getGeometry().clone();

        if (this.feature !== null) {
            const geom = this.getGeometry().clone();

            // ignore degenerate geometries
            if (geom.getArea() === 0) {
                return background;
            }

            // make the current selection transparent
            background.appendLinearRing(geom.getLinearRing(0));

            // add the origin to the selected tiles
            const selected = ['0,0', ...this.props.printSeriesSelected];

            // make the selected series transparent
            this.seriesGeometries.filter(this.isPrintSeriesSelected).forEach((entry) => {
                // add the inner part of the tile
                const clonedGeom = entry.geometry.clone();
                clonedGeom.scale(1 - 2 * this.props.printSeriesOverlap);
                background.appendLinearRing(clonedGeom.getLinearRing(0));

                // clone the original geometry and rotate it
                const clonedGeomBase = entry.geometry.clone();
                const center = ol.extent.getCenter(clonedGeomBase.getExtent());
                clonedGeomBase.rotate(entry.rotation, center);
                const extent = clonedGeomBase.getExtent();

                // create the geometries for the overlapping borders
                const clonedGeomLeft = clonedGeomBase.clone();
                const centerLeft = [extent[0], 0.5 * (extent[1] + extent[3])];
                clonedGeomLeft.scale(this.props.printSeriesOverlap, 1 - 2 * this.props.printSeriesOverlap, centerLeft);
                clonedGeomLeft.rotate(-entry.rotation, center);

                const clonedGeomRight = clonedGeomBase.clone();
                const centerRight = [extent[2], 0.5 * (extent[1] + extent[3])];
                clonedGeomRight.scale(this.props.printSeriesOverlap, 1 - 2 * this.props.printSeriesOverlap, centerRight);
                clonedGeomRight.rotate(-entry.rotation, center);

                const clonedGeomBottom = clonedGeomBase.clone();
                const centerBottom = [0.5 * (extent[0] + extent[2]), extent[1]];
                clonedGeomBottom.scale(1 - 2 * this.props.printSeriesOverlap, this.props.printSeriesOverlap, centerBottom);
                clonedGeomBottom.rotate(-entry.rotation, center);

                const clonedGeomTop = clonedGeomBase.clone();
                const centerTop = [0.5 * (extent[0] + extent[2]), extent[3]];
                clonedGeomTop.scale(1 - 2 * this.props.printSeriesOverlap, this.props.printSeriesOverlap, centerTop);
                clonedGeomTop.rotate(-entry.rotation, center);

                // create the geometries for the overlapping corners
                const clonedGeomBottomLeft = clonedGeomBase.clone();
                const bottomLeft = [extent[0], extent[1]];
                clonedGeomBottomLeft.scale(this.props.printSeriesOverlap, this.props.printSeriesOverlap, bottomLeft);
                clonedGeomBottomLeft.rotate(-entry.rotation, center);

                const clonedGeomBottomRight = clonedGeomBase.clone();
                const bottomRight = [extent[2], extent[1]];
                clonedGeomBottomRight.scale(this.props.printSeriesOverlap, this.props.printSeriesOverlap, bottomRight);
                clonedGeomBottomRight.rotate(-entry.rotation, center);

                const clonedGeomTopLeft = clonedGeomBase.clone();
                const topLeft = [extent[0], extent[3]];
                clonedGeomTopLeft.scale(this.props.printSeriesOverlap, this.props.printSeriesOverlap, topLeft);
                clonedGeomTopLeft.rotate(-entry.rotation, center);

                const clonedGeomTopRight = clonedGeomBase.clone();
                const topRight = [extent[2], extent[3]];
                clonedGeomTopRight.scale(this.props.printSeriesOverlap, this.props.printSeriesOverlap, topRight);
                clonedGeomTopRight.rotate(-entry.rotation, center);

                // calculate the neighbours of the current tile
                const topNeighbour = [entry.index[0] - 1, entry.index[1]].join(',');
                const bottomNeighbour = [entry.index[0] + 1, entry.index[1]].join(',');
                const leftNeighbour = [entry.index[0], entry.index[1] - 1].join(',');
                const rightNeighbour = [entry.index[0], entry.index[1] + 1].join(',');

                const topLeftNeighbour = [entry.index[0] - 1, entry.index[1] - 1].join(',');
                const topRightNeighbour = [entry.index[0] - 1, entry.index[1] + 1].join(',');
                const bottomLeftNeighbour = [entry.index[0] + 1, entry.index[1] - 1].join(',');
                const bottomRightNeighbour = [entry.index[0] + 1, entry.index[1] + 1].join(',');

                // Each tile is responsible to draw its border facing away from the origin.

                // left border
                if (!selected.includes(leftNeighbour) || entry.index[1] <= 0) {
                    background.appendLinearRing(clonedGeomLeft.getLinearRing(0));
                }
                // right border
                if (!selected.includes(rightNeighbour) || entry.index[1] >= 0) {
                    background.appendLinearRing(clonedGeomRight.getLinearRing(0));
                }
                // top border
                if (!selected.includes(topNeighbour) || entry.index[0] <= 0) {
                    background.appendLinearRing(clonedGeomTop.getLinearRing(0));
                }
                // bottom border
                if (!selected.includes(bottomNeighbour) || entry.index[0] >= 0) {
                    background.appendLinearRing(clonedGeomBottom.getLinearRing(0));
                }

                // The corners are drawn by the tile facing away from the origin, and in counter-clockwise order.

                // top-left corner
                if ((entry.index[0] <= 0 && entry.index[1] <= 0)
                    || (entry.index[0] <= 0 && !selected.includes(leftNeighbour))
                    || (entry.index[1] <= 0 && !selected.includes(topNeighbour) && !selected.includes(topLeftNeighbour))
                    || (!selected.includes(leftNeighbour) && !selected.includes(topNeighbour) && !selected.includes(topLeftNeighbour))
                ) {
                    background.appendLinearRing(clonedGeomTopLeft.getLinearRing(0));
                }
                // top-right corner
                if ((entry.index[0] <= 0 && entry.index[1] >= 0)
                    || (entry.index[0] <= 0 && !selected.includes(rightNeighbour))
                    || (entry.index[1] >= 0 && !selected.includes(topNeighbour) && !selected.includes(topRightNeighbour))
                    || (!selected.includes(rightNeighbour) && !selected.includes(topNeighbour) && !selected.includes(topRightNeighbour))
                ) {
                    background.appendLinearRing(clonedGeomTopRight.getLinearRing(0));
                }
                // bottom-left corner
                if ((entry.index[0] >= 0 && entry.index[1] <= 0)
                    || (entry.index[0] >= 0 && !selected.includes(leftNeighbour))
                    || (entry.index[1] <= 0 && !selected.includes(bottomNeighbour) && !selected.includes(bottomLeftNeighbour))
                    || (!selected.includes(leftNeighbour) && !selected.includes(bottomNeighbour) && !selected.includes(bottomLeftNeighbour))
                ) {
                    background.appendLinearRing(clonedGeomBottomLeft.getLinearRing(0));
                }
                // bottom-right corner
                if ((entry.index[0] >= 0 && entry.index[1] >= 0)
                    || (entry.index[0] >= 0 && !selected.includes(rightNeighbour))
                    || (entry.index[1] >= 0 && !selected.includes(bottomNeighbour) && !selected.includes(bottomRightNeighbour))
                    || (!selected.includes(rightNeighbour) && !selected.includes(bottomNeighbour) && !selected.includes(bottomRightNeighbour))
                ) {
                    background.appendLinearRing(clonedGeomBottomRight.getLinearRing(0));
                }
            });
        }

        return background;
    };
    calculateSeriesGeometries = () => {
        const featureGeometry = this.getGeometry();
        const coordinates = featureGeometry.getCoordinates()[0];
        const dx1 = coordinates[1][0] - coordinates[2][0];
        const dy1 = coordinates[1][1] - coordinates[2][1];
        const dx2 = coordinates[2][0] - coordinates[3][0];
        const dy2 = coordinates[2][1] - coordinates[3][1];
        const rotation = -Math.atan2(dy1, dx1);
        const gridSize = this.props.printSeriesEnabled ? this.props.printSeriesGridSize : 0;

        const geometries = [];
        for (let i = -gridSize; i <= gridSize; i++) {
            for (let j = -gridSize; j <= gridSize; j++) {
                const index = [i, j];
                const geometry = featureGeometry.clone();
                geometry.translate(
                    (1 - this.props.printSeriesOverlap) * (j * dx1 + i * dx2),
                    (1 - this.props.printSeriesOverlap) * (j * dy1 + i * dy2)
                );
                geometries.push({ index, geometry, rotation });
            }
        }

        return geometries;
    };
    layerStyle = (feature) => {
        // background geometry with own styling
        if (feature === this.backgroundFeature) {
            return FeatureStyles.printInteractionBackground({
                geometryFunction: this.getBackgroundGeometry
            });
        }

        // draw series geometries with own styling
        if (feature === this.printSeriesFeature && this.props.printSeriesEnabled) {
            const styles = [];
            const size = Math.min(this.props.fixedFrame.width, this.props.fixedFrame.height);
            const radius = Math.min(this.props.scale * size / this.map.getView().getResolution() / 100_000, 2);
            this.seriesGeometries.forEach((entry) => {
                // ignore the center geometry
                if (!isEqual(entry.index, [0, 0])) {
                    styles.push(FeatureStyles.printInteractionSeries({
                        geometryFunction: entry.geometry
                    }));
                    styles.push(...FeatureStyles.printInteractionSeriesIcon({
                        geometryFunction: new ol.geom.Point(ol.extent.getCenter(entry.geometry.getExtent())),
                        rotation: entry.rotation,
                        radius: radius,
                        img: this.isPrintSeriesSelected(entry) ? 'minus' : 'plus'
                    }));
                }
            });
            return styles;
        }

        // main feature
        if (feature === this.feature) {
            const styles = [
                FeatureStyles.printInteraction({
                    geometryFunction: this.getGeometry
                })
            ];
            const coordinates = this.getGeometry().getCoordinates()[0];
            if (coordinates && this.props.fixedFrame) {
                if (this.props.allowScaling) {
                    // vertices to scale the selection
                    styles.push(FeatureStyles.printInteractionVertex({
                        geometryFunction: new ol.geom.MultiPoint(coordinates.slice(2))
                    }));
                }
                if (this.props.allowScaling || this.props.allowRotation) {
                    // vertices to scale or rotate the selection
                    styles.push(FeatureStyles.printInteractionVertex({
                        geometryFunction: new ol.geom.MultiPoint(coordinates.slice(1, 2)),
                        fill: this.props.allowRotation
                    }));
                }
            }
            return styles;
        }

        return null;
    };
    scaleRotateStyle = (feature) => {
        feature.get('features').forEach((modifyFeature) => {
            const modifyGeometry = modifyFeature.get('modifyGeometry');
            if (modifyGeometry) {
                const point = feature.getGeometry().getCoordinates();
                // rotate only with vertex on bottom-right
                const isRotationVertex = isEqual(point, modifyFeature.getGeometry().getCoordinates()[0][1]);

                if (!modifyGeometry.point) {
                    // save the initial geometry and vertex position
                    modifyGeometry.point = point;
                    modifyGeometry.initialGeometry = modifyGeometry.geometry;
                }

                const center = ol.extent.getCenter(modifyGeometry.initialGeometry.getExtent());
                const [rotation, scale] = this.calculateRotationScale(modifyGeometry.point, point, center);

                const geometry = modifyGeometry.initialGeometry.clone();
                if (this.props.allowRotation && isRotationVertex) {
                    geometry.rotate(rotation, center);
                } else if (this.props.allowScaling) {
                    geometry.scale(scale, undefined, center);
                }
                modifyGeometry.geometry = geometry;
            }
        });

        return null;
    };
    isPrintSeriesSelected = (entry) => {
        return this.props.printSeriesSelected.includes(entry.index.join(','));
    };
    calculateExtents = () => {
        this.seriesGeometries = this.calculateSeriesGeometries();
        this.selectionLayer.changed();

        return this.seriesGeometries
            .filter(entry => isEqual(entry.index, [0, 0]) || this.isPrintSeriesSelected(entry))
            .map(entry => {
                const clonedGeom = entry.geometry.clone();
                const center = ol.extent.getCenter(clonedGeom.getExtent());
                clonedGeom.rotate(- this.props.rotation * Math.PI / 180, center);
                return clonedGeom.getExtent();
            });
    };
    geometryChanged = () => {
        const geometry = this.getGeometry();
        const extent = geometry.getExtent();
        const point = geometry.getCoordinates()[0][0];
        const center = ol.extent.getCenter(extent);

        // Update series geometries and obtain extents
        const extents = this.calculateExtents();

        let rotation = 0;
        let scale = null;

        if (this.initialWidth !== null && this.initialHeight !== null) {
            const initialPoint = [
                center[0] + 0.5 * this.initialWidth,
                center[1] + 0.5 * this.initialHeight
            ];

            const [calcRotation, calcScale] = this.calculateRotationScale(initialPoint, point, center);

            const degree = (360 + (calcRotation * 180) / Math.PI) % 360;

            rotation = Math.round(degree * 10) / 10 % 360;
            scale = Math.round(1000 * calcScale);
        }

        this.props.geometryChanged(center, extents, rotation, scale);
    };
    calculateRotationScale = (p1, p2, center) => {
        let dx = p1[0] - center[0];
        let dy = p1[1] - center[1];
        const initialAngle = Math.atan2(dy, dx);
        const initialRadius = Math.sqrt(dx * dx + dy * dy);

        dx = p2[0] - center[0];
        dy = p2[1] - center[1];
        const currentAngle = Math.atan2(dy, dx);
        const currentRadius = Math.sqrt(dx * dx + dy * dy);

        return [currentAngle - initialAngle, currentRadius / initialRadius];
    };
    render() {
        return null;
    }
}
