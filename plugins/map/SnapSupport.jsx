/**
* Copyright 2019, norBIT GmbH.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/

const React = require('react');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const uuid = require('uuid');
const {LayerRole} = require('../../actions/layers');
const IdentifyUtils = require('../../utils/IdentifyUtils');
const axios = require('axios');
const ol = require('openlayers');

class SnapSupport extends React.Component {
    static propTypes = {
        mousepos: PropTypes.object,
        map: PropTypes.object,
        mapObj: PropTypes.object,
        layers: PropTypes.array
    }
    constructor(props) {
        super(props);

        snapStyle = [
            new ol.style.Style({
                fill: new ol.style.Fill({ color: [255, 255, 255, 0.05] }),
                stroke: new ol.style.Stroke({ color: '#3399CC', width: 1})
            }),
            new ol.style.Style({
                image: new ol.style.RegularShape({
                    fill: new ol.style.Fill({ color: [255, 255, 255, 0.05] }),
                    stroke: new ol.style.Stroke({color: '#3399CC', width: 1}),
                    points: 4,
                    radius: 5,
                    angle: Math.PI / 4
                }),
                geometry: (feature) => {
                    if(feature.getGeometry().getType() === "Point") {
                        return new ol.geom.MultiPoint([feature.getGeometry().getCoordinates()]);
                    } else if(feature.getGeometry().getType() === "LineString") {
                        return new ol.geom.MultiPoint(feature.getGeometry().getCoordinates());
                    } else {
                        return new ol.geom.MultiPoint(feature.getGeometry().getCoordinates()[0]);
                    }
                }
            })
        ];
        this.snapSource = new ol.source.Vector();
        this.snapLayer = new ol.layer.Vector({
            source: this.snapSource,
            zIndex: 1000000,
            style: snapStyle
        });
        this.props.map.addLayer(this.snapLayer);
        this.curPos = null;
    }
    componentWillReceiveProps(newProps) {
        if(this.props.drawing && newProps.mousepos &&
                (!this.curPos ||
                Math.abs(newProps.mousepos.pixel[0] - this.curPos[0]) > 5 ||
                Math.abs(newProps.mousepos.pixel[1] - this.curPos[1]) > 5)) {
            clearTimeout(this.timeoutId);
            this.curPos = newProps.mousepos.pixel;
            this.timeoutId = setTimeout(() => this.getFeature(), 500);
        } else if(!this.props.drawing) {
            this.reset();
        }
    }
    addSnapFeatures = (geojson) => {
        this.reset();
        const format = new ol.format.GeoJSON();
        const features = format.readFeatures(geojson);
        for(let feature of features) {
            this.snapSource.addFeature(feature);
        }
    }
    addSnapInteraction = () => {
        const drawInteraction = new ol.interaction.Draw({source: this.snapSource});
        const modifyInteraction = new ol.interaction.Modify({source: this.snapSource});
        this.snapInteraction = new ol.interaction.Snap({source: this.snapSource});
        this.props.map.addInteraction(this.snapInteraction);
    }
    getFeature = () => {
        this.timeoutId = null;

        const layers = this.props.layers.find(layer => layer.role === LayerRole.THEME);
        const queryLayers = this.props.layers.reduce((accum, layer) => {
            return layer.role === LayerRole.THEME ? accum.concat(layer.queryLayers) : accum;
        }, []).join(",");

        if(!layers || !queryLayers) {
            return;
        }

        const options = {
            info_format: 'text/xml',
            feature_count: 20,
            FI_POINT_TOLERANCE: 16,
            FI_LINE_TOLERANCE: 8,
            FI_POLYGON_TOLERANCE: 4
        };

        const request = IdentifyUtils.buildRequest(layers, queryLayers, this.props.mousepos.coordinate, this.props.mapObj, options);
        axios.get(request.url, {params: request.params}).then(response => {
            const results = IdentifyUtils.parseXmlResponse({data: response.data, request}, this.props.mapObj.projection);
            const features = [];
            for(let i in results) {
                for(let feature of results[i]) {
                    if(feature.geometry) {
                        feature["id"] = uuid.v4();
                        features.push(feature);
                    }
                }
            }

            if(!features) {
                return;
            }

            const geojson = {
                'type': 'FeatureCollection',
                'crs': {
                    'type': 'name',
                    'properties': {
                        'name': this.props.mapObj.projection
                    }
                },
                'features': features
            };

            this.addSnapFeatures(geojson);
            this.addSnapInteraction();
        });
    }
    reset = () => {
        if(this.snapInteractions) {
            this.props.map.removeInteraction(this.snapInteraction);
        }
        for(let feature of this.snapSource.getFeatures()) {
            this.snapSource.removeFeature(feature);
        }
    }
    render() {
        return null;
    }
};

const selector = (state) => ({
    mapObj: state.map ? state.map : null,
    mousepos: state.mousePosition ? state.mousePosition.position : undefined,
    layers: state.layers && state.layers.flat ? state.layers.flat : null,
    drawing: state.redlining.action || state.measurement.action || state.editing.action
});

module.exports = connect(selector, {})(SnapSupport);
