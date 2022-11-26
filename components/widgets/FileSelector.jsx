/**
 * Copyright 2017-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import Icon from '../Icon';
import LocaleUtils from '../../utils/LocaleUtils';
import './style/FileSelector.css';

export default class FileSelector extends React.Component {
    static propTypes = {
        accept: PropTypes.string,
        file: PropTypes.object,
        onFileSelected: PropTypes.func
    }
    constructor(props) {
        super(props);
        this.fileinput = null;
    }
    componentDidUpdate(prevProps, prevState) {
        if (!this.props.file && this.fileinput) {
            this.fileinput.value = null;
        }
    }
    render() {
        let value = "";
        if (this.props.file) {
            value = this.props.file.name + " (" + this.humanFileSize(this.props.file.size) + ")";
        }
        const placeholder = LocaleUtils.tr("fileselector.placeholder");
        return (
            <div className="FileSelector" onClick={this.triggerFileOpen}>
                <input placeholder={placeholder} readOnly type="text" value={value} />
                <button className="button">
                    <Icon icon="folder-open" />
                </button>
                <input accept={this.props.accept} onChange={this.fileChanged} ref={el => { this.fileinput = el; }} type="file" />
            </div>
        );
    }
    triggerFileOpen = () => {
        if (this.fileinput) {
            this.fileinput.click();
        }
    }
    fileChanged = (ev) => {
        let file = null;
        if (ev.target.files && ev.target.files.length > 0) {
            file = ev.target.files[0];
        }
        this.props.onFileSelected(file);
    }
    humanFileSize(bytes) {
        const thresh = 1000;
        const units = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        let u = 0;
        for (; bytes >= thresh && u < units.length; ++u) {
            bytes /= thresh;
        }
        return bytes.toFixed(1) + ' ' + units[u];
    }
}
