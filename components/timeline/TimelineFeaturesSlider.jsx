/**
 * Copyright 2022 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import dayjs from 'dayjs';
import randomcolor from 'randomcolor';
import {addLayerFeatures, removeLayer, LayerRole} from '../../actions/layers';
import LocaleUtils from '../../utils/LocaleUtils';
import MiscUtils from '../../utils/MiscUtils';
import './style/TimelineFeaturesSlider.css';


class TimelineFeaturesSlider extends React.Component {
    static propTypes = {
        addLayerFeatures: PropTypes.func,
        computePixelFromTime: PropTypes.func,
        computeTimeFromPixel: PropTypes.func,
        currentTimestamp: PropTypes.number,
        endTime: PropTypes.object,
        markerConfiguration: PropTypes.object,
        markersEnabled: PropTypes.bool,
        removeLayer: PropTypes.func,
        startTime: PropTypes.object,
        timeEnabled: PropTypes.bool,
        timeFeatures: PropTypes.object,
        timestampChanged: PropTypes.func
    }
    state = {
        currentTimestampDrag: null,
        highlightFeatures: null,
        layerClassifications: {},
        layerAttrGroups: {}
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.state.highlightFeatures !== prevState.highlightFeatures) {
            if (!this.state.highlightFeatures) {
                this.props.removeLayer("timelinefeathighlight");
            } else {
                const layer = {
                    id: "timelinefeathighlight",
                    role: LayerRole.MARKER,
                    rev: +new Date()
                };
                this.props.addLayerFeatures(layer, this.state.highlightFeatures, true);
            }
        }
        if (this.props.timeFeatures !== prevProps.timeFeatures) {
            const newLayerClassifications = {...this.state.layerClassifications};
            Object.keys(this.state.layerClassifications).forEach(layername => {
                if (!this.props.timeFeatures.attributes[layername] || this.props.timeFeatures.attributes[layername] !== prevProps.timeFeatures.attributes[layername]) {
                    delete newLayerClassifications.layername;
                }
            });
            const newLayerAttrGroups = {...this.state.layerAttrGroups};
            Object.keys(this.state.layerAttrGroups).forEach(layername => {
                if (!this.props.timeFeatures.attributes[layername] || this.props.timeFeatures.attributes[layername] !== prevProps.timeFeatures.attributes[layername]) {
                    delete newLayerAttrGroups.layername;
                }
            });
            this.setState({layerAttrGroups: newLayerAttrGroups});
        }
    }
    render() {
        const timestamp = this.state.currentTimestampDrag ? this.state.currentTimestampDrag.time : this.props.currentTimestamp;
        const sliderGeom = {
            top: 35
        };
        return (
            <div className="timeline-slider-container">
                <div className="timeline-slider" onMouseDown={this.pickCurrentTimestamp}>
                    {this.renderTimeFeatures(sliderGeom)}
                    {this.renderGradient(sliderGeom)}
                </div>
                {this.renderCursor(timestamp)}
            </div>
        );
    }
    renderCursor = (timestamp) => {
        if (this.props.timeEnabled) {
            const cursorPos = this.state.currentTimestampDrag ? this.state.currentTimestampDrag.pos : this.props.computePixelFromTime(timestamp);
            const cursorStyle = {
                left: (cursorPos - 2) + "px"
            };
            return (
                <div className="timeline-slider-cursor" style={cursorStyle}>
                    <div className="timeline-slider-cursor-label">
                        {dayjs(timestamp).format("YYYY-MM-DD[\n]HH:mm:ss")}
                    </div>
                </div>
            );
        }
        return null;
    }
    pickCurrentTimestamp = (event) => {
        if ( ["INPUT", "SELECT", "OPTION"].includes(event.target.nodeName)) {
            return;
        }

        clearTimeout(this.timestampChangeTimeout);
        const target = event.currentTarget;
        const rect = target.getBoundingClientRect();

        const computeTimestamp = (ev) => {
            if (!this.props.timeEnabled) {
                return;
            }
            const pos = ev.clientX - rect.left;
            const newTimestamp = this.props.computeTimeFromPixel(pos);
            this.setState({currentTimestampDrag: {
                pos: pos,
                time: newTimestamp
            }});
        };
        document.addEventListener("mousemove", computeTimestamp);
        document.addEventListener("mouseup", () => {
            if (this.state.currentTimestampDrag) {
                this.props.timestampChanged(+this.state.currentTimestampDrag.time);
                this.setState({currentTimestampDrag: null});
            }
            document.removeEventListener("mousemove", computeTimestamp);
        }, {once: true, capture: true});
        computeTimestamp(event);
    }
    renderTimeFeatures = (sliderGeom) => {
        return Object.entries(this.props.timeFeatures.features).map(([layer, features]) => {
            const classattr = (this.state.layerClassifications[layer] || {}).attr || "";
            const groupattr = (this.state.layerAttrGroups[layer] || {}).attr || "";
            let sliderFeatures = null;
            if (this.state.layerAttrGroups[layer]) {
                const layerAttrGroups = this.state.layerAttrGroups[layer];
                sliderFeatures = Object.values(layerAttrGroups.groups).map(groupData => {
                    return this.renderTimeFeature(sliderGeom, groupData.start, groupData.end, groupData.features, "", groupattr, groupData);
                });

            } else {
                const layerAttrClasses = this.state.layerClassifications[layer];
                sliderFeatures = features.map(feature => {
                    const attrData = layerAttrClasses ? layerAttrClasses.classes[feature.properties[layerAttrClasses.attr]] : null;
                    const tstart = feature.properties.__startdate;
                    const tend = feature.properties.__enddate;
                    const label = feature.properties[feature.displayfield];
                    return this.renderTimeFeature(sliderGeom, tstart, tend, [feature], label, classattr, attrData);
                });
            }
            return (
                <div key={layer}>
                    <div className="timeline-slider-layertitle">
                        <span>{layer}</span>
                        <span>{LocaleUtils.tr("timemanager.group")}:&nbsp;</span>
                        <select onChange={(ev) => this.setGroupAttr(layer, ev.target.value)} value={groupattr}>
                            <option value="">{LocaleUtils.tr("timemanager.groupnone")}</option>
                            {this.props.timeFeatures.attributes[layer].map(attr => (
                                <option key={attr} value={attr}>{attr}</option>
                            ))}
                        </select>
                        <span>{LocaleUtils.tr("timemanager.classify")}:&nbsp;</span>
                        <select onChange={(ev) => this.setClassification(layer, ev.target.value)} value={classattr}>
                            <option value="">{LocaleUtils.tr("timemanager.classifynone")}</option>
                            {this.props.timeFeatures.attributes[layer].map(attr => (
                                <option key={attr} value={attr}>{attr}</option>
                            ))}
                        </select>
                    </div>
                    {sliderFeatures}
                </div>
            );
        });
    }
    renderGradient = (sliderGeom) => {
        if (!this.props.markersEnabled) {
            return null;
        }
        const left = this.props.computePixelFromTime(this.props.startTime);
        const right = this.props.computePixelFromTime(this.props.endTime);
        const style = {
            left: left + "px",
            width: (right - left) + "px",
            height: sliderGeom.top + "px",
            background: 'linear-gradient(90deg, ' + this.props.markerConfiguration.gradient.join(", ") + ')'
        };
        return (
            <div className="timeline-slider-gradient" style={style} />
        );

    }
    renderTimeFeature = (sliderGeom, tstart, tend, features, label, attr, featClass) => {
        const left = this.props.computePixelFromTime(tstart);
        const right = this.props.computePixelFromTime(tend);

        const style = {
            top: sliderGeom.top + "px",
            left: left + "px",
            width: (right - left) + "px"
        };
        let tooltip =
            LocaleUtils.tr("timemanager.starttime") + ": " + tstart.format("YYYY-MM-DD HH:mm:ss") + "\n" +
            LocaleUtils.tr("timemanager.endtime") + ": " + tend.format("YYYY-MM-DD HH:mm:ss");

        if (featClass) {
            style.backgroundColor = featClass.bg;
            style.color = featClass.fg;
            label += (label ? ": " : "") + featClass.val;
            tooltip += "\n" + attr + ": " + featClass.val;
        }
        sliderGeom.top += 26;

        return (
            <div className="timeline-slider-feature" key={features[0].id}
                onMouseEnter={() => this.setState({highlightFeatures: features})}
                onMouseLeave={() => this.setState({highlightFeatures: null})}
                style={style} title={tooltip}
            >
                <span>
                    {label}
                </span>
            </div>
        );
    }
    setClassification = (layer, attr) => {
        const newLayerClassifications = {
            ...this.state.layerClassifications
        };
        if (attr) {
            const classes = {};
            this.props.timeFeatures.features[layer].forEach(feature => {
                if (!classes[feature.properties[attr]]) {
                    const color = randomcolor();
                    classes[feature.properties[attr]] = {
                        bg: color,
                        fg: MiscUtils.isBrightColor(color) ? "#000" : "#FFF",
                        val: feature.properties[attr]
                    };
                }
            });
            newLayerClassifications[layer] = {
                attr: attr,
                classes: classes
            };
        } else {
            delete newLayerClassifications[layer];
        }
        // Attr classification and grouping cannot be enabled at the same time
        const newLayerAttrGroups = {
            ...this.state.layerAttrGroups
        };
        delete newLayerAttrGroups[layer];
        this.setState({layerClassifications: newLayerClassifications, layerAttrGroups: newLayerAttrGroups});
    }
    setGroupAttr = (layer, attr) => {
        const newLayerAttrGroups = {
            ...this.state.layerAttrGroups,
        };
        if (attr) {
            const groups = {};
            this.props.timeFeatures.features[layer].forEach(feature => {
                if (!groups[feature.properties[attr]]) {
                    const color = randomcolor();
                    groups[feature.properties[attr]] = {
                        bg: color,
                        fg: MiscUtils.isBrightColor(color) ? "#000" : "#FFF",
                        val: feature.properties[attr],
                        features: [feature],
                        start: feature.properties.__startdate,
                        end: feature.properties.__enddate
                    };
                } else {
                    if (feature.properties.__startdate < groups[feature.properties[attr]].start) {
                        groups[feature.properties[attr]].start = feature.properties.__startdate;
                    }
                    if (feature.properties.__enddate > groups[feature.properties[attr]].end) {
                        groups[feature.properties[attr]].end = feature.properties.__enddate;
                    }
                    groups[feature.properties[attr]].features.push(feature);
                }
            });
            newLayerAttrGroups[layer] = {
                attr: attr,
                groups: groups
            };
        } else {
            delete newLayerAttrGroups[layer];
        }
        // Attr classification and grouping cannot be enabled at the same time
        const newLayerClassifications = {
            ...this.state.layerClassifications
        };
        delete newLayerClassifications[layer];
        this.setState({layerClassifications: newLayerClassifications, layerAttrGroups: newLayerAttrGroups});
    }
}

export default connect(() => ({}), {
    addLayerFeatures: addLayerFeatures,
    removeLayer: removeLayer
})(TimelineFeaturesSlider);
