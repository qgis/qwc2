/**
 * Copyright 2025 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import axios from 'axios';
import PropTypes from 'prop-types';
import {v1 as uuidv1} from 'uuid';

import {processStarted, processFinished} from '../../actions/processNotifications';
import ConfigUtils from '../../utils/ConfigUtils';
import LocaleUtils from '../../utils/LocaleUtils';
import FileSelector from '../widgets/FileSelector';
import Spinner from '../widgets/Spinner';
import { importGltf } from './utils/MiscUtils3D';

import './style/ImportObjects3D.css';


class ImportObjects3D extends React.Component {
    static propTypes = {
        processFinished: PropTypes.func,
        processStarted: PropTypes.func,
        sceneContext: PropTypes.object
    };
    state = {
        importing: false,
        selectedfile: null
    };
    render() {
        return (
            <div className="importobjects3d-widget">
                <div>
                    <FileSelector
                        accept=".gltf,.ifc,.gml,.citygml,.cityjson,.3dxf" file={this.state.selectedfile}
                        onFileSelected={file => this.setState({selectedfile: file})}
                        title={LocaleUtils.tr("layertree3d.supportedformats")} />
                </div>
                <div>
                    <button className="button" disabled={this.state.selectedfile === null || this.state.importing} onClick={this.importFile} type="button">
                        {this.state.importing ? (<Spinner />) : null}
                        {LocaleUtils.tr("layertree3d.import")}
                    </button>
                </div>
            </div>
        );
    }
    importFile = () => {
        if (!this.state.selectedfile) {
            return;
        }
        const file = this.state.selectedfile;
        const taskid = uuidv1();
        this.setState({importing: true});
        this.props.processStarted(taskid, LocaleUtils.tr("import3d.importing", file.name));
        if (file.name.endsWith(".gltf")) {
            this.importGltf(file, taskid);
        } else {
            this.importTo3DTiles(file, taskid);
        }
    };
    importGltf = (file, taskid) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            importGltf(ev.target.result, file.name, this.props.sceneContext);
            this.setState({selectedfile: null, importing: false});
            this.props.processFinished(taskid, true);
        };
        reader.onerror = () => {
            this.setState({selectedfile: null, importing: false});
            this.props.processFinished(taskid, false);
        };
        reader.readAsArrayBuffer(this.state.selectedfile);
    };
    importTo3DTiles = (file, taskid) => {
        const target = this.props.sceneContext.scene.view.controls.target;
        const formData = new FormData();
        const jsonBlob = new Blob([
            JSON.stringify({
                inputs: [String(target.x), String(target.y), String(target.z), this.props.sceneContext.mapCrs]
            })
        ], {type: 'application/json'});
        formData.set('json', jsonBlob);
        formData.set('file', file);
        const headers = {
            "Content-Type": "multipart/form-data"
        };
        const ogcProcessesUrl = ConfigUtils.getConfigProp("ogcProcessesUrl");
        if (!ogcProcessesUrl) {
            this.setState({selectedfile: null, importing: false});
            this.props.processFinished(taskid, false, LocaleUtils.tr("import3d.noprocessesserver"));
            return;
        }
        axios.post(ogcProcessesUrl.replace(/\/$/, '') + '/modelimport/execution_multipart', formData, {headers}).then(response => {
            const tilesetUrl = this.props.sceneContext.options.importedTilesBaseUrl + response.data.result.value;
            this.props.sceneContext.add3dTiles(tilesetUrl, taskid, {title: file.name});
            this.setState({selectedfile: null, importing: false});
            this.props.processFinished(taskid, true);
        }).catch(err => {
            this.setState({selectedfile: null, importing: false});
            this.props.processFinished(taskid, false);
        });
    };
}


export default connect((state) => ({}), {
    processFinished: processFinished,
    processStarted: processStarted
})(ImportObjects3D);
