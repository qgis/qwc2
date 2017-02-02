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
const {changeDrawingStatus, endDrawing, setCurrentStyle} = require('../../MapStore2/web/client/actions/draw');
const {setCurrentTask} = require('../actions/task');
const { SketchPicker } = require('react-color');

require('./style/Draw.css');

const Draw = React.createClass({
  propTypes: {
    drawStatus: React.PropTypes.string,
    drawOwner: React.PropTypes.string,
    drawMethod: React.PropTypes.string,
    features: React.PropTypes.array,
    currentStyle: React.PropTypes.object,
    changeDrawingStatus: React.PropTypes.func,
    endDrawing: React.PropTypes.func,
    setCurrentTask: React.PropTypes.func,
    setCurrentStyle: React.PropTypes.func
  },
  getDefaultProps() {
    return {
      drawStatus: 'create',
      drawMethod: null,
      drawOwner: 'draw_dialog',
      features: [],
      currentStyle: {
        strokeColor: '#ffcc33',
        strokeWidth: 2,
        fillColor: '#FFFFFF',
        fillTransparency: 0.2
      }
    }
  },

  componentWillReceiveProps(newProps) {
    newProps.features.forEach(f => {
      //set current style from selected feature
      if (f.selected && Object.keys(f.style).length > 0) {
        this.props.setCurrentStyle(f.style);
      }

      //set current style to newly created features
      if (Object.keys(f.style).length === 0) {
        f.style = this.props.currentStyle;
      }
    });
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

  deleteSelectedFeatures() {
    let remainingFeatures = this.props.features.filter(feature => {
      return !feature.selected;
    });

    this.props.changeDrawingStatus('replace', null, this.props.drawOwner, remainingFeatures);
  },

  deleteAllFeatures() {
    this.props.changeDrawingStatus('replace', null, this.props.drawOwner, []);
  },

  updateStyleRule(ruleName, ruleValue) {
    let s = {};
    s[ruleName] = ruleValue;
    let newStyle = assign({}, this.props.currentStyle, s);

    let features = this.props.features.map(f => {
      if (f.selected) {
        let newFeature = { style: newStyle };
        return assign({}, f, newFeature);
      } else {
        return f;
      }
    });

    this.props.setCurrentStyle(newStyle);
    this.props.changeDrawingStatus('style', null, this.props.drawOwner, features);
    this.setState({ displayFillColorPicker: false, displayStrokeColorPicker: false })
  },

  hasSelectedFeatures() {
    for (var i = 0; i < this.props.features.length; i++) {
      if (this.props.features[i].selected) {
        return true;
      }
    };

    return false;
  },

  render() {
    if(!this.props.drawStatus) {
      return null;
    }

    return (
      <div>
        <MessageBar name="Draw" onClose={this.onClose}>
          <div role="body">
            <div className="buttonbar">
              <span onClick={()=>this.setDrawMethod('Point')} className={this.statusForDrawMethod('Point')}>Point</span>
              <span onClick={()=>this.setDrawMethod('LineString')} className={this.statusForDrawMethod('LineString')}>Line</span>
              <span onClick={()=>this.setDrawMethod('Polygon')} className={this.statusForDrawMethod('Polygon')}>Polygon</span>
              <span onClick={()=>this.setDrawMethod('BBOX')} className={this.statusForDrawMethod('BBOX')}>BBOX</span>
              <span onClick={()=>this.setDrawMethod('Circle')} className={this.statusForDrawMethod('Circle')}>Circle</span>

              <div className="draw-options">
                <button className="btn btn-danger" onClick={this.deleteSelectedFeatures} disabled={this.hasSelectedFeatures() ? '' : 'disabled'}>Delete</button>
                <button className="btn btn-default" onClick={this.deleteAllFeatures} disabled={this.props.features.length ? '' : 'disabled'}>Clear all</button>
              </div>
            </div>

            <div className="draw-style">
              <div className="style-row">
                <span className="style-rule">
                  <label>Stroke width</label>
                  <input type="text" value={this.props.currentStyle.strokeWidth}
                    onChange={(evt) => this.updateStyleRule('strokeWidth', evt.target.value)} />
                </span>

                <span className="style-rule">
                  <label>Stroke color</label>
                  <input type="text" value={this.props.currentStyle.strokeColor}
                    onChange={(evt) => this.updateStyleRule('strokeColor', evt.target.value)}
                    onFocus={() => this.setState({ displayStrokeColorPicker: true })} />
                  <span className={this.state && this.state.displayStrokeColorPicker ? "color-picker" : "collapse" }>
                    <SketchPicker color={this.props.currentStyle.StrokeColor} onChangeComplete={(color) => this.updateStyleRule('strokeColor', color.hex)} />
                  </span>
                </span>
              </div>
              <div className="style-row">
                <span className="style-rule">
                  <label>Fill color</label>
                  <input type="text" value={this.props.currentStyle.fillColor}
                      onChange={(evt) => this.updateStyleRule('fillColor', evt.target.value)}
                      onFocus={() => this.setState({ displayFillColorPicker: true })} />

                  <span className={this.state && this.state.displayFillColorPicker ? "color-picker" : "collapse" }>
                    <SketchPicker color={this.props.currentStyle.fillColor} onChangeComplete={(color) => this.updateStyleRule('fillColor', color.hex)} />
                  </span>
                </span>

                <span className="style-rule">
                  <label>Transparency</label>
                  <input type="text" value={this.props.currentStyle.fillTransparency}
                    onChange={(evt) => this.updateStyleRule('fillTransparency', evt.target.value)} />
                </span>
              </div>
            </div>
          </div>
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
  currentStyle: state.draw.currentStyle
});

module.exports = {
 DrawPlugin: connect(selector, {
   setCurrentTask: setCurrentTask,
   changeDrawingStatus: changeDrawingStatus,
   endDrawing: endDrawing,
   setCurrentStyle: setCurrentStyle
 })(Draw),
 reducers: {
   draw: require('../../MapStore2/web/client/reducers/draw')
 }
}
