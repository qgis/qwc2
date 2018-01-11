/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
/**
 * Available configuration params refer to http://openlayers.org/en/v3.10.1/apidoc/ol.control.OverviewMap.html#on
 *
 * collapsed   boolean | undefined experimental Whether the control should start collapsed or not (expanded). Default to true.
 * collapseLabel   string | Node | undefined   experimental Text label to use for the expanded overviewmap button. Default is «. Instead of text, also a Node (e.g. a span element) can be used.
 * collapsible boolean | undefined experimental Whether the control can be collapsed or not. Default to true.
 * label   string | Node | undefined   experimental Text label to use for the collapsed overviewmap button. Default is ». Instead of text, also a Node (e.g. a span element) can be used.
 * target  Element | undefined experimental Specify a target if you want the control to be rendered outside of the map's viewport.
 * tipLabel    string | undefined  experimental Text label to use for the button tip. Default is Overview map
 */


var React = require('react');
const PropTypes = require('prop-types');
var ol = require('openlayers');
var assign = require('object-assign');

require('./style/OverviewSupport.css');

class Overview extends React.Component {
    static propTypes = {
        id: PropTypes.string,
        map: PropTypes.object,
        overviewOpt: PropTypes.object
    }
    static defaultProps = {
      id: 'overview',
      overviewOpt: {}
    }
    componentDidMount() {
        let opt = assign({}, this.defaultOpt, this.props.overviewOpt);
        this.overview = new ol.control.OverviewMap(opt);
        if (this.props.map) {
            this.overview.setMap(this.props.map);
        }
    }
    render() {
        return null;
    }
    static defaultOpt: {
        className: 'ol-overviewmap ol-custom-overviewmap',
        collapseLabel: '\u00AB',
        label: '\u00BB',
        collapsed: true,
        collapsible: true
    }
};

module.exports = Overview;
