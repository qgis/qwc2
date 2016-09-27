/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

 const React = require('react');
 const {connect} = require('react-redux');
 const Message = require('../../MapStore2/web/client/components/I18N/Message');
 const ConfigUtils = require("../../MapStore2/web/client/utils/ConfigUtils");
 const {changeMousePositionState} = require('../../MapStore2/web/client/actions/mousePosition')

 const BottomBar = React.createClass({
     propTypes: {
         mousepos: React.PropTypes.object
     },
     getDefaultProps() {
         return {
             mousepos: {x: 0, y: 0}
         }
     },
     render() {
         return (
             <div id="qwc2_bottombar">
                <span className="mouseposition">
                    <Message className="mousepos_label" msgId="qwc2.mousepos_label" />: {this.props.mousepos.x.toFixed(3)} {this.props.mousepos.y.toFixed(3)}
                </span>
                <span className="bottomlinks">
                    <a href={ConfigUtils.getConfigProp("viewertitle_link")}>
                        <Message className="viewertitle_label" msgId="qwc2.viewertitle_label" />
                    </a> | <a href={ConfigUtils.getConfigProp("terms_link")}>
                        <Message className="terms_label" msgId="qwc2.terms_label" />
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
        y: state && state.mousePosition && state.mousePosition.position ? state.mousePosition.position.y : 0
    }
});

 module.exports = {
     BottomBarPlugin: connect(selector, {})(BottomBar),
     reducers: {
         mousePosition: require('../../MapStore2/web/client/reducers/mousePosition')
     }
 };
