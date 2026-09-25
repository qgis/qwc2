import ol from 'openlayers';

import ConfigUtils from '../../utils/ConfigUtils';
import MeasureUtils from '../../utils/MeasureUtils';

const DOUBLE_CLICK_DELAY = 250;
const DOUBLE_CLICK_TOLERANCE = 12;

/**
 * Constrains the segments drawn by a line or polygon DrawInteraction to a fixed length.
 */
export default class ConstraintInteraction extends ol.interaction.Interaction {
    constructor(options) {
        super();
        this.drawInteraction = options.drawInteraction;
        this.distanceMeters = null;
        this.vertices = [];
        this.minVertices = 2;
        this.lastDown = null;
        this.finishVertex = null;
        this.drawInteraction.on('vertexadded', (ev) => {
            this.vertices.push(ev.coordinate.slice(0, 2));
            this.minVertices = ev.feature.getGeometry().getType() === "Polygon" ? 3 : 2;
        });
        this.drawInteraction.on(['drawstart', 'drawend', 'drawabort'], () => {
            this.vertices = [];
        });
    }
    setDistance(distanceMeters) {
        this.distanceMeters = distanceMeters;
    }
    handleEvent(evt) {
        const base = this.vertices[this.vertices.length - 1];
        // Shift is Draw's freehand modifier, freehand stays unconstrained
        if (!base || this.distanceMeters === null || !this.drawInteraction.getActive() || ol.events.condition.shiftKeyOnly(evt)) {
            return true;
        }
        // Aim from the raw pointer, snapping may already have moved evt.pixel
        const pixel = evt.map.getEventPixel(evt.originalEvent);
        if (evt.type === "pointerdown") {
            const time = evt.originalEvent.timeStamp;
            this.finishVertex = this.isDoubleClick(pixel, time) && this.vertices.length >= this.minVertices ? base : null;
            this.lastDown = {pixel, time};
        }
        if (this.finishVertex) {
            // Double click finish: map the second click onto the last vertex, which is not under the pointer
            evt.coordinate = this.finishVertex;
            evt.pixel = evt.map.getPixelFromCoordinate(this.finishVertex);
        } else if (["pointermove", "pointerdrag", "pointerup"].includes(evt.type)) {
            // Only the coordinate is rewritten: Draw detects clicks, long presses and finishes by pixel
            evt.coordinate = this.constrain(base, pixel, evt.map) ?? evt.coordinate;
        }
        if (evt.type === "pointerup") {
            this.finishVertex = null;
        }
        return true;
    }
    isDoubleClick(pixel, time) {
        return this.lastDown !== null && time - this.lastDown.time <= DOUBLE_CLICK_DELAY &&
            Math.hypot(pixel[0] - this.lastDown.pixel[0], pixel[1] - this.lastDown.pixel[1]) <= DOUBLE_CLICK_TOLERANCE;
    }
    constrain(base, pixel, map) {
        const crs = map.getView().getProjection().getCode();
        const geodesic = ConfigUtils.getConfigProp("geodesicMeasurements");
        return MeasureUtils.computeOffsetCoordinate(base, map.getCoordinateFromPixel(pixel), this.distanceMeters, crs, geodesic);
    }
}
