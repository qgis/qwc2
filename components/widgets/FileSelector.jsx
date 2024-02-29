/**
 * Copyright 2017-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';

import PropTypes from 'prop-types';

import LocaleUtils from '../../utils/LocaleUtils';
import Icon from '../Icon';

import './style/FileSelector.css';

export default class FileSelector extends React.Component {
    static propTypes = {
        accept: PropTypes.string,
        file: PropTypes.object,
        multiple: PropTypes.bool,
        onFileSelected: PropTypes.func,
        onFilesSelected: PropTypes.func,
        overrideText: PropTypes.string,
        showAllFilenames: PropTypes.bool
    };
    static defaultProps = {
        multiple: false,
        showAllFilenames: false,
        overrideText: null
    };
    constructor(props) {
        super(props);
        this.fileinput = null;
    }
    componentDidUpdate(prevProps) {
        if (prevProps.file && !this.props.file && this.fileinput) {
            this.fileinput.value = null;
        }
    }
    render() {
        let value = "";
        if (this.props.overrideText) {
            value = this.props.overrideText;
        } else if (this.props.file) {
            if (this.props.file instanceof FileList) {
                // handle multiple files
                const files = Array.from(this.props.file);
                const count = files.length;
                const totalBytes = files.reduce((acc, file) => acc + file.size, 0);
                value = this.props.showAllFilenames ? files.map(file => file.name).join(", ") : count + " " + LocaleUtils.tr("fileselector.files");
                value += " (" + this.humanFileSize(totalBytes) + ")";
            } else {
                // handle single file
                value = this.props.file.name + " (" + this.humanFileSize(this.props.file.size) + ")";
            }
        }
        const placeholder = LocaleUtils.tr("fileselector.placeholder");
        return (
            <div className="FileSelector" onClick={this.triggerFileOpen}>
                <input placeholder={placeholder} readOnly type="text" value={value} />
                <button className="button">
                    <Icon icon="folder-open" />
                </button>
                <input accept={this.props.accept} multiple={this.props.multiple} onChange={this.fileChanged} ref={el => { this.fileinput = el; }} type="file" />
            </div>
        );
    }
    triggerFileOpen = () => {
        if (this.fileinput) {
            this.fileinput.click();
        }
    };
    fileChanged = (ev) => {
        let files = null;
        if (ev.target.files && ev.target.files.length > 0) {
            files = ev.target.files;
        }
        this.props.multiple ? this.props.onFilesSelected(files) : this.props.onFileSelected(files[0]);
    };
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
