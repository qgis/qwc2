/**
 * Copyright 2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import mime from 'mime-to-extensions';
import Icon from './Icon';
import ModalDialog from './ModalDialog';
import ConfigUtils from '../utils/ConfigUtils';
import LocaleUtils from '../utils/LocaleUtils';
import './style/EditUploadField.css';


export default class EditUploadField extends React.Component {
    static propTypes = {
        constraints: PropTypes.object,
        editLayerId: PropTypes.string,
        fieldId: PropTypes.string,
        updateField: PropTypes.func,
        value: PropTypes.string
    }
    state = {
        camera: false,
        imageData: null
    }
    constructor(props) {
        super(props);
        this.cameraStream = null;
        this.videoElement = null;
        this.portal = document.createElement("div");
        document.body.appendChild(this.portal);
    }
    componentWillUnmount() {
        this.disableMediaStream();
    }
    render() {
        const fileValue = this.props.value.replace(/attachment:\/\//, '');
        const fileType = mime.lookup(fileValue);
        const editServiceUrl = ConfigUtils.getConfigProp("editServiceUrl");
        const fileUrl = editServiceUrl + "/" + this.props.editLayerId + "/attachment?file=" + encodeURIComponent(fileValue);
        const constraints = {
            ...this.props.constraints,
            accept: (this.props.constraints.accept || "").split(",").map(ext => mime.lookup(ext)).join(",")
        };
        const mediaSupport = 'mediaDevices' in navigator && constraints.accept.split(",").includes("image/jpeg");
        const imageData = fileType && fileType.startsWith('image/') ? fileUrl : this.state.imageData;

        if (imageData) {
            const extension = fileValue ? fileValue.replace(/^.*\./, '') : 'jpg';
            return (
                <span className="edit-upload-field-image">
                    <img onClick={() => this.download(imageData, this.props.fieldId + "." + extension)} src={imageData} />
                    {this.state.imageData ? (<input name={this.props.fieldId} type="hidden" value={this.state.imageData} />) : null}
                    <button className="button" onClick={this.clearPicture} type="button">
                        <Icon icon="clear" />
                        {LocaleUtils.tr("editing.clearpicture")}
                    </button>
                </span>
            );
        } else if (fileValue) {
            return (
                <span className="edit-upload-field">
                    <a href={fileUrl} rel="noreferrer" target="_blank">
                        {fileValue.replace(/.*\//, '')}
                    </a>
                    <Icon icon="clear" onClick={() => this.props.updateField(this.props.fieldId, '')} />
                </span>
            );
        } else {
            return (
                <span className="edit-upload-field-input">
                    <input name={this.props.fieldId} type="file" {...constraints} onChange={() => this.props.updateField(this.props.fieldId, '')} />
                    {mediaSupport ? (<Icon icon="camera" onClick={this.enableCamera} />) : null}
                    {this.state.camera ? this.renderCaptureFrame() : null}
                </span>
            );
        }
    }
    enableCamera = () => {
        this.setState({camera: true});
    }
    disableCamera = () => {
        this.disableMediaStream();
        this.setState({camera: false});
    }
    renderCaptureFrame = () => {
        return (
            <ModalDialog icon="camera" onClose={this.disableCamera} title={LocaleUtils.tr("editing.takepicture")}>
                <video className="edit-capture-frame" ref={this.activateMediaStream} />
                <div className="edit-capture-controls">
                    <Icon icon="camera" onClick={this.capturePicture} />
                </div>
            </ModalDialog>
        );
    }
    capturePicture = () => {
        if (this.cameraStream) {
            const width = this.videoElement.videoWidth;
            const height = this.videoElement.videoHeight;
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext("2d");
            context.drawImage(this.videoElement, 0, 0, width, height);
            const imageData = canvas.toDataURL("image/jpeg");
            this.setState({imageData: imageData});
            this.props.updateField(this.props.fieldId, '');
        }
        this.disableCamera();
    }
    clearPicture = () => {
        this.setState({imageData: null});
        this.props.updateField(this.props.fieldId, '');
    }
    activateMediaStream = (el) => {
        if (this.state.camera && !this.cameraStream) {
            const constraints = {
                video: {
                    width: { ideal: 4096 },
                    height: { ideal: 2160 }
                }
            };
            navigator.mediaDevices.getUserMedia(constraints).then((mediaStream) => {
                this.cameraStream = mediaStream;
                el.srcObject = mediaStream;
                el.play();
                this.videoElement = el;
            }).catch((err) => {
                console.warn("Unable to access camera: " + err);
            });
        }
    }
    disableMediaStream = () => {
        if (this.cameraStream) {
            this.cameraStream.getTracks()[0].stop();
            this.cameraStream = null;
            this.videoElement = null;
        }
    }
    download = (href, filename) => {
        const a = document.createElement("a");
        a.href = href;
        a.setAttribute("download", filename);
        a.click();
    }
}
