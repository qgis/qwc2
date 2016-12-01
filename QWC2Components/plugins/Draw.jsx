/**
 * Copyright 2016, Invit.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const {connect} = require('react-redux');
const assign = require('object-assign');
const MessageBar = require('../components/MessageBar');
const {changeDrawingStatus, endDrawing} = require('../../MapStore2/web/client/actions/draw');
const {setCurrentTask} = require('../actions/task');

const Draw = React.createClass({
  propTypes: {
    drawStatus: React.PropTypes.string,
    drawOwner: React.PropTypes.string,
    drawMethod: React.PropTypes.string,
    features: React.PropTypes.array,
    changeDrawingStatus: React.PropTypes.func,
    endDrawing: React.PropTypes.func,
    setCurrentTask: React.PropTypes.func
  },
  getDefaultProps() {
    return {
      drawStatus: 'create',
      drawMethod: null,
      drawOwner: 'draw_dialog',
      features: []
    }
  },
  onClose() {
    this.props.setCurrentTask(null);
    this.props.changeDrawingStatus(null, null, null, []);
  },
  setDrawMethod(method) {
    this.props.changeDrawingStatus('start', method, 'draw_dialog', []);
  },
  render() {
    if(!this.props.drawStatus) {
      return null;
    }

    return (
      <div>
        <MessageBar name="Draw" onClose={this.onClose}>
            <span role="body">
                <div className="buttonbar">
                  <span onClick={()=>this.setDrawMethod('Point')} className={this.props.drawMethod == 'Point' ? 'active' : ''}> Point</span>
                  <span onClick={()=>this.setDrawMethod('LineString')} className={this.props.drawMethod == 'LineString' ? 'active' : ''}> Line</span>
                  <span onClick={()=>this.setDrawMethod('Polygon')} className={this.props.drawMethod == 'Polygon' ? 'active' : ''}> Polygon</span>
                  <span onClick={()=>this.setDrawMethod('BBOX')} className={this.props.drawMethod == 'BBOX' ? 'active' : ''}> BBOX</span>
                  <span onClick={()=>this.setDrawMethod('Circle')} className={this.props.drawMethod == 'Circle' ? 'active' : ''}> Circle</span>
                </div>
            </span>
        </MessageBar>
      </div>
    );
  }
});

const selector = (state) => ({
  drawStatus: state.draw.drawStatus,
  drawMethod: state.draw.drawMethod,
  drawOwner: state.draw.drawOwner,
  features: state.draw.features
});

module.exports = {
 DrawPlugin: connect(selector, {
   setCurrentTask: setCurrentTask,
   changeDrawingStatus: changeDrawingStatus,
   endDrawing: endDrawing
 })(Draw),
 reducers: {
   draw: require('../../MapStore2/web/client/reducers/draw')
 }
}
