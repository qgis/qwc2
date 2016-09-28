/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const FormattedNumber = require('react-intl').FormattedNumber;
const {Glyphicon} = require('react-bootstrap');
const {connect} = require('react-redux');
const assign = require('object-assign');
const Dialog = require('../../MapStore2/web/client/components/misc/Dialog');
const Message = require('../../MapStore2/web/client/components/I18N/Message');
const measureUtils = require('../../MapStore2/web/client/utils/MeasureUtils');
const {changeMeasurementState} = require('../../MapStore2/web/client/actions/measurement.js');
require('./style/Dialog.css');
require('./style/Measure.css');

 const Measure = React.createClass({
     propTypes: {
        measureState: React.PropTypes.object,
        updateMeasureState: React.PropTypes.func,
     },
     getDefaultProps() {
        return {
            measureState: {
                lineMeasureEnabled: false,
                areaMeasureEnabled: false,
                bearingMeasureEnabled: false,
                geomType: "LineString",
                len: 0,
                area: 0,
                bearing: 0,
                lenUnit: 'm',
                areaUnit: 'sqm'
            }
        }
    },
     onClose() {
         var diff = {
             lineMeasureEnabled: false,
             areaMeasureEnabled: false,
             bearingMeasureEnabled: false
         }
        this.props.updateMeasureState(assign({}, this.props.measureState, diff));
     },
     setMeasureMode(mode) {
         var diff = {
             lineMeasureEnabled: mode === "LineString",
             areaMeasureEnabled: mode === "Polygon",
             bearingMeasureEnabled: mode === "Bearing",
             geomType: mode
         }
         this.props.updateMeasureState(assign({}, this.props.measureState, diff));
     },
     changeLengthUnit(ev) {
         this.props.updateMeasureState(assign({}, this.props.measureState, {lenUnit: ev.target.value}));
     },
     changeAreaUnit(ev) {
         this.props.updateMeasureState(assign({}, this.props.measureState, {areaUnit: ev.target.value}));
     },
     renderHeader() {
         return (
             <div className="dialogheader" role="header">
                 <span className="dialogtitle"><Message msgId="measureComponent.title" /></span>
                 <span className="dialogclose" onClick={this.onClose}><Glyphicon glyph="remove"/></span>
             </div>
         );
     },
     renderBody() {
         let decimalFormat = {style: "decimal", minimumIntegerDigits: 1, maximumFractionDigits: 2, minimumFractionDigits: 2};
         if(this.props.measureState.lineMeasureEnabled) {
             var resultBody = (
                 <div>
                 <span><Message msgId="measureComponent.lengthLabel" />: </span>
                 <span><FormattedNumber {...decimalFormat} value={measureUtils.getFormattedLength(this.props.measureState.lenUnit, this.props.measureState.len)} /> </span>
                 <select onChange={this.changeLengthUnit} value={this.props.measureState.lenUnit}>
                     <option value="m">m</option>
                     <option value="ft">ft</option>
                     <option value="km">km</option>
                     <option value="mi">mi</option>
                 </select>
                 </div>
             );
         } else if(this.props.measureState.areaMeasureEnabled) {
             var resultBody = (
                 <div>
                 <span><Message msgId="measureComponent.areaLabel" />: </span>
                 <span><FormattedNumber {...decimalFormat} value={measureUtils.getFormattedArea(this.props.measureState.areaUnit, this.props.measureState.area)} /> </span>
                 <select onChange={this.changeAreaUnit} value={this.props.measureState.areaUnit}>
                     <option value="sqm">m&#178;</option>
                     <option value="sqft">ft&#178;</option>
                     <option value="sqkm">km&#178;</option>
                     <option value="sqmi">mi&#178;</option>
                 </select>
                 </div>
             );
         } else if(this.props.measureState.bearingMeasureEnabled) {
             var resultBody = (
                 <div>
                 <span><Message msgId="measureComponent.bearingLabel" />: </span>
                 <span>{measureUtils.getFormattedBearingValue(this.props.measureState.bearing)}</span>
                 </div>
             );
         }
         return (
             <div className="dialogbody" role="body">
                 <div className="tabbar">
                     <span onClick={()=>{this.setMeasureMode("LineString");}} className={this.props.measureState.lineMeasureEnabled ? "activetab" : ""}><Message msgId="measureComponent.lengthLabel" /></span>
                     <span onClick={()=>{this.setMeasureMode("Polygon");}} className={this.props.measureState.areaMeasureEnabled ? "activetab" : ""}><Message msgId="measureComponent.areaLabel" /></span>
                     <span onClick={()=>{this.setMeasureMode("Bearing");}} className={this.props.measureState.bearingMeasureEnabled ? "activetab" : ""}><Message msgId="measureComponent.bearingLabel" /></span>
                 </div>
                 <div className="tabarea">
                    {resultBody}
                 </div>
             </div>
         )
     },
     render() {
         if(!this.props.measureState.lineMeasureEnabled && !this.props.measureState.areaMeasureEnabled && !this.props.measureState.bearingMeasureEnabled) {
             return null;
         }
         return (
             <Dialog id="measuredialog" headerClassName="" bodyClassName="">
                 {this.renderHeader()}
                 {this.renderBody()}
             </Dialog>
         );
     }
 });

 const selector = (state) => ({
     measureState: state.measurement
 });

 module.exports = {
     MeasurePlugin: connect(selector, {
         updateMeasureState: changeMeasurementState
     })(Measure),
     reducers: {measurement: require('../../MapStore2/web/client/reducers/measurement')}
 }
