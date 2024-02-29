/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import mime from 'mime-to-extensions';
import PropTypes from 'prop-types';
import {v1 as uuidv1} from 'uuid';

import ConfigUtils from '../utils/ConfigUtils';
import {showImageEditor} from '../utils/ImageEditor';
import LocaleUtils from '../utils/LocaleUtils';
import Icon from './Icon';
import ModalDialog from './ModalDialog';
import ButtonBar from './widgets/ButtonBar';

import './style/EditUploadField.css';


export default class EditUploadField extends React.Component {
    static propTypes = {
        constraints: PropTypes.object,
        dataset: PropTypes.string,
        disabled: PropTypes.bool,
        fieldId: PropTypes.string,
        name: PropTypes.string,
        report: PropTypes.bool,
        showThumbnails: PropTypes.bool,
        updateField: PropTypes.func,
        updateFile: PropTypes.func,
        value: PropTypes.string
    };
    static defaultProps = {
        showThumbnails: true,
        updateFile: () => {}
    };
    state = {
        camera: false,
        imageData: null
    };
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
        const fileValue = this.props.value.startsWith("attachment:") ? this.props.value.replace(/attachment:\/\//, '') : "";
        const fileType = mime.lookup(fileValue);
        const editServiceUrl = ConfigUtils.getConfigProp("editServiceUrl");
        const fileUrl = editServiceUrl + this.props.dataset + "/attachment?file=" + encodeURIComponent(fileValue);
        const constraints = {
            ...this.props.constraints,
            accept: (this.props.constraints.accept || "").split(",").map(ext => mime.lookup(ext)).join(",")
        };
        const mediaSupport = 'mediaDevices' in navigator && constraints.accept.split(",").includes("image/jpeg");
        const imageData = fileType && fileType.startsWith('image/') ? fileUrl : this.state.imageData;

        if (imageData) {
            if (this.props.showThumbnails) {
                const extension = fileValue ? fileValue.replace(/^.*\./, '') : 'jpg';
                const imagebuttons = [
                    {key: 'Draw', icon: 'paint', tooltip: LocaleUtils.trmsg("editing.paint"), disabled: this.props.disabled},
                    {key: 'Clear', icon: 'clear', tooltip: LocaleUtils.trmsg("editing.clearpicture"), disabled: this.props.disabled}
                ];
                return (
                    <span className="edit-upload-field-image">
                        <img onClick={() => this.download(imageData, this.props.fieldId + "." + extension)} src={imageData} />
                        {this.state.imageData ? (<input name={this.props.name} type="hidden" value={this.state.imageData} />) : null}
                        {!this.props.report ? (<ButtonBar buttons={imagebuttons} onClick={this.imageButtonClicked} tooltipPos="top" />) : null}
                    </span>
                );
            } else {
                const extension = fileValue ? fileValue.replace(/^.*\./, '') : 'jpg';
                return (
                    <span className={"edit-upload-field edit-upload-field-imagelink" + (this.props.disabled ? " edit-upload-field-disabled" : "")}>
                        {fileValue ? (
                            <a href={fileUrl} rel="noreferrer" target="_blank">{fileValue.replace(/.*\//, '')}</a>
                        ) : (
                            <a href="#" onClick={(ev) => {this.download(imageData, this.props.fieldId + "." + extension); ev.preventDefault();}} rel="noreferrer" target="_blank">{LocaleUtils.tr("editing.selectedpicture")}</a>
                        )}
                        <img onClick={() => this.download(imageData, this.props.fieldId + "." + extension)} src={imageData} />
                        {this.props.report ? null : (<Icon icon="clear" onClick={this.props.disabled ? null : this.clearImage} />)}
                    </span>
                );
            }
        } else if (fileValue) {
            return (
                <span className={"edit-upload-field edit-upload-field-imagelink" + (this.props.disabled ? " edit-upload-field-disabled" : "")}>
                    <a href={fileUrl} rel="noreferrer" target="_blank">{fileValue.replace(/.*\//, '')}</a>
                    {this.props.report ? null : (<Icon icon="clear" onClick={this.props.disabled ? null : this.clearImage} />)}
                </span>
            );
        } else if (!this.props.report) {
            return (
                <span className={"edit-upload-field-input" + (this.props.disabled ? " edit-upload-field-input-disabled" : "")}>
                    <input disabled={this.props.disabled} name={this.props.name} type="file" {...constraints} onChange={this.fileSelected} />
                    {mediaSupport ? (<Icon icon="camera" onClick={this.props.disabled ? null : this.enableCamera} />) : null}
                    {this.state.camera ? this.renderCaptureFrame() : null}
                </span>
            );
        } else {
            return null;
        }
    }
    fileSelected = (ev) => {
        if (ev.target.files[0].type.startsWith("image/")) {
            const reader = new FileReader();
            reader.readAsDataURL(ev.target.files[0]);
            reader.onload = () => {
                this.setState({imageData: reader.result});
                this.props.updateFile(this.props.fieldId, new File([this.dataUriToBlob(reader.result)], ev.target.files[0].name, {type: ev.target.files[0].type}));
                this.props.updateField(this.props.fieldId, '');
            };
        } else {
            this.props.updateField(this.props.fieldId, '');
            this.props.updateFile(this.props.fieldId, ev.target.files[0]);
        }
    };
    enableCamera = () => {
        this.setState({camera: true});
    };
    disableCamera = () => {
        this.disableMediaStream();
        this.setState({camera: false});
    };
    renderCaptureFrame = () => {
        return (
            <ModalDialog icon="camera" onClose={this.disableCamera} title={LocaleUtils.tr("editing.takepicture")}>
                <video className="edit-capture-frame" ref={this.activateMediaStream} />
                <div className="edit-capture-controls">
                    <Icon icon="camera" onClick={this.capturePicture} />
                </div>
            </ModalDialog>
        );
    };
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
            this.props.updateFile(this.props.fieldId, new File([this.dataUriToBlob(imageData)], uuidv1() + ".jpg", {type: "image/jpeg"}));
        }
        this.disableCamera();
    };
    imageButtonClicked = (action) => {
        if (action === "Draw") {
            const fileValue = this.props.value.startsWith("attachment:") ? this.props.value.replace(/attachment:\/\//, '') : "";
            const fileType = mime.lookup(fileValue);
            const editServiceUrl = ConfigUtils.getConfigProp("editServiceUrl");
            const fileUrl = editServiceUrl + this.props.dataset + "/attachment?file=" + encodeURIComponent(fileValue);
            const imageData = fileType && fileType.startsWith('image/') ? fileUrl : this.state.imageData;
            showImageEditor(imageData, (newImageData) => {
                this.setState({imageData: newImageData});
                this.props.updateField(this.props.fieldId, '');
                this.props.updateFile(this.props.fieldId, new File([this.dataUriToBlob(newImageData)], uuidv1() + ".jpg", {type: "image/jpeg"}));
            });
        } else if (action === "Clear") {
            this.clearImage();
        }
    };
    clearImage = () => {
        this.setState({imageData: null});
        this.props.updateField(this.props.fieldId, '');
        this.props.updateFile(this.props.fieldId, null);
    };
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
                // eslint-disable-next-line
                console.warn("Unable to access camera: " + err);
            });
        }
    };
    disableMediaStream = () => {
        if (this.cameraStream) {
            this.cameraStream.getTracks()[0].stop();
            this.cameraStream = null;
            this.videoElement = null;
        }
    };
    download = (href, filename) => {
        const a = document.createElement("a");
        a.href = href;
        a.target = "_blank";
        a.setAttribute("download", filename);
        a.click();
    };
    dataUriToBlob = (dataUri) => {
        const parts = dataUri.split(',');
        const byteString = parts[0].indexOf('base64') >= 0 ? atob(parts[1]) : decodeURI(parts[1]);
        const mimeString = parts[0].split(':')[1].split(';')[0];

        const ia = new Uint8Array(byteString.length);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        return new Blob([ia], {type: mimeString});
    };
}
