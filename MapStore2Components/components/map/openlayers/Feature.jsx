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
const FeatureStyles = require('./FeatureStyles');
const {isEqual} = require('lodash');

class Feature extends React.Component {
    static propTypes = {
        type: PropTypes.string,
        geometry: PropTypes.object, // TODO check for geojson format for geometry
        properties: PropTypes.object,
        container: PropTypes.object, // TODO it must be a ol.layer.vector (maybe pass the source is more correct here?)
        featureId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        crs: PropTypes.string,
        layerCrs: PropTypes.string,
        styleName: PropTypes.string,
        styleOptions: PropTypes.object
    }
    static defaultProps = {
        properties: null,
        crs: "EPSG:4326",
        styleName: null,
        styleOptions: {}
    }
    componentDidMount() {
        this.addToContainer(this.props);
    }
    componentWillReceiveProps(newProps) {
        if (!isEqual(newProps.geometry, this.props.geometry)) {
            this.removeFromContainer();
            this.addToContainer(newProps);
        } else if(
            newProps.styleName != this.props.styleName ||
            !isEqual(newProps.styleOptions, this.props.styleOptions)
        ) {
            this.updateStyle(newProps);
        }
    }
    componentWillUnmount() {
        this.removeFromContainer();
    }
    render() {
        return null;
    }
    addToContainer = (props) => {
        const format = new ol.format.GeoJSON();
        const geometry = props.geometry && props.geometry.coordinates;

        if (geometry) {
            this.features = format.readFeatures({type: props.type, properties: props.properties, geometry: props.geometry, id: props.featureId});
            this.features.forEach((f) => {
                f.getGeometry().transform(props.crs, props.layerCrs);
            });
            this.updateStyle(props);
            props.container.getSource().addFeatures(this.features);
        }
    }
    updateStyle = (props) => {
        if(props.styleName) {
            let style = FeatureStyles[props.styleName];
            this.features.forEach((f) => f.setStyle(style(f, props.styleOptions || {})));
        } else {
            this.features.forEach((f) => f.setStyle(null));
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
