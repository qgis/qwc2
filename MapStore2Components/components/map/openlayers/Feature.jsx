/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

var React = require('react');
const PropTypes = require('prop-types');
var ol = require('openlayers');
const {isEqual} = require('lodash');

class Feature extends React.Component {
    static propTypes = {
        type: PropTypes.string,
        geometry: PropTypes.object, // TODO check for geojson format for geometry
        container: PropTypes.object, // TODO it must be a ol.layer.vector (maybe pass the source is more correct here?)
        featureId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        crs: PropTypes.string,
        layerCrs: PropTypes.string,
        style: PropTypes.object
    }
    static defaultProps = {
        crs: "EPSG:4326",
        style: null
    }
    componentDidMount() {
        this.addToContainer(this.props);
    }
    componentWillReceiveProps(newProps) {
        if (!isEqual(newProps.geometry, this.props.geometry)) {
            this.removeFromContainer();
            this.addToContainer(newProps);
        }
        if(newProps.style != this.props.style) {
            this.features.forEach((f) => f.setStyle(newProps.style));
        }
    }
    componentWillUnmount() {
        this.removeFromContainer();
    }
    render() {
        return null;
    }
    addToContainer(props) {
        const format = new ol.format.GeoJSON();
        const geometry = props.geometry && props.geometry.coordinates;

        if (geometry) {
            this.features = format.readFeatures({type: props.type, properties: props.properties, geometry: props.geometry, id: props.featureId});
            this.features.forEach((f) => {
                f.getGeometry().transform(props.crs, props.layerCrs);
                f.setStyle(this.props.style);
            });
            props.container.getSource().addFeatures(this.features);
        }
    }
    removeFromContainer = () => {
        const layersSource = this.props.container.getSource();
        (this.features || []).map((feature) => {
            layersSource.removeFeature(feature);
        });
    }
};

module.exports = Feature;
