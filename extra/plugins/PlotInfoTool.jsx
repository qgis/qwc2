/**
 * Copyright 2019-2021 Sourcepole AG
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

import {LayerRole, addThemeSublayer, addLayerFeatures, removeLayer} from '../../actions/layers';
import {logAction} from '../../actions/logging';
import {zoomToPoint} from '../../actions/map';
import {setCurrentTask} from '../../actions/task';
import Icon from '../../components/Icon';
import MapSelection from '../../components/MapSelection';
import ResizeableWindow from '../../components/ResizeableWindow';
import Spinner from '../../components/widgets/Spinner';
import ConfigUtils from '../../utils/ConfigUtils';
import CoordinatesUtils from '../../utils/CoordinatesUtils';
import LocaleUtils from '../../utils/LocaleUtils';
import MapUtils from '../../utils/MapUtils';
import {UrlParams} from '../../utils/PermaLinkUtils';
import VectorLayerUtils from '../../utils/VectorLayerUtils';

import './style/PlotInfoTool.css';

/**
 * Plugin for requesting plot information, including Swiss Public-law Restrictions on landownership (PLR) cadastre.
 *
 * **`config.json` sample configuration:**
 *
 * ```
 * {
 *   "name": "PlotInfoTool",
 *   "cfg": {
 *     "toolLayers": ["<layer_name>", ...],
 *     "infoQueries": [
 *       {
 *         "key": "plotdescr",
 *         "titleMsgId": "plotdescr.title",
 *         "query": "/plot/$egrid$",
 *         "pdfQuery": null,
 *         "urlKey": "cadastre_egrid"
 *       },
 *       {
 *         "key": "oereb",
 *         "titleMsgId": "oereb.title",
 *         "query": "/oereb/json/$egrid$",
 *         "pdfQuery": "/oereb/pdf/$egrid$",
 *         "pdfTooltip": "oereb.requestPdf",
 *         "urlKey": "oereb_egrid",
 *         "cfg": {
 *           "subthemes": {
 *             "LandUsePlans": ["Grundnutzung", "Überlagerungen", "Linienbezogene Festlegungen", "Objektbezogene Festlegungen"]
 *           }
 *         }
 *       }
 *     ]
 *   }
 * }
 * ```
 * Where:
 *
 * * `toolLayers`: List of layers to load when activating tool.
 * * `infoQueries`: List of additional info queries to offer in the dialog (PLR cadastre query is built-in). By default, these render some HTML data in an iframe. If a custom component is needed for rendering the result, see configuration in `appConfig.js` below.
 *   - `key`: A unique key name.
 *   - `title`: The human visible title.
 *   - `titleMsgId`: Instead of `title`, a message id for the title which will be looked up in the translations.
 *   - `query`: The query to perform to retreive the info. Must return HTML, which is then rendered in an iframe. `$egrid$` is replaced with the EGRID of the current plot. If the specified URL is relative, it is resolved with respect to `plotInfoService` as defined in `config.json`.
 *   - `pdfQuery`: Optional query to retreive a PDF report, which is then presented as a download the the user. Again, `$egrid$` is replaced with the EGRID of the current plot.
 *   - `pdfTooltip`: Message id for the pdf button tooltip.
 *   - `urlKey`: Optional query parameter key name. If QWC2 is started with `<urlKey>=<egrid>` in the URL, the plot info tool is automatically enabled and the respective query performed.
 *   - `cfg`: Arbitrary custom config to pass to a custom component, see `appConfig.js` configuration below.
 *
 * **`appConfig.js` configuration:**
 *
 * Sample `PlotInfoToolPlugin` configuration, as can be defined in the `cfg` section of `pluginsDef` in `appConfig.js`:
 *
 * ```
 * PlotInfoToolPlugin: {
 *   themeLayerRestorer: require('./themeLayerRestorer'),
 *   customInfoComponents: {
 *     oereb: require('qwc2-extra/components/OerebDocument')
 *   }
 * }
 * ```
 * Where:
 *
 * * `themeLayerRestorer`: Function which restores theme layers, used for loading the `toolLayers` specified in the configuration in `config.json`. See `themeLayerRestorer` in the [sample `appConfig.js`](https://github.com/qgis/qwc2-demo-app/blob/master/js/appConfig.js).
 * * `customInfoComponents`: Customized components for rendering plot info query results. The `key` specifies a the info query for which this component should be used, as specified in `infoQueries` in config.json (see above). An example of a minimal custom component:
 *
 *       class CustomPlotInfoComponent extends React.Component {
 *         static propTypes = {
 *           data: PropTypes.object, // PropType according to format of data returned by the specified query URL
 *           config: PropTypes.object // Custom configuration
 *         }
 *         render() {
 *           return (<div>{this.props.data.field}</div>);
 *         }
 *       };
 *
 *       module.exports = CustomPlotInfoComponent;
 */
