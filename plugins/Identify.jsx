/**
 * Copyright 2017-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';

import IdentifyTool from '../components/IdentifyTool';
import ConfigUtils from '../utils/ConfigUtils';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import LocaleUtils from '../utils/LocaleUtils';
import {UrlParams} from '../utils/PermaLinkUtils';


/**
 * Displays queried feature attributes.
 *
 * Uses WMS GetFeatureInfo to query features and displays the result in
 * table, as a HTML fragment or as plain text based on the supported GetFeatureInfo
 * format.
 *
 * Extendable in combination with the `qwc-feature-info-service`, which provides support
 * for customized queries and templates for the result presentation.
 */
class Identify extends React.Component {
    static propTypes = {
        /** Whether to append results by default (without having to press `CTRL` when clicking). */
        appendResultsByDefault: PropTypes.bool,
        /** Available region identify modes. */
        availableRegionModes: PropTypes.arrayOf(PropTypes.string),
        /** Whether to clear the identify results when exiting the identify tool. */
        clearResultsOnClose: PropTypes.bool,
        currentSearchResult: PropTypes.object,
        /** Whether to enable the aggregated report download button. */
        enableAggregatedReports: PropTypes.bool,
        /** Whether to enable the possibility select results for comparison. */
        enableCompare: PropTypes.bool,
        /** Whether to enable the export functionality. Either `true|false` or a list of single allowed formats (builtin formats: `json`, `geojson`, `csv`, `csvzip`, `shapefile`, `xlsx`). If a list is provided, the export formats will be sorted according to that list, and the default format will be the first format of the list. */
        enableExport: PropTypes.oneOfType([PropTypes.bool, PropTypes.array]),
        enabled: PropTypes.bool,
        /** Whether to clear the task when the results window is closed. */
        exitTaskOnResultsClose: PropTypes.bool,
        /** Whether to include the geometry in exported features. Default: `true`. */
        exportGeometry: PropTypes.bool,
        /** Default window geometry with size, position and docking status. Positive position values (including '0') are related to top (InitialY) and left (InitialX), negative values (including '-0') to bottom (InitialY) and right (InitialX). */
        geometry: PropTypes.shape({
            initialWidth: PropTypes.number,
            initialHeight: PropTypes.number,
            initialX: PropTypes.number,
            initialY: PropTypes.number,
            initiallyDocked: PropTypes.bool,
            side: PropTypes.string,
            minimizeable: PropTypes.bool
        }),
        /** Whether to highlight all results if no result is hovered. */
        highlightAllResults: PropTypes.bool,
        /** Whether to trigger an identify when selecting a search result. */
        identifySearchResults: PropTypes.bool,
        /** The initial radius units of the identify dialog in radius mode. One of 'm', 'ft', 'km', 'mi'. */
        initialRadiusUnits: PropTypes.string,
        layerFilter: PropTypes.object,
        /** How to handle long attribute names / values. */
        longAttributesDisplay: PropTypes.oneOf(["wrap", "ellipsis"]),
        /** Whether to only show the results dialog if there are results to display. */
        onlyShowDialogWithResults: PropTypes.bool,
        /** Extra params to append to the GetFeatureInfo request (i.e. `FI_POINT_TOLERANCE`, `FI_LINE_TOLERANCE`, `feature_count`, ...). Additionally, `region_feature_count` is supported. */
        params: PropTypes.object,
        /** Whether to replace an attribute value containing an URL to an image with an inline image. */
        replaceImageUrls: PropTypes.bool,
        /** Result display mode. */
        resultDisplayMode: PropTypes.oneOf(["tree", "flat", "paginated", "table"]),
        /** Target cell size of the result grid in comparison mode. */
        resultGridSize: PropTypes.number,
        /** Whether multi-display mode should be enabled by default, only relevant if `resultDisplayMode` is `paginated`. */
        resultMultiDisplay: PropTypes.bool,
        /** Whether to show a layer selector to filter the identify results by layer. */
        showLayerSelector: PropTypes.bool,
        /** Whether to prefix the identify result titles with the respecitve layer name. */
        showLayerTitles: PropTypes.bool,
        /** Whether to skip empty feature attributes. */
        skipEmptyFeatureAttributes: PropTypes.bool,
        startupParams: PropTypes.object,
        theme: PropTypes.object
    };
    static defaultProps = {
        availableRegionModes: ['Region', 'Radius', 'Circle', 'Rectangle'],
        enableAggregatedReports: true,
        enableCompare: true,
        enableExport: true,
        exportGeometry: true,
        clearResultsOnClose: true,
        longAttributesDisplay: 'wrap',
        resultDisplayMode: 'flat',
        resultGridSize: 200,
        resultMultiDisplay: false,
        replaceImageUrls: true,
        geometry: {
            initialWidth: 240,
            initialHeight: 320,
            initialX: 0,
            initialY: 0,
            initiallyDocked: false,
            side: 'left',
            minimizeable: false
        },
        initialRadiusUnits: 'm',
        highlightAllResults: true,
        showLayerSelector: true,
        showLayerTitles: true
    };
    constructor(props) {
        super(props);
        this.toolRef = null;
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.theme && !prevProps.theme) {
            const startupParams = this.props.startupParams;
            const haveIc = ["1", "true"].includes((startupParams.ic || "").toLowerCase());
            const c = (startupParams.c || "").split(/[;,]/g).map(x => parseFloat(x) || 0);
            if (this.props.enabled && haveIc && c.length === 2) {
                const mapCrs = this.props.theme.mapCrs;
                this.toolRef.identifyPoint(CoordinatesUtils.reproject(c, startupParams.crs || mapCrs, mapCrs));
            } else if (startupParams.if) {
                // Handled even when Identify is not the current identify tool, see identifyFeaturesPending
                this.pendingIdentifyFilter = startupParams.if;
                UrlParams.updateParams({if: undefined});
            }
        }
        if (this.pendingIdentifyFilter) {
            this.identifyFeaturesPending();
        }
    }
    identifyFeaturesPending = () => {
        // MapFilter applies the startup filter behind a debounce, wait for it so that the
        // identify filter is combined with the map filter rather than replacing it
        const awaitMapFilter = this.props.startupParams.f && ConfigUtils.havePlugin("MapFilter");
        if (awaitMapFilter && this.props.layerFilter?.filterParams === null) {
            return;
        }
        const identifyFilter = this.pendingIdentifyFilter;
        this.pendingIdentifyFilter = null;
        this.toolRef.identifyFeaturesFilter(identifyFilter);
    };
    render() {
        return (
            <IdentifyTool
                appendResultsByDefault={this.props.appendResultsByDefault}
                availableRegionModes={this.props.availableRegionModes}
                clearResultsOnClose={this.props.clearResultsOnClose}
                currentSearchResult={this.props.identifySearchResults ? this.props.currentSearchResult : null}
                enableAggregatedReports={this.props.enableAggregatedReports}
                enableCompare={this.props.enableCompare}
                enableExport={this.props.enableExport}
                enabled={this.props.enabled}
                exitTaskOnResultsClose={this.props.exitTaskOnResultsClose}
                exportGeometry={this.props.exportGeometry}
                geometry={this.props.geometry}
                highlightAllResults={this.props.highlightAllResults}
                initialRadiusUnits={this.props.initialRadiusUnits}
                longAttributesDisplay={this.props.longAttributesDisplay}
                onlyShowDialogWithResults={this.props.onlyShowDialogWithResults}
                params={this.props.params}
                replaceImageUrls={this.props.replaceImageUrls}
                resultDisplayMode={this.props.resultDisplayMode}
                resultGridSize={this.props.resultGridSize}
                resultMultiDisplay={this.props.resultMultiDisplay}
                setToolRef={el => { this.toolRef = el; }}
                showLayerSelector={this.props.showLayerSelector}
                showLayerTitles={this.props.showLayerTitles}
                skipEmptyFeatureAttributes={this.props.skipEmptyFeatureAttributes}
                taskId="Identify"
                toolIcon="info-sign"
                toolTitle={LocaleUtils.tr("identify.title")}
            />
        );
    }
}

export default connect((state) => {
    const enabled = state.task.id === "Identify" || (
        (!state.task.id || state.task.identifyEnabled) &&
        ConfigUtils.getConfigProp("identifyTool", state.theme.current, "Identify") === "Identify"
    );
    return {
        currentSearchResult: state.search.currentResult,
        enabled: enabled,
        layerFilter: state.layers.filter,
        theme: state.theme.current,
        startupParams: state.localConfig.startupParams
    };
}, {})(Identify);
