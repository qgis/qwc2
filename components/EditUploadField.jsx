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
import ConfigUtils from '../utils/ConfigUtils';
import './style/EditUploadField.css';


export default class EditUploadField extends React.Component {
    static propTypes = {
        constraints: PropTypes.object,
        editLayerId: PropTypes.string,
        fieldId: PropTypes.string,
        updateField: PropTypes.func,
        value: PropTypes.string
    }
    render() {
        const fileValue = this.props.value.replace(/attachment:\/\//, '');
        const editServiceUrl = ConfigUtils.getConfigProp("editServiceUrl");
        const constraints = {
            ...this.props.constraints,
            accept: (this.props.constraints.accept || "").split(",").map(ext => mime.lookup(ext)).join(",")
        };

        return fileValue ? (
            <span className="edit-upload-field">
                <a href={editServiceUrl + "/" + this.props.editLayerId + "/attachment?file=" + encodeURIComponent(fileValue)}
                    rel="noreferrer" target="_blank"
                >
                    {fileValue.replace(/.*\//, '')}
                </a>
                <Icon icon="clear" onClick={() => this.props.updateField(this.props.fieldId, '')} />
            </span>
        ) : (
            <span className="edit-upload-field-input">
                <input name={this.props.fieldId} type="file" {...constraints} onChange={() => this.props.updateField(this.props.fieldId, '')} />
            </span>
        );
    }
}
