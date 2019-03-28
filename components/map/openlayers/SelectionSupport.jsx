/**
 * Copyright 2017, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const assign = require('object-assign');
const PropTypes = require('prop-types');
const ol = require('openlayers');
const FeatureStyles = require('./FeatureStyles');

const drawStyle = {
    "circleRadius": 0
};

class SelectionSupport extends React.Component {
    static propTypes = {
        map: PropTypes.object,
        projection: PropTypes.string,
        selection: PropTypes.object,
        changeSelectionState: PropTypes.func
    }
    static defaultProps = {
        selection: {}
    }
    componentWillReceiveProps(newProps) {
        if (newProps.selection.geomType && newProps.selection.geomType !== this.props.selection.geomType ) {
            this.addDrawInteraction(newProps);
        }

        if (!newProps.selection.geomType) {
            this.removeDrawInteraction();
        }
        if(newProps.selection.reset) {
            this.removeDrawInteraction();
            this.props.changeSelectionState({
                geomType: this.props.selection.geomType,
                style: this.props.selection.style,
                styleOptions: this.props.selection.styleOptions
            });
        }
    }
    render() {
        return null;
    }
    addDrawInteraction = (newProps) => {
        // cleanup old interaction
        if (this.drawInteraction) {
            this.removeDrawInteraction();
        }
        // create a layer to draw on
        let source = new ol.source.Vector();
        let vector = new ol.layer.Vector({
            source: source,
            zIndex: 1000000,
            style: feature => FeatureStyles[newProps.selection.style](feature, newProps.selection.styleOptions)
        });

        this.props.map.addLayer(vector);

        // create an interaction to draw with
        let draw = new ol.interaction.Draw({
            source: source,
            condition: event => event.pointerEvent.buttons === 1,
            type: newProps.selection.geomType,
            style: feature => FeatureStyles['default'](feature, drawStyle)
        });

        draw.on('drawstart', (evt) => {
            // preserv the sketch feature of the draw controller
            // to update length/area on drawing a new vertex
            this.sketchFeature = evt.feature;
            // clear previous sketches
            source.clear();
        }, this);
        draw.on('drawend', (evt) => {
            this.updateSelectionState();
        }, this);

        this.props.map.addInteraction(draw);
        this.drawInteraction = draw;
        this.selectionLayer = vector;
        this.setDoubleClickZoomEnabled(false);
    }
    removeDrawInteraction = () => {
        if (this.drawInteraction !== null) {
            this.props.map.removeInteraction(this.drawInteraction);
            this.drawInteraction = null;
            this.props.map.removeLayer(this.selectionLayer);
            this.sketchFeature = null;
            //Delay execution of activation of double click zoom function
            setTimeout(() => this.setDoubleClickZoomEnabled(true), 251);
        }
    }
    updateSelectionState = () => {
        if(!this.sketchFeature) {
            return;
        }
        var sketchCoords = this.sketchFeature.getGeometry().getCoordinates();

        let newSelectionState = {...this.props.selection,
            point: this.props.selection.geomType === 'Point' ?
                [sketchCoords[0], sketchCoords[1]] : null,
            line: this.props.selection.geomType === 'LineString' ?
                sketchCoords.map(coo => [coo[0], coo[1]]) : null,
            polygon: this.props.selection.geomType === 'Polygon' ?
                this.sketchFeature.getGeometry().getLinearRing(0).getCoordinates().map(coo => [coo[0], coo[1]]) : null
        };
        this.props.changeSelectionState(newSelectionState);
    }
    setDoubleClickZoomEnabled = (enabled) => {
        let interactions = this.props.map.getInteractions();
        for (let i = 0; i < interactions.getLength(); i++) {
            let interaction = interactions.item(i);
            if (interaction instanceof ol.interaction.DoubleClickZoom) {
                interaction.setActive(enabled);
                break;
            }
        }
    }
};

module.exports = SelectionSupport;
