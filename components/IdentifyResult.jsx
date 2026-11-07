/**
 * Copyright Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import htmlReactParser, {domToReact} from 'html-react-parser';
import React from 'react';
import {connect} from 'react-redux';

import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';

import {openExternalUrl} from '../actions/windows';
import ConfigUtils from '../utils/ConfigUtils';
import LocaleUtils from '../utils/LocaleUtils';
import MiscUtils from '../utils/MiscUtils';
import Icon from './Icon';
import IdentifyAttribute from './IdentifyAttribute';

import './style/IdentifyResult.css';

class IdentifyResult extends React.PureComponent {
    static propTypes = {
        afterTitleControls: PropTypes.arrayOf(PropTypes.shape({
            className: PropTypes.string,
            icon: PropTypes.string.isRequired,
            onClick: PropTypes.func.isRequired,
            title: PropTypes.string
        })),
        beforeTitleControls: PropTypes.arrayOf(PropTypes.shape({
            className: PropTypes.string,
            icon: PropTypes.string.isRequired,
            onClick: PropTypes.func.isRequired,
            title: PropTypes.string
        })),
        collapsed: PropTypes.bool,
        feature: PropTypes.object,
        featureReports: PropTypes.array,
        layerid: PropTypes.string,
        longAttributesDisplay: PropTypes.string,
        openExternalUrl: PropTypes.func,
        setHighlightedFeatures: PropTypes.func,
        showLayerTitles: PropTypes.bool,
        skipEmptyFeatureAttributes: PropTypes.bool
    };
    static defaultProps = {
        afterTitleControls: [],
        beforeTitleControls: []
    };
    render() {
        const layerid = this.props.layerid;
        const feature = this.props.feature;
        let resultbox = null;
        let extraattribs = null;
        let inlineExtaAttribs = false;
        const featureReports = [...(this.props.featureReports ?? [])];
        if (feature.featurereport) {
            const parts = feature.featurereport.split(".");
            featureReports.push({
                title: null,
                template: parts.shift(),
                format: parts.join(".")
            });
        }
        if (feature.type === "text") {
            resultbox = (
                <pre className="identify-result-box">
                    {feature.text}
                </pre>
            );
        } else if (feature.type === "html") {
            resultbox = (
                <iframe className="identify-result-box" srcDoc={feature.text} />
            );
        } else if (feature.properties.htmlContent) {
            if (feature.properties.htmlContentInline) {
                resultbox = (
                    <div className="identify-result-box">{this.parsedContent(feature.properties.htmlContent)}</div>
                );
            } else {
                resultbox = (
                    <iframe className="identify-result-box" srcDoc={feature.properties.htmlContent} />
                );
            }
        } else {
            inlineExtaAttribs = true;
            const properties = Object.keys(feature.properties) || [];
            let rows = [];
            if (properties.length === 1 && feature.properties.maptip) {
                rows = properties.map(attrib => (
                    <tr key={attrib}>
                        <td className="identify-attr-value">
                            <IdentifyAttribute
                                attrName={attrib} attrValue={feature.properties[attrib]}
                                feature={feature} layer={layerid}
                            />
                        </td>
                    </tr>
                ));
            } else {
                rows = properties.map(attrib => {
                    if (this.props.skipEmptyFeatureAttributes && (feature.properties[attrib] || "NULL") === "NULL") {
                        return null;
                    }
                    return (
                        <tr key={attrib}>
                            <td className={"identify-attr-title " + this.props.longAttributesDisplay}><i>{attrib}</i></td>
                            <td className={"identify-attr-value " + this.props.longAttributesDisplay}>
                                <IdentifyAttribute
                                    attrName={attrib} attrValue={feature.properties[attrib]}
                                    feature={feature} layer={layerid}
                                />
                            </td>
                        </tr>
                    );
                });
            }
            this.computeExtraAttributes(layerid, feature, rows);
            featureReports.forEach((report, idx) => {
                rows.push(
                    <tr key={"__featurereport" + idx}>
                        <td className={"identify-attr-title " + this.props.longAttributesDisplay}><i>{LocaleUtils.tr("identify.featureReport") + (report.title ? (": " + report.title) : "")}</i></td>
                        <td className={"identify-attr-value " + this.props.longAttributesDisplay}><a href={this.getFeatureReportUrl(report, feature)} rel="noreferrer" target="_blank">{LocaleUtils.tr("identify.link")}</a></td>
                    </tr>
                );
            });
            if (isEmpty(rows)) {
                rows = (
                    <tr><td className="identify-attr-value"><i>{LocaleUtils.tr("identify.noattributes")}</i></td></tr>
                );
            }
            resultbox = (
                <div className="identify-result-box">
                    <table className="identify-attribute-list"><tbody>
                        {rows}
                    </tbody></table>
                </div>
            );
        }
        if (!inlineExtaAttribs || !isEmpty(featureReports)) {
            extraattribs = (
                <div className="identify-result-box">
                    <table className="identify-attribute-list"><tbody>
                        {this.computeExtraAttributes(layerid, feature, [])}
                        {featureReports.map((report, idx) => (
                            <tr key={"report" + idx}>
                                <td className={"identify-attr-title " + this.props.longAttributesDisplay}>
                                    <i>{LocaleUtils.tr("identify.featureReport") + (report.title ? (": " + report.title) : "")}</i>
                                </td>
                                <td className={"identify-attr-value " + this.props.longAttributesDisplay}>
                                    <a href={this.getFeatureReportUrl(report, feature)} rel="noreferrer" target="_blank">
                                        {LocaleUtils.tr("identify.link")}
                                    </a>
                                </td>
                            </tr>
                        ))}
                    </tbody></table>
                </div>
            );
        }
        return (
            <div
                className="identify-result-frame"
                onMouseEnter={() => this.props.setHighlightedFeatures([feature])}
                onMouseLeave={() => this.props.setHighlightedFeatures(null)}
            >
                <div className="identify-result-title">
                    {this.props.beforeTitleControls.map(entry => (
                        <Icon className={entry.className} icon={entry.icon} key={entry.icon} onClick={() => entry.onClick(this.props.layerid, this.props.feature)} title={entry.title} />
                    ))}
                    <span>{[this.props.showLayerTitles ? feature.layertitle : "", feature.displayname].filter(Boolean).join(": ")}</span>
                    {this.props.afterTitleControls.map(entry => (
                        <Icon className={entry.className} icon={entry.icon} key={entry.icon} onClick={() => entry.onClick(this.props.layerid, this.props.feature)} title={entry.title} />
                    ))}
                </div>
                {!this.props.collapsed && (
                    <div>
                        {resultbox}
                        {extraattribs}
                    </div>
                )}
            </div>
        );
    }
    parsedContent = (text) => {
        text = MiscUtils.sanitizeHtml(text).replace('&#10;', '<br />');
        const options = {replace: (node) => {
            if (node.name === "a") {
                return (
                    <a href={node.attribs.href} onClick={this.attributeLinkClicked} target={node.attribs.target || "_blank"}>
                        {domToReact(node.children, options)}
                    </a>
                );
            }
            return undefined;
        }};
        return htmlReactParser(text, options);
    };
    computeExtraAttributes = (layer, result, rows) => {
        Object.values(window.qwc2?.__attributeCalculators || {}).forEach((entry, idx) => {
            const row = entry.calc(layer, result);
            const addFunc = entry.before ? x => rows.unshift(x) : x => rows.push(x);
            if (row.length === 2) {
                addFunc((
                    <tr key={"custom-attr-" + idx}>
                        <td className="identify-attr-title"><i>{row[0]}</i></td>
                        <td className="identify-attr-value">{row[1]}</td>
                    </tr>
                ));
            } else if (row.length === 1) {
                addFunc((
                    <tr key={"custom-attr-" + idx}>
                        <td colSpan="2">{row[0]}</td>
                    </tr>
                ));
            }
        });
        return rows;
    };
    getFeatureReportUrl = (report, result) => {
        const serviceUrl = ConfigUtils.getConfigProp("documentServiceUrl").replace(/\/$/, "");
        const params = {
            feature: result.id,
            x: result.clickPos?.[0],
            y: result.clickPos?.[1],
            crs: result.crs,
            single_report: report.single_report || false
        };
        const path = "/" + report.template + "." + (report.format || "pdf");
        const query = Object.keys(params).map(key => encodeURIComponent(key) + "=" + encodeURIComponent(params[key])).join("&");
        return serviceUrl + path + "?" + query;
    };
    attributeLinkClicked = (ev) => {
        this.props.openExternalUrl(ev.currentTarget.href, ev.currentTarget.target);
        ev.preventDefault();
    };
}

export default connect(() => ({}), {
    openExternalUrl: openExternalUrl
})(IdentifyResult);
