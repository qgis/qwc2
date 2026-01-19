/**
 * Copyright 2019-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import {XMLParser} from 'fast-xml-parser';
import isEmpty from 'lodash.isempty';
import PropTypes from 'prop-types';
import url from 'url';
import {v1 as uuidv1} from 'uuid';

import {LayerRole, addLayer, removeLayer, changeLayerProperty} from '../../actions/layers';
import Icon from '../../components/Icon';
import LocaleUtils from '../../utils/LocaleUtils';

import './style/OerebDocument.css';

const DefaultLang = "de";

class Oereb2Document extends React.Component {
    static propTypes = {
        addLayer: PropTypes.func,
        changeLayerProperty: PropTypes.func,
        config: PropTypes.object,
        data: PropTypes.oneOfType([
            PropTypes.string,
            PropTypes.object
        ]),
        layers: PropTypes.array,
        removeLayer: PropTypes.func
    };
    state = {
        oerebDoc: null,
        expandedSection: null,
        expandedTheme: null,
        expandedLegend: null
    };
    constructor(props) {
        super(props);
        this.state.oerebDoc = this.getOerebDoc(props.data);
    }
    componentDidUpdate(prevProps) {
        if (prevProps.data !== this.props.data) {
            this.setState({oerebDoc: this.getOerebDoc(this.props.data)});
        }
    }
    componentWillUnmount() {
        this.removeHighlighLayer();
    }
    getOerebDoc(oerebDoc) {
        if (typeof oerebDoc === "object") {
            return oerebDoc;
        } else {
            const parserOpts = {
                processTagValue: (value) => decodeURIComponent(value),
                isArray: () => false,
                ignoreAttributes: false,
                attributeNamePrefix: "",
                removeNSPrefix: true
            };
            const json = (new XMLParser(parserOpts)).parse(oerebDoc);
            // Case sensitivity difference between XML and JSON
            json.GetExtractByIdResponse.extract = json.GetExtractByIdResponse.Extract;
            return json;
        }
    }
    render() {
        const extract = this.state.oerebDoc.GetExtractByIdResponse.extract;

        const toplevelThemes = {};
        this.ensureArray(extract.ConcernedTheme).forEach(ctheme => {

            const landOwnRestr = this.ensureArray(extract.RealEstate.RestrictionOnLandownership);

            let concernedThemes = [];
            if (ctheme.SubCode) {
                concernedThemes = landOwnRestr.filter(entry => entry.Theme.Code === ctheme.Code && entry.Theme.SubCode === ctheme.SubCode);
            } else {
                concernedThemes = landOwnRestr.filter(entry => entry.Theme.Code === ctheme.Code);
            }

            // separate toplevel entries depending on LawStatus
            concernedThemes.forEach(theme => {
                const themeId = theme.Theme.Code + ":" + theme.Theme.SubCode + ":" + theme.Lawstatus.Code;
                if (!toplevelThemes[themeId]) {
                    toplevelThemes[themeId] = {
                        id: themeId,
                        title: this.localizedText(theme.Theme.Text) + " (" + this.localizedText(theme.Lawstatus.Text) + ")",
                        entries: []
                    };
                }
                toplevelThemes[themeId].entries.push({...theme, uuid: uuidv1()});
            });
        });

        return (
            <div className="oereb-document">
                {this.renderSection("concernedThemes", LocaleUtils.trmsg("oereb.concernedThemes"), this.renderConcernedThemes, Object.values(toplevelThemes))}
                {this.renderSection("notConcernedThemes", LocaleUtils.trmsg("oereb.notConcernedThemes"), this.renderOtherThemes, this.ensureArray(extract.NotConcernedTheme))}
                {this.renderSection("themeWithoutData", LocaleUtils.trmsg("oereb.themeWithoutData"), this.renderOtherThemes, this.ensureArray(extract.ThemeWithoutData))}
                {this.renderSection("generalInformation", LocaleUtils.trmsg("oereb.generalInformation"), this.renderGeneralInformation, extract)}
            </div>
        );
    }
    renderSection = (name, titlemsgid, renderer, data) => {
        if (isEmpty(data)) {
            return null;
        }
        const icon = this.state.expandedSection === name ? 'chevron-up' : 'chevron-down';
        return (
            <div className="oereb-document-section">
                <div className="oereb-document-section-title" onClick={() => this.toggleSection(name)}>
                    <span>{LocaleUtils.tr(titlemsgid)}</span>
                    <span>{data.length}&nbsp;<Icon icon={icon} /></span>
                </div>
                {this.state.expandedSection === name ? renderer(data) : null}
            </div>
        );
    };
    renderConcernedThemes = (themes) => {
        return (
            <div className="oereb-document-section-concerned-themes">
                {themes.map(theme => {
                    const icon = this.state.expandedTheme === theme.id ? 'chevron-up' : 'chevron-down';
                    return (
                        <div className="oereb-document-theme" key={theme.id}>
                            <div className="oereb-document-theme-title" onClick={() => this.toggleTheme(theme)}>
                                <span>{theme.title}</span>
                                <Icon icon={icon} />
                            </div>
                            {this.state.expandedTheme === theme.id ? this.renderTheme(theme) : null}
                        </div>
                    );
                })}
            </div>
        );
    };
    renderTheme = (theme) => {
        const regulations = {};
        const legalbasis = {};
        const hints = {};
        let respoffices = {};
        for (const entry of theme.entries) {
            for (const prov of this.ensureArray(entry.LegalProvisions)) {
                if (prov.Type.Code === "LegalProvision") {
                    regulations[this.localizedText(prov.TextAtWeb)] = {
                        label: this.localizedText(prov.Title) + (prov.OfficialNumber ? ", " + this.localizedText(prov.OfficialNumber) : ""),
                        link: this.localizedText(prov.TextAtWeb),
                        index: prov.Index
                    };
                } else if (prov.Type.Code === "Law") {
                    legalbasis[this.localizedText(prov.TextAtWeb)] = {
                        label: this.localizedText(prov.Title) + (prov.Abbreviation ? " (" + this.localizedText(prov.Abbreviation) + ")" : "") + (prov.OfficialNumber ? ", " + this.localizedText(prov.OfficialNumber) : ""),
                        link: this.localizedText(prov.TextAtWeb),
                        index: prov.Index
                    };
                } else if (prov.Type.Code === "Hint") {
                    hints[this.localizedText(prov.TextAtWeb)] = {
                        label: this.localizedText(prov.Title),
                        link: this.localizedText(prov.TextAtWeb),
                        index: prov.Index
                    };
                }
                respoffices[this.localizedText(prov.ResponsibleOffice.OfficeAtWeb)] = {
                    label: this.localizedText(prov.ResponsibleOffice.Name),
                    link: this.localizedText(prov.ResponsibleOffice.OfficeAtWeb)
                };
            }
        }
        if ((this.props.config || {}).responsibleOfficeFromRestriction) {
            respoffices = theme.entries.reduce((res, restr) => {
                res[this.localizedText(restr.ResponsibleOffice.OfficeAtWeb)] = {
                    label: this.localizedText(restr.ResponsibleOffice.Name),
                    link: this.localizedText(restr.ResponsibleOffice.OfficeAtWeb)
                };
                return res;
            }, {});
        }

        // Aggregate symbols
        const legendSymbols = {};
        const sumIfDefined = (a, b) => (a && b ? a + b : a || b);
        for (const entry of theme.entries) {
            if (!legendSymbols[entry.SymbolRef]) {
                legendSymbols[entry.SymbolRef] = {
                    SymbolRef: entry.SymbolRef,
                    LegendText: entry.LegendText,
                    FullLegend: entry?.Map?.LegendAtWeb,
                    NrOfPoints: this.ensureNumber(entry.NrOfPoints),
                    AreaShare: this.ensureNumber(entry.AreaShare),
                    LengthShare: this.ensureNumber(entry.LengthShare),
                    PartInPercent: this.ensureNumber(entry.PartInPercent)
                };
            } else {
                const symbol = legendSymbols[entry.SymbolRef];
                symbol.NrOfPoints = sumIfDefined(symbol.NrOfPoints, this.ensureNumber(entry.NrOfPoints));
                symbol.AreaShare = sumIfDefined(symbol.AreaShare, this.ensureNumber(entry.AreaShare));
                symbol.LengthShare = sumIfDefined(symbol.LengthShare, this.ensureNumber(entry.LengthShare));
                symbol.PartInPercent = sumIfDefined(symbol.PartInPercent, this.ensureNumber(entry.PartInPercent));
            }
        }

        return (
            <div className="oereb-document-theme-contents">
                <table><tbody>
                    <tr>
                        <th>{LocaleUtils.tr("oereb.type")}</th>
                        <th />
                        <th>{LocaleUtils.tr("oereb.share")}</th>
                        <th>{LocaleUtils.tr("oereb.perc")}</th>
                    </tr>
                    {Object.values(legendSymbols).map((legendEntry, idx) => {
                        const fullLegendId = legendEntry.SymbolRef;
                        const toggleLegendMsgId = this.state.expandedLegend === fullLegendId ? LocaleUtils.trmsg("oereb.hidefulllegend") : LocaleUtils.trmsg("oereb.showfulllegend");
                        return [
                            legendEntry.NrOfPoints ? (
                                <tr key={"NrOfPoints" + idx}>
                                    <td>{this.localizedText(legendEntry.LegendText)}</td>
                                    <td><img src={legendEntry.SymbolRef} /></td>
                                    <td>{legendEntry.NrOfPoints}&nbsp;{LocaleUtils.tr("oereb.nrpoints")}</td>
                                    <td>-</td>
                                </tr>
                            ) : null,
                            legendEntry.LengthShare ? (
                                <tr key={"LengthShare" + idx}>
                                    <td>{this.localizedText(legendEntry.LegendText)}</td>
                                    <td><img src={legendEntry.SymbolRef} /></td>
                                    <td>{legendEntry.LengthShare}&nbsp;m</td>
                                    {legendEntry.PartInPercent ? (<td>{legendEntry.PartInPercent.toFixed(1) + "%"}</td>) : (<td>-</td>)}
                                </tr>
                            ) : null,
                            legendEntry.AreaShare ? (
                                <tr key={"AreaShare" + idx}>
                                    <td>{this.localizedText(legendEntry.LegendText)}</td>
                                    <td><img src={legendEntry.SymbolRef} /></td>
                                    <td>{legendEntry.AreaShare}&nbsp;m<sup>2</sup></td>
                                    {legendEntry.PartInPercent ? (<td>{legendEntry.PartInPercent.toFixed(1) + "%"}</td>) : (<td>-</td>)}
                                </tr>
                            ) : null,
                            legendEntry.FullLegend ? (
                                <tr key={"FullLegend" + idx}>
                                    <td colSpan="4">
                                        <div className="oereb-document-toggle-fulllegend" onClick={() => this.toggleFullLegend(fullLegendId)}>
                                            <a>{LocaleUtils.tr(toggleLegendMsgId)}</a>
                                        </div>
                                        {this.state.expandedLegend === fullLegendId ? (<div className="oereb-document-fulllegend"><img src={legendEntry.fullLegend} /></div>) : null}
                                    </td>
                                </tr>
                            ) : null
                        ];
                    })}
                </tbody></table>
                {this.renderDocuments(regulations, LocaleUtils.trmsg("oereb.regulations"))}
                {this.renderDocuments(legalbasis, LocaleUtils.trmsg("oereb.legalbasis"))}
                {this.renderDocuments(hints, LocaleUtils.trmsg("oereb.hints"))}
                {this.renderDocuments(respoffices, LocaleUtils.trmsg("oereb.responsibleoffice"))}
            </div>
        );
    };
    renderDocuments = (documents, sectiontitle) => {
        return isEmpty(documents) ? null : (
            <div>
                <h1>{LocaleUtils.tr(sectiontitle)}</h1>
                <ul>
                    {Object.values(documents).sort((a, b) => a.index !== b.index ? a.index - b.index : a.label.localeCompare(b.label)).map((doc, idx) => (
                        <li key={"doc" + idx}><a href={doc.link} rel="noopener noreferrer" target="_blank" title={doc.label}>&#128279; {doc.label}</a></li>
                    ))}
                </ul>
            </div>
        );
    };
    renderOtherThemes = (themes) => {
        return (
            <div className="oereb-document-section-other-themes">
                {themes.map(theme => (<div key={theme.Code + ":" + theme.SubCode}>{this.localizedText(theme.Text)}</div>))}
            </div>
        );
    };
    renderGeneralInformation = (extract) => {
        return (
            <div className="oereb-document-section-general-info">
                <h1>{LocaleUtils.tr("oereb.responsibleauthority")}</h1>
                <table><tbody>
                    <tr>
                        {(this.props.config || {}).hideLogo ? null : (<td rowSpan="4" style={{verticalAlign: 'top'}}><img src={extract.CantonalLogoRef} /></td>)}
                        <td><b>{this.localizedText(extract.PLRCadastreAuthority.Name)}</b></td>
                    </tr>
                    <tr>
                        <td>{extract.PLRCadastreAuthority.Street} {extract.PLRCadastreAuthority.Number}</td>
                    </tr>
                    <tr>
                        <td>{extract.PLRCadastreAuthority.PostalCode} {extract.PLRCadastreAuthority.City}</td>
                    </tr>
                    <tr>
                        <td>
                            <a href={this.localizedText(extract.PLRCadastreAuthority.OfficeAtWeb)} rel="noopener noreferrer" target="_blank">
                                {this.localizedText(extract.PLRCadastreAuthority.OfficeAtWeb)}
                            </a>
                        </td>
                    </tr>
                </tbody></table>
                <h1>{LocaleUtils.tr("oereb.fundations")}</h1>
                <div>{LocaleUtils.tr("oereb.fundationdatastate")} {new Date(extract.UpdateDateCS).toLocaleDateString()}</div>
                <h1>{LocaleUtils.tr("oereb.generalinfo")}</h1>
                <div>{this.localizedText(extract.GeneralInformation)}</div>
                {this.ensureArray(extract.ExclusionOfLiability).map((entry, idx) => [
                    (<h1 key={"exclt" + idx}>{this.localizedText(entry.Title)}</h1>),
                    (<div key={"exclc" + idx}>{this.localizedText(entry.Content)}</div>)
                ])}
                {this.ensureArray(extract.Disclaimer).map((entry, idx) => [
                    (<h1 key={"disclt" + idx}>{this.localizedText(entry.Title)}</h1>),
                    (<div key={"disclc" + idx}>{this.localizedText(entry.Content)}</div>)
                ])}
            </div>
        );
    };
    toggleSection = (name) => {
        this.setState((state) => ({
            expandedSection: state.expandedSection === name ? null : name,
            expandedTheme: null,
            expandedLegend: null
        }));
        this.removeHighlighLayer();
    };
    removeHighlighLayer = () => {
        // Remove previous __oereb_highlight layers
        const layers = this.props.layers.filter(layer => layer.__oereb_highlight === true);
        for (const layer of layers) {
            this.props.removeLayer(layer.id);
        }
    };
    toggleTheme = (theme) => {
        this.setState(state => ({
            expandedTheme: state.expandedTheme === theme.id ? null : theme.id,
            expandedLegend: null
        }));
        const expandedTheme = this.state.expandedTheme === theme.id ? null : theme.id;
        this.removeHighlighLayer();
        if (!expandedTheme) {
            return;
        }

        const subThemeLayers = new Set();
        for (const entry of theme.entries) {
            const referenceWMS = this.localizedText(entry?.Map?.ReferenceWMS);
            if (!referenceWMS || subThemeLayers.has(referenceWMS)) {
                continue;
            }
            const parts = url.parse(referenceWMS, true);
            const baseUrl = parts.protocol + '//' + parts.host + parts.pathname;
            const params = Object.entries(parts.query).reduce((res, [key, val]) => ({...res, [key.toUpperCase()]: val}), {});
            const layer = {
                id: entry.uuid,
                role: LayerRole.USERLAYER,
                type: "wms",
                name: this.localizedText(entry.LegendText),
                title: this.localizedText(entry.Theme.Text),
                legendUrl: baseUrl,
                url: baseUrl,
                version: params.VERSION,
                featureInfoUrl: baseUrl,
                queryable: false,
                bbox: {
                    crs: params.SRS || params.CRS,
                    bounds: params.BBOX.split(',')
                },
                visibility: true,
                opacity: entry.Map.layerOpacity !== undefined ? Math.round(this.ensureNumber(entry.Map.layerOpacity) * 255) : 255,
                format: params.FORMAT,
                params: {LAYERS: params.LAYERS},
                __oereb_highlight: true
            };
            this.props.addLayer(layer);
            subThemeLayers.add(referenceWMS);
        }
    };
    toggleFullLegend = (legendId) => {
        this.setState((state) => ({expandedLegend: state.expandedLegend === legendId ? null : legendId}));
    };
    toggleThemeLayer = (subthemelayer) => {
        this.props.changeLayerProperty(subthemelayer.id, "visibility", !subthemelayer.visibility);
    };
    localizedText = (el) => {
        if (isEmpty(el)) {
            return "";
        }
        if (el.LocalisedText) {
            el = el.LocalisedText;
        }
        if (Array.isArray(el)) {
            const entries = el.flat().filter(e => e.Language === (this.props.config.lang ?? DefaultLang));
            if (entries.length === 0) {
                return el[0].Text;
            } else if (entries.length === 1) {
                return entries[0].Text;
            } else {
                return entries.map((entry, idx) => (<p key={"p" + idx}>{entry.Text}</p>));
            }
        } else {
            return el.Text;
        }
    };
    ensureArray = (el) => {
        if (el === undefined) {
            return [];
        }
        return Array.isArray(el) ? el : [el];
    };
    ensureNumber = (value) => {
        return parseFloat(value) || 0;
    };
}

export default connect(state => ({
    layers: state.layers.flat
}), {
    addLayer: addLayer,
    removeLayer: removeLayer,
    changeLayerProperty: changeLayerProperty
})(Oereb2Document);
