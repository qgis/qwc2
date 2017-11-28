/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const ol = require('openlayers');
const assign = require('object-assign');
const defaultIcon = require('../img/marker-icon.png');
const VectorLayer = require('./VectorLayer');

var icon = new ol.style.Style({
  image: new ol.style.Icon(/** @type {olx.style.IconOptions} */ ({
    anchor: [0.5, 1],
    anchorXUnits: 'fraction',
    anchorYUnits: 'fraction',
    opacity: 1,
    src: defaultIcon
  }))
});

const defaultStyles = {
  'Point': [new ol.style.Style({
    image: icon
  })]};


let MarkerLayer = {
    create: (options, map, mapId) => {
        return VectorLayer.create(assign(options, {style: () => { return defaultStyles.Point; }}), map, mapId);

    }
};

module.exports = MarkerLayer;
