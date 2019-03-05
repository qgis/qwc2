/**
* Copyright 2017, Sourcepole AG.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/

const React = require('react');
const PropTypes = require('prop-types');
const Icon = require('../Icon');
const LocaleUtils = require('../../utils/LocaleUtils');
require('./style/FileSelector.css');

class FileSelector extends React.Component {
    static propTypes = {
        file: PropTypes.object,
        accept: PropTypes.string,
        onFileSelected: PropTypes.func
    }
    static contextTypes = {
        messages: PropTypes.object
    }
    constructor(props) {
        super(props);
        this.fileinput = null;
    }
    componentWillReceiveProps(newProps) {
        if(!newProps.file && this.fileinput) {
            this.fileinput.value = null;
        }
    }
    render() {
        let value = "";
        if(this.props.file) {
            value = this.props.file.name + " (" + this.humanFileSize(this.props.file.size) + ")";
        }
        let placeholder = LocaleUtils.getMessageById(this.context.messages, "fileselector.placeholder");
        return (
            <div className="FileSelector" onClick={this.triggerFileOpen}>
                <input type="text" readOnly={true} placeholder={placeholder} value={value}/>
                <span>
                    <Icon icon="folder-open" />
                </span>
                <input type="file" onChange={this.fileChanged} accept={this.props.accept} ref={el => this.fileinput = el}/>
            </div>
        );
    }
    triggerFileOpen = (ev) => {
        if(this.fileinput) {
            this.fileinput.click();
        }
    }
    fileChanged = (ev) => {
        let file = null;
        if(ev.target.files && ev.target.files.length > 0) {
            file = ev.target.files[0];
        }
        this.props.onFileSelected(file);
    }
    humanFileSize(bytes) {
        const thresh = 1000;
        const units = ['B', 'kB','MB','GB','TB','PB','EB','ZB','YB']
        let u = 0;
        for(; bytes >= thresh && u < units.length; ++u) {
            bytes /= thresh;
        }
        return bytes.toFixed(1) + ' ' + units[u];
    }
};

module.exports = FileSelector;
