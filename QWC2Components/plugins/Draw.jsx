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
const Message = require('../../MapStore2/web/client/components/I18N/Message');
const {changeDrawingStatus, endDrawing, setCurrentStyle} = require('../../MapStore2/web/client/actions/draw');
const {setCurrentTask} = require('../actions/task');
const { TwitterPicker } = require('react-color');

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
        fillTransparency: 0.2,
        text: '',
        fontSize: 14
      }
    }
  },

  componentWillReceiveProps(newProps) {
    //draw dialog is closed and is activated because user clicks on previously drawn feature
    if (this.props.drawStatus == null && newProps.drawStatus === 'select') {
      this.props.setCurrentTask('Draw');
      this.setState({ drawDialogOpen: true });
    }

    //recreate draw dialog with previously drawn features
    if (newProps.drawStatus === 'create') {
      this.setState({ drawDialogOpen: true });

      if(this.props.features.length > newProps.features.length) {
        this.props.changeDrawingStatus('replace', null, newProps.drawOwner, this.props.features);
      }
    }

    newProps.features.forEach(f => {
      //set current style from selected feature
      if (f.selected && Object.keys(f.style).length > 0 && newProps.drawStatus != null) {
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

    let unselectedFeatures = []
    this.props.features.forEach(function(f) {
      f.selected = false;
      unselectedFeatures.push(f);
    });

    this.props.changeDrawingStatus(null, null, this.props.drawOwner, unselectedFeatures);

    this.setState({ drawDialogOpen: false });
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
    if(!this.state || (this.state && !this.state.drawDialogOpen)) {
      return null;
    }

    return (
      <div>
        <MessageBar name="Draw" onClose={this.onClose}>
          <div role="body">
            <div className="buttonbar">
              <span onClick={()=>this.setDrawMethod('Point')} className={this.statusForDrawMethod('Point')}>
                <Message msgId="draw.point" />
              </span>
              <span onClick={()=>this.setDrawMethod('LineString')} className={this.statusForDrawMethod('LineString')}>
                <Message msgId="draw.line" />
              </span>
              <span onClick={()=>this.setDrawMethod('Polygon')} className={this.statusForDrawMethod('Polygon')}>
                <Message msgId="draw.polygon" />
              </span>
              <span onClick={()=>this.setDrawMethod('BBOX')} className={this.statusForDrawMethod('BBOX')}>
                <Message msgId="draw.bbox" />
              </span>
              <span onClick={()=>this.setDrawMethod('Circle')} className={this.statusForDrawMethod('Circle')}>
                <Message msgId="draw.circle" />
              </span>

              <div className="draw-options">
                <button className="btn btn-danger" onClick={this.deleteSelectedFeatures}
                  disabled={this.hasSelectedFeatures() ? '' : 'disabled'}>
                    <Message msgId="draw.delete" />
                </button>
                <button className="btn btn-default" onClick={this.deleteAllFeatures}
                  disabled={this.props.features.length ? '' : 'disabled'}>
                  <Message msgId="draw.clearAll" />
                </button>
              </div>
            </div>

            <div className="draw-style">
              <div className="style-row">
                <span className="style-rule">
                  <label><Message msgId="draw.strokecolor" /></label>
                  <input type="text" style={{backgroundColor: this.props.currentStyle.strokeColor}}
                    onChange={(evt) => this.updateStyleRule('strokeColor', evt.target.value)}
                    onClick={() => this.state.displayStrokeColorPicker ? this.setState({ displayStrokeColorPicker: false }):this.setState({ displayStrokeColorPicker: true })}/>
                    
                  <span className={this.state && this.state.displayStrokeColorPicker ? "color-picker" : "collapse" }>
                    <TwitterPicker color={this.props.currentStyle.StrokeColor} onChangeComplete={(color) => this.updateStyleRule('strokeColor', color.hex)} />
                  </span>
                </span>

                <span className="style-rule">
                  <label><Message msgId="draw.strokewidth" /></label>
                  <input type="text" value={this.props.currentStyle.strokeWidth}
                    onChange={(evt) => this.updateStyleRule('strokeWidth', evt.target.value)} />
                </span>
              </div>
              <div className="style-row">
                <span className="style-rule">
                  <label><Message msgId="draw.fillcolor" /></label>
                  <input type="text"  style={{backgroundColor: this.props.currentStyle.fillColor}}
                      onChange={(evt) => this.updateStyleRule('fillColor', evt.target.value)}
                      onClick={() => this.state.displayFillColorPicker ? this.setState({ displayFillColorPicker: false }):this.setState({ displayFillColorPicker: true })}/>
                  <span className={this.state && this.state.displayFillColorPicker ? "color-picker" : "collapse" }>
                    <TwitterPicker color={this.props.currentStyle.fillColor} onChangeComplete={(color) => this.updateStyleRule('fillColor', color.hex)} />
                  </span>
                </span>

                <span className="style-rule fill-opacity">
                  <label><Message msgId="draw.fillopacity" /></label>
                  <input type="range" min="0" max="1" step="0.1" value={this.props.currentStyle.fillTransparency}
                    onChange={(evt) => this.updateStyleRule('fillTransparency', evt.target.value)} />
                  <span>{this.props.currentStyle.fillTransparency*100}%</span>
                </span>
              </div>
              <div className="style-row">
                <span className="style-rule">
                  <label><Message msgId="draw.text" /></label>
                  <input type="text" value={this.props.currentStyle.text}
                      onChange={(evt) => this.updateStyleRule('text', evt.target.value)} />
                </span>

                <span className="style-rule">
                  <label><Message msgId="draw.fontsize" /></label>
                  <input type="text" value={this.props.currentStyle.fontSize}
                    onChange={(evt) => this.updateStyleRule('fontSize', evt.target.value)} />
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
