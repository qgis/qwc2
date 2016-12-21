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
require('./style/Draw.css');

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
    this.props.changeDrawingStatus('clean', null, this.props.drawOwner, []);
    this.props.changeDrawingStatus(null, null, null, []);
  },
  setDrawMethod(method) {
    this.props.changeDrawingStatus('start', method, this.props.drawOwner, this.props.features);
  },
  statusForDrawMethod(method) {
    return this.props.drawMethod == method && this.props.drawStatus !== 'stop' ? 'active' : '';
  },
  deleteSelectedFeature() {
    let remainingFeatures = this.props.features.filter((feature) => { return feature.id !== this.props.selectedFeature.id });

    this.props.changeDrawingStatus('replace', null, this.props.drawOwner, remainingFeatures);
  },
  deleteAllFeatures() {
    this.props.changeDrawingStatus('replace', null, this.props.drawOwner, []);
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
                  <span onClick={()=>this.setDrawMethod('Point')} className={this.statusForDrawMethod('Point')}>Point</span>
                  <span onClick={()=>this.setDrawMethod('LineString')} className={this.statusForDrawMethod('LineString')}>Line</span>
                  <span onClick={()=>this.setDrawMethod('Polygon')} className={this.statusForDrawMethod('Polygon')}>Polygon</span>
                  <span onClick={()=>this.setDrawMethod('BBOX')} className={this.statusForDrawMethod('BBOX')}>BBOX</span>
                  <span onClick={()=>this.setDrawMethod('Circle')} className={this.statusForDrawMethod('Circle')}>Circle</span>
                </div>
                <div className="draw-options">
                  <button className="btn btn-danger" onClick={this.deleteSelectedFeature} disabled={this.props.selectedFeature ? '' : 'disabled'}>Delete</button>
                  <button className="btn btn-default" onClick={this.deleteAllFeatures} disabled={this.props.features.length ? '' : 'disabled'}>Clear all</button>
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
  features: state.draw.features,
  selectedFeature: state.draw.selectedFeature
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
