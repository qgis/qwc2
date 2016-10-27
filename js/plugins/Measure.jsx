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
const {changeMeasurement, changeMeasurementState} = require('../../MapStore2/web/client/actions/measurement.js');
require('./style/Dialog.css');
require('./style/Measure.css');

 const Measure = React.createClass({
     propTypes: {
        measureState: React.PropTypes.object,
        changeMeasurement: React.PropTypes.func,
        changeMeasurementState: React.PropTypes.func
     },
     getDefaultProps() {
        return {
            measureState: {
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
        this.props.changeMeasurement(assign({}, this.props.measureState, {geomType: null}));
     },
     setMeasureMode(mode) {
         this.props.changeMeasurement(assign({}, this.props.measureState, {geomType: mode}));
     },
     changeLengthUnit(ev) {
         this.props.changeMeasurementState(assign({}, this.props.measureState, {lenUnit: ev.target.value}));
     },
     changeAreaUnit(ev) {
         this.props.changeMeasurementState(assign({}, this.props.measureState, {areaUnit: ev.target.value}));
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
         if(this.props.measureState.geomType === "LineString") {
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
         } else if(this.props.measureState.geomType === "Polygon") {
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
         } else if(this.props.measureState.geomType === "Bearing") {
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
                     <span onClick={()=>{this.setMeasureMode("LineString");}} className={this.props.measureState.geomType === "LineString" ? "activetab" : ""}><Message msgId="measureComponent.lengthLabel" /></span>
                     <span onClick={()=>{this.setMeasureMode("Polygon");}} className={this.props.measureState.geomType === "Polygon" ? "activetab" : ""}><Message msgId="measureComponent.areaLabel" /></span>
                     <span onClick={()=>{this.setMeasureMode("Bearing");}} className={this.props.measureState.geomType === "Bearing" ? "activetab" : ""}><Message msgId="measureComponent.bearingLabel" /></span>
                 </div>
                 <div className="tabarea">
                    {resultBody}
                 </div>
             </div>
         )
     },
     render() {
         if(!this.props.measureState.geomType) {
             return null;
         }
         return (
             <Dialog id="MeasureDialog" headerClassName="" bodyClassName="">
                 {this.renderHeader()}
                 {this.renderBody()}
             </Dialog>
         );
     }
 });

 const selector = (state) => ({
     measureState: {
         geomType: state.measurement ? state.measurement.geomType : null,
         len: state.measurement ? state.measurement.len : 0,
         area: state.measurement ? state.measurement.area : 0,
         bearing: state.measurement ? state.measurement.bearing : 0,
         lenUnit: state.measurement && state.measurement.lenUnit ? state.measurement.lenUnit : 'm',
         areaUnit: state.measurement && state.measurement.areaUnit ? state.measurement.areaUnit : 'sqm'
     }
 });

 module.exports = {
     MeasurePlugin: connect(selector, {
         changeMeasurement: changeMeasurement,
         changeMeasurementState: changeMeasurementState
     })(Measure),
     reducers: {
         measurement: require('../../MapStore2/web/client/reducers/measurement')
     }
 }
