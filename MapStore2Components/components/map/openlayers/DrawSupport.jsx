/**
 * Copyright 2016, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const ol = require('openlayers');
const uuid = require('uuid');
const assign = require('object-assign');

class DrawSupport extends React.Component {
    static propTypes = {
        map: PropTypes.object,
        drawOwner: PropTypes.string,
        drawStatus: PropTypes.string,
        drawMethod: PropTypes.string,
        features: PropTypes.array,
        onChangeDrawingStatus: PropTypes.func,
        onEndDrawing: PropTypes.func
    }
    static defaultProps = {
        map: null,
        drawOwner: null,
        drawStatus: null,
        drawMethod: null,
        features: null,
        onChangeDrawingStatus: () => {},
        onEndDrawing: () => {}
    }
    componentWillReceiveProps(newProps) {
      if (this.drawLayer) {
        this.updateFeatureStyles(newProps.features);
      }

      if (!newProps.drawStatus && this.selectInteraction) {
        this.selectInteraction.getFeatures().clear();
      }

      switch (newProps.drawStatus) {
        case ("create"):
            this.addLayer(newProps);
            break;
        case ("start"):
            this.addInteractions(newProps);
            break;
        case ("stop"):
            this.removeDrawInteraction();
            break;
        case ("replace"):
            this.replaceFeatures(newProps);
            break;
        case ("clean"):
            this.clean();
            break;
        default:
            return;
      }
    }
    render() {
        return null;
    }
    updateFeatureStyles = (features) => {
      if (features && features.length > 0) {
        features.map(f => {
          if (f.style) {
            let olFeature = this.toOlFeature(f);
            if (olFeature) {
              olFeature.setStyle(this.toOlStyle(f.style, f.selected));
            }
          }
        });
      }
    }
    addLayer = (newProps) => {
      this.geojson = new ol.format.GeoJSON();
      this.drawSource = new ol.source.Vector();
      this.drawLayer = new ol.layer.Vector({
        source: this.drawSource,
        zIndex: 1000000,
        style: this.toOlStyle(newProps.style)
      });

      this.props.map.addLayer(this.drawLayer);

      if (newProps.features && newProps.features.length > 0) {
          for (let i = 0; i < newProps.features.length; i++) {
              let feature = newProps.features[i];
              if (!(feature instanceof Object)) {
                  feature = this.geojson.readFeature(feature);
              }

              this.drawSource.addFeature(feature);
          }
      }
    }
    replaceFeatures = (newProps) => {
        if (!this.drawLayer) {
          this.addLayer(newProps);
        }

        this.drawSource.clear();
        this.selectInteraction.getFeatures().clear();

        newProps.features.map((f) => {
            let feature = new ol.Feature({
                id: f.id,
                geometry: new ol.geom[f.type](f.coordinates)
            });

            feature.setStyle(this.toOlStyle(f.style));
            this.drawSource.addFeature(feature);
        });

        this.drawSource.changed();
    }
    addInteractions = (newProps) => {
        if (!this.drawLayer) {
            this.addLayer(newProps);
        }

        this.addDrawInteraction(newProps.drawMethod);

        this.addSelectInteraction();

        if (this.translateInteraction) {
          this.props.map.removeInteraction(this.translateInteraction);
        }

        this.translateInteraction = new ol.interaction.Translate({
          features: this.selectInteraction.getFeatures()
        });

        this.translateInteraction.on('translateend', this.updateFeatureExtent);
        this.props.map.addInteraction(this.translateInteraction);


        if (this.modifyInteraction) {
          this.props.map.removeInteraction(this.modifyInteraction);
        }

        this.modifyInteraction = new ol.interaction.Modify({
          features: this.selectInteraction.getFeatures()
        });

        this.props.map.addInteraction(this.modifyInteraction);
    }
    updateFeatureExtent = (event) => {
      let movedFeatures = event.features.getArray(),
          updatedFeatures = [];

      for (var i = 0; i < this.props.features.length; i++) {
        let f = this.props.features[i];

        for (var j = 0; j < movedFeatures.length; j++) {
          let mf = this.fromOlFeature(movedFeatures[j]);

          if (f['id'] === mf['id']) {
            f['geometry'] = mf['geometry'];
            f['center'] = mf['ceneter'];
            f['extent'] = mf['extent'];
            f['coordinates'] = mf['coordinates'];
            break;
          }
        }

        updatedFeatures.push(f);
      }

      this.props.onChangeDrawingStatus('replace', this.props.drawMethod, this.props.drawOwner, updatedFeatures);
    }
    addDrawInteraction = (drawMethod) => {
      if (this.drawInteraction) {
          this.removeDrawInteraction();
      }

      this.drawInteraction = new ol.interaction.Draw(this.drawPropertiesForGeometryType(drawMethod));

      this.drawInteraction.on('drawstart', function(evt) {
          this.sketchFeature = evt.feature;
          this.selectInteraction.getFeatures().clear();
          this.selectInteraction.setActive(false);
      }, this);

      this.drawInteraction.on('drawend', function(evt) {
          this.sketchFeature = evt.feature;
          this.sketchFeature.set('id', uuid.v1());

          let feature = this.fromOlFeature(this.sketchFeature);

          this.props.onEndDrawing(feature, this.props.drawOwner);
          this.props.onChangeDrawingStatus('stop', this.props.drawMethod, this.props.drawOwner, this.props.features.concat([feature]));

          this.selectInteraction.setActive(true);
      }, this);

      this.props.map.addInteraction(this.drawInteraction);
      this.setDoubleClickZoomEnabled(false);
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
    addSelectInteraction = () => {
      if (this.selectInteraction) {
        this.props.map.removeInteraction(this.selectInteraction);
      }

      this.selectInteraction = new ol.interaction.Select({ layers: [this.drawLayer] });

      this.selectInteraction.on('select', function(event) {
        let features = this.props.features.map(f => {
          let selected = false;

          let selectedFeatures = this.selectInteraction.getFeatures().getArray();
          for (var i = 0; i < selectedFeatures.length; i++) {
            if (f.id === selectedFeatures[i].get('id')) selected = true;
          }

          return assign({}, f, { selected: selected });
        });

        this.props.onChangeDrawingStatus('select', null, this.props.drawOwner, features);
      }.bind(this));

      this.props.map.addInteraction(this.selectInteraction);
    }
    drawPropertiesForGeometryType = (geometryType) => {
      let drawBaseProps = {
          source: this.drawSource,
          type: /** @type {ol.geom.GeometryType} */ geometryType,
          style: new ol.style.Style({
              fill: new ol.style.Fill({
                  color: 'rgba(255, 255, 255, 0.2)'
              }),
              stroke: new ol.style.Stroke({
                  color: 'rgba(0, 0, 0, 0.5)',
                  lineDash: [10, 10],
                  width: 2
              }),
              image: new ol.style.Circle({
                  radius: 5,
                  stroke: new ol.style.Stroke({
                      color: 'rgba(0, 0, 0, 0.7)'
                  }),
                  fill: new ol.style.Fill({
                      color: 'rgba(255, 255, 255, 0.2)'
                  })
              })
          }),
          condition: ol.events.condition.always
      };

      // Prepare the properties for the BBOX drawing
      let roiProps = {};
      if (geometryType === "BBOX") {
          roiProps.type = "LineString";
          roiProps.maxPoints = 2;
          roiProps.geometryFunction = function(coordinates, geometry) {
              let geom = geometry;
              if (!geom) {
                  geom = new ol.geom.Polygon(null);
              }

              let start = coordinates[0];
              let end = coordinates[1];
              geom.setCoordinates([
                [start, [start[0], end[1]], end, [end[0], start[1]], start]
              ]);

              return geom;
          };
      } else if (geometryType === "Circle") {
          roiProps.maxPoints = 100;
          roiProps.geometryFunction = ol.interaction.Draw.createRegularPolygon(roiProps.maxPoints);
      }

      return assign({}, drawBaseProps, roiProps);
    }
    removeInteractions = () => {
      this.removeDrawInteraction();

      if (this.selectInteraction) {
        this.props.map.removeInteraction(this.drawInteraction);
      }

      if (this.modifyInteraction) {
        this.props.map.removeInteraction(this.modifyInteraction);
      }

      if (this.translateInteraction) {
        this.props.map.removeInteraction(this.translateInteraction);
      }
    }
    removeDrawInteraction = () => {
      if (this.drawInteraction) {
        this.props.map.removeInteraction(this.drawInteraction);
        this.drawInteraction = null;
        this.sketchFeature = null;
        setTimeout(() => this.setDoubleClickZoomEnabled(true), 251);
      }
    }
    clean = () => {
        this.removeInteractions();

        if (this.drawLayer) {
            this.props.map.removeLayer(this.drawLayer);
            this.geojson = null;
            this.drawLayer = null;
            this.drawSource = null;
        }
    }
    fromOlFeature = (feature)  => {
      let geometry = feature.getGeometry(),
          extent = geometry.getExtent(),
          center = ol.extent.getCenter(geometry.getExtent()),
          coordinates = geometry.getCoordinates();

      return {
          id: feature.get('id'),
          type: geometry.getType(),
          extent: extent,
          center: center,
          coordinates: coordinates,
          style: this.fromOlStyle(feature.getStyle()),
          projection: this.props.map.getView().getProjection().getCode()
      };
    }
    toOlFeature = (feature) => {
      let features = this.drawSource.getFeatures();

      for (var i = 0; i < features.length; i++) {
        if (feature.id === features[i].get('id')) return features[i];
      }
    }
    fromOlStyle = (olStyle) => {
      if (olStyle == null) return {};

      return {
        fillColor: this.rgbToHex(olStyle.getFill().getColor()),
        fillTransparency: olStyle.getFill().getColor()[3],
        strokeColor: olStyle.getStroke().getColor(),
        strokeWidth: olStyle.getStroke().getWidth(),
        text: olStyle.getText().getText()
      }
    }
    toOlStyle = (style, selected) => {
      let color = style && style.fillColor ? style.fillColor : [255, 255, 255, 0.2];
      if (typeof color === 'string') {
        color = this.hexToRgb(color);
      }

      if (style && style.fillTransparency) {
        color[3] = style.fillTransparency;
      }

      let strokeColor = style && style.strokeColor ? style.strokeColor : '#ffcc33';
      if (selected) {
        strokeColor = '#4a90e2';
      }

      return new ol.style.Style({
        fill: new ol.style.Fill({
          color: color
        }),
        stroke: new ol.style.Stroke({
          color: strokeColor,
          width: style && style.strokeWidth ? style.strokeWidth : 2
        }),
        image: new ol.style.Circle({
          radius: style && style.strokeWidth ? style.strokeWidth : 5,
          fill: new ol.style.Fill({ color: style && style.strokeColor ? style.strokeColor : '#ffcc33' })
        }),
        text: new ol.style.Text({
          text: style && style.text ? style.text : '',
          fill: new ol.style.Fill({ color: style && style.strokeColor ? style.strokeColor : '#000' }),
          stroke: new ol.style.Stroke({ color: '#fff', width: 2 }),
          font: style && style.fontSize ? style.fontSize + 'px helvetica' : ''
        })
      });
    }
    //adopted from http://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
    hexToRgb = (hex) => {
      // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
      var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
      hex = hex.replace(shorthandRegex, function(m, r, g, b) {
          return r + r + g + g + b + b;
      });

      var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : null;
    }
    componentToHex = (c) => {
      var hex = c.toString(16);
      return hex.length == 1 ? "0" + hex : hex;
    }
    rgbToHex = (rgb) => {
      return "#" + this.componentToHex(rgb[0]) + this.componentToHex(rgb[1]) + this.componentToHex(rgb[2]);
    }
};

module.exports = DrawSupport;
