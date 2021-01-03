/**
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import isEmpty from 'lodash.isempty';
import {LayerRole} from '../actions/layers';
import {setCurrentTask} from '../actions/task';
import TaskBar from '../components/TaskBar';
import PrintFrame from '../components/PrintFrame';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import LocaleUtils from '../utils/LocaleUtils';
import './style/DxfExport.css';

class DxfExport extends React.Component {
    static propTypes = {
        layers: PropTypes.array,
        map: PropTypes.object,
        setCurrentTask: PropTypes.func,
        theme: PropTypes.object
    }
    renderBody = () => {
        const themeLayers = this.props.layers.filter(layer => layer.role === LayerRole.THEME);
        if (!this.props.theme || isEmpty(themeLayers)) {
            return null;
        }
        const themeSubLayers = themeLayers.map(layer => layer.params.LAYERS).reverse().join(",");
        const filename = this.props.theme.name + ".dxf";
        const action = this.props.theme.url;
        return (
            <span>
                <form action={action} method="POST" ref={form => { this.form = form; }} target="_blank">
                    <div className="help-text">{LocaleUtils.tr("dxfexport.selectinfo")}</div>
                    <div className="export-settings">
                        {LocaleUtils.tr("dxfexport.symbologyscale")}
                        <span className="input-frame"><span>1&nbsp;:&nbsp;</span><input defaultValue="500" name="SCALE" type="number" /></span>
                    </div>
                    <input name="SERVICE" readOnly type="hidden" value="WMS" />
                    <input name="VERSION" readOnly type="hidden" value={themeLayers[0].version || "1.3.0"} />
                    <input name="REQUEST" readOnly type="hidden" value="GetMap" />
                    <input name="FORMAT" readOnly type="hidden" value="application/dxf" />
                    <input name="LAYERS" readOnly type="hidden" value={themeSubLayers} />
                    <input name="CRS" readOnly type="hidden" value={this.props.map.projection} />
                    <input name="FILE_NAME" readOnly type="hidden" value={this.props.theme.name + ".dxf"} />
                    <input name="BBOX" readOnly ref={input => { this.extentInput = input; }} type="hidden" value="" />
                </form>
            </span>
        );
    }
    render() {
        return (
            <TaskBar task="DxfExport">
                {() => ({
                    body: this.renderBody(),
                    extra: (<PrintFrame bboxSelected={this.bboxSelected} map={this.props.map} />)
                })}
            </TaskBar>
        );
    }
    bboxSelected = (bbox, crs) => {
        const version = this.props.theme.version || "1.3.0";
        const extent = (CoordinatesUtils.getAxisOrder(crs).substr(0, 2) === 'ne' && version === '1.3.0') ?
            bbox[1] + "," + bbox[0] + "," + bbox[3] + "," + bbox[2] :
            bbox.join(',');
        this.extentInput.value = extent;
        this.form.submit();
        this.props.setCurrentTask(null);
    }
}

const selector = (state) => ({
    theme: state.theme.current,
    map: state.map,
    layers: state.layers.flat
});

export default connect(selector, {
    setCurrentTask: setCurrentTask
})(DxfExport);
