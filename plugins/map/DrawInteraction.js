/**
 * Copyright Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ol from 'openlayers';

/**
 * @enum {string}
 */
export const VertexEventType = {
    /**
     * Triggered when a vertex is added to the feature
     * @event VertexEventType#vertexadded
     * @api
     */
    VERTEXADDED: 'vertexadded'
};

export class VertexEvent extends ol.Event {
    /**
     * @param {ModifyEventType} type Type.
     * @param {Collection<Feature>} features
     * The features modified.
     * @param {import("../MapBrowserEvent.js").default} mapBrowserEvent
     * Associated {@link module:ol/MapBrowserEvent~MapBrowserEvent}.
     */
    constructor(type, feature, coordinate) {
        super(type);

        /**
         * The features being modified.
         * @type {Collection<Feature>}
         * @api
         */
        this.feature = feature;

        /**
         * The coordinate of the added vertex.
         * @type {Array<number>}
         * @api
         */
        this.coordinate = coordinate;
    }
}
export default class DrawInteraction extends ol.interaction.Draw {
    constructor(options) {
        super(options);
    }
    startDrawing_(start) {
        const result = ol.interaction.Draw.prototype.startDrawing_.call(this, start);
        this.dispatchEvent(
            new VertexEvent(
                VertexEventType.VERTEXADDED,
                this.sketchFeature_,
                start
            )
        );
        return result;
    }
    addToDrawing_(coordinate) {
        const result = ol.interaction.Draw.prototype.addToDrawing_.call(this, coordinate);
        this.dispatchEvent(
            new VertexEvent(
                VertexEventType.VERTEXADDED,
                this.sketchFeature_,
                coordinate
            )
        );
        return result;
    }
}
