/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

 const React = require('react');
 const {connect} = require('react-redux');
 const proj4js = require('proj4');
 const Message = require('../../MapStore2/web/client/components/I18N/Message');
 const ConfigUtils = require("../../MapStore2/web/client/utils/ConfigUtils");
 const CRSSelector = require("../../MapStore2/web/client/components/mapcontrols/mouseposition/CRSSelector");
 const CoordinatesUtils = require('../../MapStore2/web/client/utils/CoordinatesUtils');
 const {changeMousePositionState,changeMousePositionCrs} = require('../../MapStore2/web/client/actions/mousePosition');
 require('./style/BottomBar.css');

 const BottomBar = React.createClass({
     propTypes: {
         mousepos: React.PropTypes.object,
         displaycrs:  React.PropTypes.string,
         onCRSChange: React.PropTypes.funct
     },
     getDefaultProps() {
         return {
             mousepos: {x: 0, y: 0, crs: "EPSG:4326"},
             displaycrs: "EPSG:4326",
         }
     },
     render() {
         let {x, y} = CoordinatesUtils.reproject([this.props.mousepos.x, this.props.mousepos.y], this.props.mousepos.crs, this.props.displaycrs);
         let digits = proj4js.defs(this.props.displaycrs).units === 'degrees'? 3 : 0;
         return (
             <div id="bottombar">
                <span className="mousepos_label"><Message msgId="bottombar.mousepos_label" />: </span>
                <span className="mouseposition">{x.toFixed(digits)} {y.toFixed(digits)}</span>
                <CRSSelector enabled={true} crs={this.props.displaycrs} id="crssselector" onCRSChange={this.props.onCRSChange}/>
                <span className="bottomlinks">
                    <a href={ConfigUtils.getConfigProp("viewertitle_link")}>
                        <Message className="viewertitle_label" msgId="bottombar.viewertitle_label" />
                    </a> | <a href={ConfigUtils.getConfigProp("terms_link")}>
                        <Message className="terms_label" msgId="bottombar.terms_label" />
                    </a>
                </span>
            </div>
         );
     },
     componentWillMount() {
         changeMousePositionState(true);
     }
 });

const selector = (state) => ({
    mousepos: {
        x: state && state.mousePosition && state.mousePosition.position ? state.mousePosition.position.x : 0,
        y: state && state.mousePosition && state.mousePosition.position ? state.mousePosition.position.y : 0,
        crs: state && state.mousePosition && state.mousePosition.position ? state.mousePosition.position.crs : "EPSG:4326"
    },
    displaycrs: state && state.mousePosition && state.mousePosition ? state.mousePosition.crs : "EPSG:4326"
});

 module.exports = {
     BottomBarPlugin: connect(selector, {
         onCRSChange: changeMousePositionCrs
     })(BottomBar),
     reducers: {
         mousePosition: require('../../MapStore2/web/client/reducers/mousePosition')
     }
 };
