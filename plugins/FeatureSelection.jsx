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
import LocaleUtils from '../utils/LocaleUtils';


/**
 * Displays queried feature attributes.
 *
 * This plugin offers basically the same functionality as the Identify plugin, but as dedicated tool.
 * In particular with `clearResultsOnClose: false`, it allows managing a persistent list of selected features,
 * while still allowing to transiently identify features with the Identify plugin.
 */
class FeatureSelection extends React.Component {
    static propTypes = {
        /** Whether to append results by default (without having to press `CTRL` when clicking). */
        appendResultsByDefault: PropTypes.bool,
        /** Available region identify modes. */
        availableRegionModes: PropTypes.arrayOf(PropTypes.string),
        /** Whether to clear the identify results when exiting the identify tool. */
        clearResultsOnClose: PropTypes.bool,
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
        /** The initial radius units of the identify dialog in radius mode. One of 'm', 'ft', 'km', 'mi'. */
        initialRadiusUnits: PropTypes.string,
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
        skipEmptyFeatureAttributes: PropTypes.bool
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
    render() {
        return (
            <IdentifyTool
                appendResultsByDefault={this.props.appendResultsByDefault}
                availableRegionModes={this.props.availableRegionModes}
                clearResultsOnClose={this.props.clearResultsOnClose}
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
                showLayerSelector={this.props.showLayerSelector}
                showLayerTitles={this.props.showLayerTitles}
                showPointQueryMarker={false}
                skipEmptyFeatureAttributes={this.props.skipEmptyFeatureAttributes}
                taskId="FeatureSelection"
                toolIcon="selectbox"
                toolTitle={LocaleUtils.tr("appmenu.items.FeatureSelection")}
            />
        );
    }
}

export default connect((state) => ({
    enabled: state.task.id === "FeatureSelection"
}), {})(FeatureSelection);
