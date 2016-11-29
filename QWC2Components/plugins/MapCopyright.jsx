/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const {connect} = require('react-redux');
const CoordinatesUtils = require('../../MapStore2/web/client/utils/CoordinatesUtils');
require('./style/MapCopyright.css');


const MapCopyright = React.createClass({
    propTypes: {
      layers: React.PropTypes.array,
      map: React.PropTypes.object
    },
    getDefaultProps() {
        return {
            layers: [],
            map: null
        };
    },
    getInitialState() {
        return {currentCopyrights: []};
    },
    componentWillReceiveProps(newProps) {
        if(newProps.map && newProps.map.bbox && newProps.layers) {
            let transformedbboxes = {};
            transformedbboxes[newProps.map.bbox.crs] = newProps.map.bbox.bounds;
            let copyrights = [];
            newProps.layers.map(layer => this.collectCopyrigths(layer, newProps.map.bbox, transformedbboxes, copyrights));
            this.setState({currentCopyrights: copyrights});
        }
    },
    collectCopyrigths(layer, srcmapbbox, transformedbboxes, copyrights) {
        if(layer.sublayers) {
            layer.sublayers.map(layer => this.collectCopyrigths(layer, srcmapbbox, transformedbboxes, copyrights));
        }
        if(!layer.crs || !layer.extent || !layer.attribution) {
            return;
        }
        if(!transformedbboxes[layer.crs]) {
            let {minx, miny, maxx, maxy} = srcmapbbox.bounds;
            transformedbboxes[layer.crs] = CoordinatesUtils.reprojectBbox([minx, miny, maxx, maxy], srcmapbbox.crs, layer.crs);
        }
        let mapbbox = transformedbboxes[layer.crs];
        let laybbox = layer.extent;
        if( mapbbox[0] < laybbox[2] && mapbbox[2] > laybbox[0] &&
            mapbbox[1] < laybbox[3] && mapbbox[3] > laybbox[1])
        {
            // Extents overlap
            copyrights.push({label: layer.attribution, url: layer.attributionUrl});
        }
    },
    render() {
        let copyrights = this.state.currentCopyrights.map((attribution, index) => {
            return (<a key={"attribution" + index} href={attribution.url} target="_blank">{attribution.label}</a>);
        })
        if(!copyrights || copyrights.length === 0) {
            return null;
        }
        return (
            <div id="MapCopyright">
                {copyrights}
            </div>
        )
    }
});

const selector = (state) => ({
    layers: state.layers && state.layers.flat ? state.layers.flat : [],
    map: state.map ? state.map.present : null
});

module.exports = {
    MapCopyrightPlugin: connect(selector, {})(MapCopyright)
}
