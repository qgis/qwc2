/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import axios from 'axios';
import FileSaver from 'file-saver';
import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';

import {LayerRole, addLayerFeatures, clearLayer, changeLayerProperty} from '../actions/layers';
import Icon from '../components/Icon';
import MapSelection from '../components/MapSelection';
import PickFeature from '../components/PickFeature';
import SideBar from '../components/SideBar';
import ButtonBar from '../components/widgets/ButtonBar';
import ComboBox from '../components/widgets/ComboBox';
import Spinner from '../components/widgets/Spinner';
import ConfigUtils from '../utils/ConfigUtils';
import IdentifyUtils from '../utils/IdentifyUtils';
import LayerUtils from '../utils/LayerUtils';
import LocaleUtils from '../utils/LocaleUtils';
import VectorLayerUtils from '../utils/VectorLayerUtils';

import './style/Reports.css';


/**
 * Allow generating reports for selected features.
 *
 * This plugin displays all available reports for the current theme,
 * allows selecting one or more or all features of the layer, and finally generating
 * an aggregated report for all selected features.
 *
 * Requires `documentServiceUrl` in `config.json` to point to a `qwc-document-service`.
 */
class Reports extends React.Component {
    static propTypes = {
        addLayerFeatures: PropTypes.func,
        changeLayerProperty: PropTypes.func,
        clearLayer: PropTypes.func,
        layers: PropTypes.array,
        map: PropTypes.object,
        /** The side of the application on which to display the sidebar. */
        side: PropTypes.string
    };
    static defaultState = {
        reports: {},
        selectedReport: '',
        reportFeatures: [],
        featureSelectionMode: '',
        featureSelectionPolygon: null,
        generatingReport: false
    };
    constructor(props) {
        super(props);
        this.state = {...Reports.defaultState};
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.state.reportFeatures !== prevState.reportFeatures) {
            if (!isEmpty(this.state.reportFeatures)) {
                const layer = {
                    id: "report-pick-selection",
                    role: LayerRole.SELECTION,
                    skipPrint: true
                };
                this.props.addLayerFeatures(layer, this.state.reportFeatures, true);
            } else if (!isEmpty(prevState.reportFeatures)) {
                this.props.clearLayer("report-pick-selection");
            }
        }
    }
    renderBody = () => {
        const pickButtons = [
            {key: 'Pick', icon: 'pick', label: LocaleUtils.tr("common.pick")},
            {key: 'Region', icon: 'pick_region', label: LocaleUtils.tr("reports.region")},
            {key: 'All', icon: 'ok', label: LocaleUtils.tr("common.all"), forceLabel: true}
        ];
        return (
            <div className="reports-body">
                <div>
                    <ComboBox
                        className="reports-filter-combo" filterable
                        onChange={this.setSelectedReport}
                        placeholder={LocaleUtils.tr("reports.selectlayer")}
                        value={this.state.selectedReport}
                    >
                        {Object.entries(this.state.reports).map(([layername, reports]) => {
                            return reports.map((report, idx) => (
                                <div key={layername + "::" + idx} title={report.title} value={layername + "::" + idx}>{report.title}</div>
                            ));
                        })}
                    </ComboBox>
                </div>
                <div>
                    <ButtonBar
                        active={this.state.featureSelectionMode} buttons={pickButtons}
                        disabled={!this.state.selectedReport} onClick={this.setPickMode}
                    />
                </div>
                <div>
                    <button
                        className="button reports-download-button"
                        disabled={this.state.generatingReport || (isEmpty(this.state.reportFeatures) && this.state.featureSelectionMode !== "All")}
                        onClick={this.downloadReport} type="button"
                    >
                        {this.state.generatingReport ? (<Spinner />) : (<Icon icon="report" />)}
                        <span>{LocaleUtils.tr("common.download")}</span>
                    </button>
                </div>
            </div>
        );
    };
    render() {
        const [layerUrl, layerName] = this.state.selectedReport.split(/(?:::|#)/);
        return [(
            <SideBar icon="report" id="Reports" key="Reports" onHide={this.onHide} onShow={this.onShow} side={this.props.side}
                title={LocaleUtils.tr("appmenu.items.Reports")} width="20em">
                {() => ({
                    body: this.renderBody()
                })}
            </SideBar>
        ),
        this.state.featureSelectionMode === "Pick" && this.state.selectedReport ? (
            <PickFeature featurePicked={this.selectReportFeature} key="FeaturePicker" layerFilter={{url: layerUrl, name: layerName}} />
        ) : null,
        this.state.featureSelectionMode === "Region" ? (
            <MapSelection
                active
                geomType={"Polygon"}
                geometry={this.state.featureSelectionPolygon}
                geometryChanged={this.setFeatureSelectionPolygon}
                hideGeometry
                key="MapSelection" />
        ) : null
        ];
    }
    setLayerVisible = (layerUrl, layerName) => {
        const path = [];
        let sublayer = null;
        const layer = this.props.layers.find(l => (l.url === layerUrl && (sublayer = LayerUtils.searchSubLayer(l, 'name', layerName, path))));
        if (layer && sublayer) {
            this.props.changeLayerProperty(layer.id, "visibility", true, path, "parents");
        }
    };
    setSelectedReport = (key) => {
        const [layerUrl, layerName] = key.split(/(?:::|#)/);
        this.setLayerVisible(layerUrl, layerName);
        this.setState({selectedReport: key, reportFeatures: []});
    };
    setPickMode = (mode) => {
        this.setState({featureSelectionMode: mode, reportFeatures: [], featureSelectionPolygon: null});
    };
    onShow = () => {
        const reports = LayerUtils.collectFeatureReports(this.props.layers);
        this.setState({reports, featureSelectionMode: 'Pick'});
    };
    onHide = () => {
        this.props.clearLayer("report-pick-selection");
        this.setState({...Reports.defaultState});
    };
    selectReportFeature = (layer, feature) => {
        if (!feature) {
            return;
        }
        this.setState((state) => {
            const index = state.reportFeatures.findIndex(f => f.id === feature.id);
            if (index >= 0) {
                const newReportFeatures = state.reportFeatures.slice(0);
                newReportFeatures.splice(index, 1);
                return {reportFeatures: newReportFeatures};
            } else {
                return {reportFeatures: [...state.reportFeatures, feature]};
            }
        });
    };
    setFeatureSelectionPolygon = (geom) => {
        this.setState({featureSelectionPolygon: geom});
        const poly = geom.coordinates[0];
        if (poly.length < 3) {
            return;
        }
        const center = [0, 0];
        poly.forEach(point => {
            center[0] += point[0];
            center[1] += point[1];
        });
        center[0] /= poly.length;
        center[1] /= poly.length;

        const filter = VectorLayerUtils.geoJSONGeomToWkt(geom);
        const params = {feature_count: 100};
        const [layerUrl, layerName] = this.state.selectedReport.split(/(?:::|#)/);
        const layer = this.props.layers.find(l => l.url === layerUrl);
        const request = IdentifyUtils.buildFilterRequest(layer, layerName, filter, this.props.map, params);
        IdentifyUtils.sendRequest(request, (response) => {
            if (response) {
                const result = IdentifyUtils.parseResponse(response, layer, request.params.info_format, center, this.props.map.projection);
                this.setState((state) => ({reportFeatures: result[layerName]}));
            }
        });
    };
    downloadReport = () => {
        const serviceUrl = ConfigUtils.getConfigProp("documentServiceUrl").replace(/\/$/, "");
        let featureIds = '';
        if (this.state.featureSelectionMode === "All") {
            featureIds = '*';
        } else {
            featureIds = this.state.reportFeatures.map(feature => feature.id).join(",");
        }
        this.setState({generatingReport: true});
        const [layername, idx] = this.state.selectedReport.split("::");
        const report = this.state.reports[layername][idx];
        const params = {
            feature: featureIds,
            crs: this.props.map.projection,
            single_report: report.single_report || false
        };
        const url = serviceUrl + "/" + report.template + "." + (report.format || "pdf");
        axios.get(url, {responseType: "arraybuffer", params}).then(response => {
            const filename = (report.filename || report.title.replace(" ", "_")) + "." + (report.format || "pdf");
            FileSaver.saveAs(new Blob([response.data], {type: "application/pdf"}), filename);
            this.setState({generatingReport: false});
        }).catch(() => {
            /* eslint-disable-next-line */
            alert(LocaleUtils.tr("identify.reportfail"));
            this.setState({generatingReport: false});
        });
    };
}

export default connect(state => ({
    layers: state.layers.flat,
    map: state.map
}), {
    addLayerFeatures: addLayerFeatures,
    changeLayerProperty: changeLayerProperty,
    clearLayer: clearLayer
})(Reports);
