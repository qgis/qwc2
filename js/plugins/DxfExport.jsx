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
const CoordinatesUtils = require('../../MapStore2/web/client/utils/CoordinatesUtils');
const {setCurrentTask} = require('../actions/task');
const MessageBar = require('../components/MessageBar');
const PrintFrame = require('../components/PrintFrame');
require('./style/DxfExport.css');

const DxfExport = React.createClass({
    propTypes: {
        visible: React.PropTypes.bool,
        theme: React.PropTypes.object,
        map: React.PropTypes.object,
        setCurrentTask: React.PropTypes.func
    },
    getDefaultProps() {
        return {
        }
    },
    renderBody() {
        return (
            <span role="body">
                <Message msgId="dxfexport.selectinfo" />
                <form style={{display: 'none'}} ref={form => this.form = form} action={this.props.theme.url} method="POST" target="_blank">
                    <input type="hidden" name="SERVICE" value="WMS" readOnly="true" />
                    <input type="hidden" name="VERSION" value="1.3" readOnly="true" />
                    <input type="hidden" name="REQUEST" value="GetMap" readOnly="true" />
                    <input type="hidden" name="FORMAT" value="application/dxf" readOnly="true" />
                    <input type="hidden" name="SRS" value="EPSG:3857" readOnly="true" />
                    <input ref={input => this.extentInput = input} type="hidden" name="EXTENT" value="" readOnly="true" />
                </form>
            </span>
        );
    },
    render() {
        if(!this.props.visible) {
            return null;
        }
        return (
            <div>
                <MessageBar name="dxfexport" onClose={this.close}>
                    {this.renderBody()}
                </MessageBar>
                <PrintFrame map={this.props.map} interactive={true} bboxSelected={this.bboxSelected} />
            </div>
        );
    },
    bboxSelected(bbox) {
        bbox = CoordinatesUtils.reprojectBbox(bbox, bbox.crs, "EPSG:3857");
        let extent = bbox[0] + "," + bbox[1] + "," + bbox[2] + "," + bbox[3];
        this.extentInput.value = extent;
        this.form.submit();
        this.close();
    },
    close() {
        this.props.setCurrentTask(null);
    }
});

const selector = (state) => ({
    theme: state.theme ? state.theme.current : null,
    visible: state.task ? state.task.current === 'dxfexport' : false,
    map: state.map ? state.map.present : null
});

module.exports = {
    DxfExportPlugin: connect(selector, {
        setCurrentTask: setCurrentTask
    })(DxfExport),
    reducers: {
        controls: require('../../MapStore2/web/client/reducers/controls')
    }
}
