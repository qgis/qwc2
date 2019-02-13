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


const React = require('react');
const PropTypes = require('prop-types');
const ol = require('openlayers');
const assign = require('object-assign');

require('./style/OverviewSupport.css');

class Overview extends React.Component {
    static propTypes = {
        id: PropTypes.string,
        map: PropTypes.object,
        // See https://openlayers.org/en/latest/apidoc/ol.control.OverviewMap.html
        options: PropTypes.object
    }
    static defaultProps = {
      id: 'overview',
      options: {}
    }
    static defaultOpt = {
        className: 'ol-overviewmap ol-custom-overviewmap',
        collapseLabel: '\u00AB',
        label: '\u00BB',
        collapsed: true,
        collapsible: true
    }
    componentDidMount() {
        let opt = assign({
            view: new ol.View({
                projection: this.props.map.getView().getProjection()
            })
        }, Overview.defaultOpt, this.props.options);
        this.overview = new ol.control.OverviewMap(opt);
        this.overview.setMap(this.props.map);
    }
    componentWillReceiveProps(newProps) {
        let oldProj = this.overview.getOverviewMap().getView().getProjection();
        let newProj = newProps.map.getView().getProjection();
        if(oldProj !== newProj) {
            this.overview.getOverviewMap().setView(
                new ol.View({projection: newProj})
            );
        }
    }
    render() {
        return null;
    }
};

module.exports = Overview;