class PlotInfoTool extends React.Component {
    static propTypes = {
        addLayerFeatures: PropTypes.func,
        addThemeSublayer: PropTypes.func,
        currentTask: PropTypes.string,
        customInfoComponents: PropTypes.object,
        infoQueries: PropTypes.array,
        logAction: PropTypes.func,
        map: PropTypes.object,
        removeLayer: PropTypes.func,
        setCurrentTask: PropTypes.func,
        theme: PropTypes.object,
        themeLayerRestorer: PropTypes.func,
        toolLayers: PropTypes.array,
        windowSize: PropTypes.object,
        zoomToPoint: PropTypes.func
    };
    static defaultProps = {
        toolLayers: [],
        infoQueries: [],
        customInfoComponents: {},
        windowSize: {width: 500, height: 800}
    };
    state = {
        plotInfo: null,
        currentPlot: null,
        expandedInfo: null,
        expandedInfoData: null,
        pendingPdfs: []
    };
    componentDidUpdate(prevProps, prevState) {
        if (this.props.theme && !prevProps.theme) {
            if (UrlParams.getParam('realty') !== undefined) {
                this.props.setCurrentTask('PlotInfoTool');
            } else {
                for (const entry of this.props.infoQueries) {
                    if (entry.urlKey && UrlParams.getParam(entry.urlKey)) {
                        this.props.setCurrentTask('PlotInfoTool');
                        this.queryInfoByEgrid(entry, UrlParams.getParam(entry.urlKey));
                        UrlParams.updateParams({[entry.urlKey]: undefined});
                        break;
                    }
                }
            }
        } else if (this.props.currentTask === 'PlotInfoTool' && prevProps.currentTask !== 'PlotInfoTool') {
            this.activated();
        } else if (this.props.currentTask !== 'PlotInfoTool' && prevProps.currentTask === 'PlotInfoTool') {
            this.deactivated();
        }

        if (this.state.plotInfo) {
            if (
                this.state.plotInfo !== prevState.plotInfo ||
                this.state.currentPlot !== prevState.currentPlot
            ) {
                const layer = {
                    id: "plotselection",
                    role: LayerRole.SELECTION
                };
                const wkt = this.state.plotInfo[this.state.currentPlot].geom;
                const feature = VectorLayerUtils.wktToGeoJSON(wkt, "EPSG:2056", this.props.map.projection);
                feature.styleName = 'default';
                feature.styleOptions = {
                    fillColor: [0, 0, 0, 0],
                    strokeColor: [242, 151, 84, 0.75],
                    strokeWidth: 8,
                    strokeDash: []
                };
                this.props.addLayerFeatures(layer, [feature], true);
            }
        } else if (prevState.plotInfo && !this.state.plotInfo) {
            this.props.removeLayer("plotselection");
        }
    }
    render() {
        if (this.props.currentTask !== 'PlotInfoTool') {
            return null;
        }
        let resultDialog = null;

        if (!isEmpty(this.state.plotInfo)) {
            let scrollable = false;
            if (this.state.expandedInfo) {
                const entry = this.props.infoQueries.find(e => e.key === this.state.expandedInfo);
                if (entry) {
                    scrollable = entry.scrollmode === "parent";
                }
            }
            resultDialog = (
                <ResizeableWindow icon="plot_info" initialHeight={this.props.windowSize.height}
                    initialWidth={this.props.windowSize.width} initialX={0}
                    initialY={0} key="PlotInfoWindow" onClose={() => this.props.setCurrentTask(null)}
                    scrollable={scrollable} title={LocaleUtils.tr("appmenu.items.PlotInfoTool")}
                >
                    {this.renderBody()}
                </ResizeableWindow>
            );
        }
        const assetsPath = ConfigUtils.getAssetsPath();
        const selectionStyleOptions = {
            fillColor: [0, 0, 0, 0],
            strokeColor: [0, 0, 0, 0]
        };
        return [resultDialog, (
            <MapSelection
                active cursor={'url("' + assetsPath + '/img/plot-info-marker.png") 12 12, default'}
                geomType="Point"
                geometryChanged={geom => this.queryBasicInfoAtPoint(geom.coordinates)} key="MapSelection"
                styleOptions={selectionStyleOptions}
            />
        )];
    }
    renderBody = () => {
        const plotServiceUrl = ConfigUtils.getConfigProp("plotInfoService").replace(/\/$/, '');
        const plot = this.state.plotInfo[this.state.currentPlot];
        return (
            <div className="plot-info-dialog-body" role="body">
                <div className="plot-info-dialog-header">
                    {this.state.plotInfo.map((entry, idx) => ([(
                        <div className="plot-info-result-header" key={"result-header-" + idx} onClick={() => this.toggleCurrentPlot(idx)}>
                            <Icon icon={this.state.currentPlot === idx ? "collapse" : "expand"} />
                            <span>{entry.label}</span>
                        </div>
                    ), this.state.currentPlot !== idx ? null : (
                        <div className="plot-info-result-body" key={"result-body-" + idx}>
                            <table><tbody>
                                {plot.fields.map(e => (
                                    <tr key={e.key}>
                                        <td dangerouslySetInnerHTML={{__html: e.key}} />
                                        <td><div dangerouslySetInnerHTML={{__html: e.value}} /></td>
                                    </tr>
                                ))}
                            </tbody></table>
                        </div>
                    )]))}
                </div>
                <div className="plot-info-dialog-queries">
                    {this.props.infoQueries.map((entry) => {
                        let query = entry.query.replace('$egrid$', plot.egrid);
                        if (!query.startsWith('http')) {
                            query = plotServiceUrl + query;
                        }
                        let pdfQuery = entry.pdfQuery ? entry.pdfQuery.replace('$egrid$', plot.egrid) : null;
                        if (pdfQuery && !pdfQuery.startsWith('http')) {
                            pdfQuery = plotServiceUrl + pdfQuery;
                        }
                        const pdfTooltip = entry.pdfTooltip ? LocaleUtils.tr(entry.pdfTooltip) : "";
                        const expanded = this.state.expandedInfo === entry.key;
                        return [
                            (
                                <div className="plot-info-dialog-query-title" key={entry.key + "-title"} onClick={() => this.toggleEgridInfo(entry, query)}>
                                    <Icon icon={expanded ? "collapse" : "expand"} />
                                    <span>{entry.titleMsgId ? LocaleUtils.tr(entry.titleMsgId) : entry.title}</span>
                                    {entry.pdfQuery ?
                                        this.state.pendingPdfs.includes(pdfQuery) ? (<Spinner />) :
                                            (<Icon icon="pdf" onClick={ev => this.queryPdf(ev, entry, pdfQuery)} title={pdfTooltip} />)
                                        : null}
                                </div>
                            ),
                            expanded ? (
                                <div className="plot-info-dialog-query-result" key={entry.key + "-result"}>
                                    {!this.state.expandedInfoData ? this.renderWait() : this.state.expandedInfoData.failed ? this.renderError() : this.renderInfoData()}
                                </div>
                            ) : null
                        ];
                    })}
                </div>
            </div>
        );
    };
    toggleCurrentPlot = (idx) => {
        if (this.state.currentPlot !== idx) {
            this.setState({currentPlot: idx, expandedInfo: null, expandedInfoData: null, pendingPdfs: []});
        }
    };
    renderWait = () => {
        return (
            <div className="plot-info-dialog-query-loading">
                <Spinner />
                <span>{LocaleUtils.tr("plotinfotool.loading")}</span>
            </div>
        );
    };
    renderError = () => {
        return (
            <div className="plot-info-dialog-query-failed">
                {this.state.expandedInfoData.failed === true ? LocaleUtils.tr("plotinfotool.failed") : LocaleUtils.tr(this.state.expandedInfoData.failed)}
            </div>
        );
    };
    renderInfoData = () => {
        if (this.props.customInfoComponents[this.state.expandedInfo]) {
            const Component = this.props.customInfoComponents[this.state.expandedInfo];
            const config = (this.props.infoQueries.find(entry => entry.key === this.state.expandedInfo) || {}).cfg || {};
            return (<Component config={config} data={this.state.expandedInfoData} />);
        } else {
            const assetsPath = ConfigUtils.getAssetsPath();
            const src = assetsPath + "/templates/blank.html";
            return (
                <iframe onLoad={ev => this.setIframeContent(ev.target, this.state.expandedInfoData)} src={src} />
            );
        }
    };
    setIframeContent = (iframe, html) => {
        if (!iframe.getAttribute("identify-content-set")) {
            iframe.setAttribute("identify-content-set", true);
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            doc.open();
            doc.write(html);
            doc.close();
        }
    };
    activated = () => {
        this.props.themeLayerRestorer(this.props.toolLayers, null, layers => {
            this.props.addThemeSublayer({sublayers: layers});
        });
    };
    deactivated = () => {
        this.setState({plotInfo: null, currentPlot: null, expandedInfo: null, expandedInfoData: null, pendingPdfs: []});
    };
    queryBasicInfoAtPoint = (point) => {
        const serviceUrl = ConfigUtils.getConfigProp("plotInfoService").replace(/\/$/, '') + '/';
        const params = {
            x: point[0],
            y: point[1]
        };
        axios.get(serviceUrl, {params}).then(response => {
            const plotInfo = !isEmpty(response.data.plots) ? response.data.plots : null;
            this.setState({plotInfo: plotInfo, currentPlot: 0, expandedInfo: null, expandedInfoData: null});
        }).catch(() => {});
    };
    queryInfoByEgrid = (query, egrid) => {
        const serviceUrl = ConfigUtils.getConfigProp("plotInfoService").replace(/\/$/, '');
        axios.get(serviceUrl + '/query/' + egrid).then(response => {
            const plotInfo = !isEmpty(response.data.plots) ? response.data.plots : null;
            this.setState({plotInfo: plotInfo, currentPlot: 0, expandedInfo: null, expandedInfoData: null});
            if (plotInfo) {
                const bounds = CoordinatesUtils.reprojectBbox(plotInfo[0].bbox, 'EPSG:2056', this.props.map.projection);
                const zoom = MapUtils.getZoomForExtent(bounds, this.props.map.resolutions, this.props.map.size, 0, this.props.map.scales.length - 1) - 1;
                this.props.zoomToPoint([0.5 * (bounds[0] + bounds[2]), 0.5 * (bounds[1] + bounds[3])], zoom, 'EPSG:2056');
                let url = query.query.replace('$egrid$', egrid);
                if (!url.startsWith('http')) {
                    url = serviceUrl + url;
                }
                this.toggleEgridInfo(query, url);
            }
        }).catch(e => {
            // eslint-disable-next-line
            alert("Query failed");
            // eslint-disable-next-line
            console.warn(e);
        });
    };
    queryPdf = (ev, infoEntry, queryUrl) => {
        this.props.logAction("PLOTINFO_PDF_QUERY", {info: infoEntry.key});
        ev.stopPropagation();
        this.setState((state) => ({pendingPdfs: [...state.pendingPdfs, queryUrl]}));
        axios.get(queryUrl, {responseType: 'blob', validateStatus: status => status >= 200 && status < 300 && status !== 204}).then(response => {
            const contentType = response.headers["content-type"];
            let filename = infoEntry.key + '.pdf';
            try {
                const contentDisposition = response.headers["content-disposition"];
                filename = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition)[1];
            } catch {
                /* Pass */
            }
            FileSaver.saveAs(new Blob([response.data], {type: contentType}), filename);
            this.setState((state) => ({pendingPdfs: state.pendingPdfs.filter(entry => entry !== queryUrl)}));
        }).catch(() => {
            this.setState((state) => ({pendingPdfs: state.pendingPdfs.filter(entry => entry !== queryUrl)}));
            const errorMsg = infoEntry.failMsgId ? LocaleUtils.tr(infoEntry.failMsgId) : "";
            // eslint-disable-next-line
            alert(errorMsg || "Print failed");
        });
    };
    toggleEgridInfo = (infoEntry, queryUrl) => {
        if (this.state.expandedInfo === infoEntry.key) {
            this.setState({expandedInfo: null, expandedInfoData: null});
        } else {
            this.props.logAction("PLOTINFO_QUERY", {info: infoEntry.key});
            this.setState({expandedInfo: infoEntry.key, expandedInfoData: null});
            axios.get(queryUrl).then(response => {
                this.setState({expandedInfoData: response.data || {failed: infoEntry.failMsgId || true}});
            }).catch(() => {
                this.setState({expandedInfoData: {failed: infoEntry.failMsgId || true}});
            });
        }
    };
}

export default connect(state => ({
    map: state.map,
    theme: state.theme.current,
    currentTask: state.task.id
}), {
    setCurrentTask: setCurrentTask,
    addThemeSublayer: addThemeSublayer,
    addLayerFeatures: addLayerFeatures,
    removeLayer: removeLayer,
    zoomToPoint: zoomToPoint,
    logAction: logAction
})(PlotInfoTool);
