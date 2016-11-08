/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const {connect} = require('react-redux');
const assign = require('object-assign');
const Message = require('../../MapStore2/web/client/components/I18N/Message');
const {setControlProperty} = require('../../MapStore2/web/client/actions/controls');
const CoordinatesUtils = require('../../MapStore2/web/client/utils/CoordinatesUtils');
const {Glyphicon} = require('react-bootstrap');
const PrintFrame = require('../components/PrintFrame');
require('./style/DxfExport.css');

const DxfExport = React.createClass({
    propTypes: {
        visible: React.PropTypes.bool,
        theme: React.PropTypes.object,
        setControlProperty: React.PropTypes.func,
        map: React.PropTypes.object
    },
    getDefaultProps() {
        return {
            visible: false
        }
    },
    render() {
        if(!this.props.visible) {
            return null;
        }
        return (
            <div>
                <div id="DxfInfoBar">
                    <span className="message">
                        <Message msgId="dxfexport.selectinfo" />
                    </span>
                    <Glyphicon className="close" glyph="remove" onClick={this.close}/>
                    <form ref={form => this.form = form} action={this.props.theme.url} method="POST" target="_blank">
                        <input type="hidden" name="SERVICE" value="WMS" readOnly="true" />
                        <input type="hidden" name="VERSION" value="1.3" readOnly="true" />
                        <input type="hidden" name="REQUEST" value="GetMap" readOnly="true" />
                        <input type="hidden" name="FORMAT" value="application/dxf" readOnly="true" />
                        <input type="hidden" name="SRS" value="EPSG:3857" readOnly="true" />
                        <input ref={input => this.extentInput = input} type="hidden" name="EXTENT" value="" readOnly="true" />
                    </form>
                </div>
                <PrintFrame map={this.props.map} interactive={true} bboxSelected={this.bboxSelected} />
            </div>
        );
    },
    close() {
        this.props.setControlProperty('dxfexport', 'visible', false);
    },
    bboxSelected(bbox) {
        bbox = CoordinatesUtils.reprojectBbox(bbox, bbox.crs, "EPSG:3857");
        let extent = bbox[0] + "," + bbox[1] + "," + bbox[2] + "," + bbox[3];
        this.extentInput.value = extent;
        this.form.submit();
        this.close();
    }
});

const selector = (state) => ({
    theme: state.theme ? state.theme.current : null,
    visible: state.controls && state.controls.dxfexport ? state.controls.dxfexport.visible : false,
    map: state.map ? state.map.present : null
});

module.exports = {
    DxfExportPlugin: connect(selector, {
        setControlProperty: setControlProperty
    })(DxfExport),
    reducers: {
        controls: require('../../MapStore2/web/client/reducers/controls')
    }
}
