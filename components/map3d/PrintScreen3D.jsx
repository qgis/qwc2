/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import FileSaver from 'file-saver';
import PropTypes from 'prop-types';
import utif from "utif";

import {setCurrentTask} from '../../actions/task';
import LocaleUtils from '../../utils/LocaleUtils';
import TaskBar from '../TaskBar';

import './style/PrintScreen3D.css';


class PrintScreen3D extends React.Component {
    static propTypes = {
        sceneContext: PropTypes.object,
        setCurrentTask: PropTypes.func
    };
    state = {
        selectedFormat: 'image/jpeg',
        x: 0,
        y: 0,
        width: 0,
        height: 0
    };
    formatChanged = (ev) => {
        this.setState({selectedFormat: ev.target.value});
    };
    renderBody = () => {
        const formatMap = {
            "image/jpeg": "JPEG",
            "image/png": "PNG",
            "image/tiff": "TIFF"
        };
        return (
            <div className="printscreen3d-body">
                <div><i>{LocaleUtils.tr("printscreen3d.selectinfo")}</i></div>
                <div>
                    {LocaleUtils.tr("printscreen3d.format")}&nbsp;
                    <select name="FORMAT" onChange={this.formatChanged} value={this.state.selectedFormat}>
                        {Object.entries(formatMap).map(([format, label]) => (
                            <option key={format} value={format}>{label}</option>
                        ))}
                    </select>
                </div>
            </div>
        );
    };
    renderExportFrame = () => {
        const boxStyle = {
            left: this.state.x + 'px',
            top: this.state.y + 'px',
            width: this.state.width + 'px',
            height: this.state.height + 'px'
        };
        return (
            <div className="printscreen3d-event-container" onMouseDown={this.startSelection}>
                <div className="printscreen3d-frame" style={boxStyle}>
                    {this.state.width + " x " + this.state.height}
                </div>
            </div>
        );
    };
    render() {
        return (
            <TaskBar task="PrintScreen3D">
                {() => ({
                    body: this.renderBody(),
                    extra: this.renderExportFrame()
                })}
            </TaskBar>
        );
    }
    startSelection = (ev) => {
        if (ev.button === 0) {
            const rect = ev.target.getBoundingClientRect();
            this.setState({
                x: Math.round(ev.clientX - rect.left),
                y: Math.round(ev.clientY - rect.top),
                width: 0,
                height: 0
            });
            const onMouseMove = (event) => {
                this.setState((state) => ({
                    width: Math.round(Math.max(0, Math.round(event.clientX - rect.left) - state.x)),
                    height: Math.round(Math.max(0, Math.round(event.clientY - rect.top) - state.y))
                }));
            };
            ev.view.addEventListener('mousemove', onMouseMove);
            ev.view.addEventListener('mouseup', () => {
                ev.view.removeEventListener('mousemove', onMouseMove);
                this.bboxSelected();
                this.setState({x: 0, y: 0, width: 0, height: 0});
            }, {once: true});
        }
    };
    bboxSelected = () => {
        const {x, y, width, height} = this.state;
        if (width > 0 && height > 0) {
            const data = this.props.sceneContext.scene.renderer.domElement.toDataURL('image/png');
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            const img = new Image();
            img.src = data;
            img.onload = () => {
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, -x, -y);
                if (this.state.selectedFormat === "image/tiff") {
                    const imageData = ctx.getImageData(0, 0, width, height);
                    const blob = new Blob([utif.encodeImage(imageData.data, width, height)], { type: "image/tiff" });
                    FileSaver.saveAs(blob, "export." + this.state.selectedFormat.replace(/.*\//, ''));
                } else {
                    canvas.toBlob((blob) => {
                        FileSaver.saveAs(blob, "export." + this.state.selectedFormat.replace(/.*\//, ''));
                    }, this.state.selectedFormat);
                }
            };
        }
    };
}

export default connect((state) => ({
}), {
    setCurrentTask: setCurrentTask
})(PrintScreen3D);
