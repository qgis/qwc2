/**
 * Copyright 2026 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';

import {addLayer, addLayerFeatures} from '../actions/layers';
import ConfigUtils from '../utils/ConfigUtils';
import FileImportUtils from '../utils/FileImportUtils';
import LocaleUtils from '../utils/LocaleUtils';

import './style/MapDropImport.css';


/**
 * Adds layers by dropping supported files (KML, KMZ, GeoJSON, zipped Shapefile, GeoPDF) onto the map.
 *
 * Disabled if `disableImportingLocalLayers` is set in the theme or global config.
 */
class MapDropImport extends React.Component {
    static propTypes = {
        addLayer: PropTypes.func,
        addLayerFeatures: PropTypes.func,
        mapCrs: PropTypes.string,
        theme: PropTypes.object
    };
    state = {
        dragging: false
    };
    componentDidMount() {
        document.addEventListener('dragover', this.onDragOver);
        document.addEventListener('dragleave', this.onDragLeave);
        document.addEventListener('drop', this.onDrop);
    }
    componentWillUnmount() {
        document.removeEventListener('dragover', this.onDragOver);
        document.removeEventListener('dragleave', this.onDragLeave);
        document.removeEventListener('drop', this.onDrop);
    }
    render() {
        if (!this.state.dragging) {
            return null;
        }
        return (
            <div className="map-drop-import-overlay">
                <span>{LocaleUtils.tr("mapdropimport.dropfiles")}</span>
            </div>
        );
    }
    dropAllowed = (ev) => {
        return !ConfigUtils.getConfigProp("disableImportingLocalLayers", this.props.theme) &&
            [...(ev.dataTransfer?.types || [])].includes("Files") &&
            ev.target instanceof Element && ev.target.closest("#map") !== null;
    };
    onDragOver = (ev) => {
        if (this.dropAllowed(ev)) {
            ev.preventDefault();
            ev.dataTransfer.dropEffect = 'copy';
            if (!this.state.dragging) {
                this.setState({dragging: true});
            }
        } else if (this.state.dragging) {
            this.setState({dragging: false});
        }
    };
    onDragLeave = (ev) => {
        // relatedTarget is null when the drag leaves the window
        if (ev.relatedTarget === null && this.state.dragging) {
            this.setState({dragging: false});
        }
    };
    onDrop = (ev) => {
        if (this.dropAllowed(ev)) {
            ev.preventDefault();
            [...ev.dataTransfer.files].forEach(file => {
                FileImportUtils.importFile(file, this.props.mapCrs, this.props.addLayer, this.props.addLayerFeatures);
            });
        }
        this.setState({dragging: false});
    };
}

export default connect((state) => ({
    mapCrs: state.map.projection,
    theme: state.theme.current
}), {
    addLayer: addLayer,
    addLayerFeatures: addLayerFeatures
})(MapDropImport);
