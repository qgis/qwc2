/**
 * Copyright 2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import dayjs from 'dayjs';
import PropTypes from 'prop-types';
import randomcolor from 'randomcolor';

import {addLayerFeatures, removeLayer, LayerRole} from '../../actions/layers';
import LocaleUtils from '../../utils/LocaleUtils';
import MiscUtils from '../../utils/MiscUtils';
import Spinner from '../Spinner';
import Input from '../widgets/Input';

import './style/TimelineFeaturesSlider.css';


class TimelineFeaturesSlider extends React.Component {
    static propTypes = {
        addLayerFeatures: PropTypes.func,
        computePixelFromTime: PropTypes.func,
        computeTimeFromPixel: PropTypes.func,
        currentTimestamp: PropTypes.number,
        cursorFormat: PropTypes.string,
        dateFormat: PropTypes.string,
        displayMode: PropTypes.string,
        endTime: PropTypes.object,
        markerConfiguration: PropTypes.object,
        markersEnabled: PropTypes.bool,
        removeLayer: PropTypes.func,
        startTime: PropTypes.object,
        stepSizeUnit: PropTypes.string,
        timeEnabled: PropTypes.bool,
        timeFeatures: PropTypes.object,
        timestampChanged: PropTypes.func
    };
    state = {
        currentTimestampDrag: null,
        highlightFeatures: null,
        layerClassifications: {},
        layerAttrGroups: {}
    };
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
            this.setState((state) => {
                const newLayerAttrGroups = {...state.layerAttrGroups};
                Object.keys(state.layerAttrGroups).forEach(layername => {
                    if (!this.props.timeFeatures.attributes[layername] || this.props.timeFeatures.attributes[layername] !== prevProps.timeFeatures.attributes[layername]) {
                        delete newLayerAttrGroups.layername;
                    }
                });
                return {layerAttrGroups: newLayerAttrGroups};
            });
        }
    }
    render() {
        const timestamp = this.state.currentTimestampDrag ? this.state.currentTimestampDrag.time : this.props.currentTimestamp;
        const sliderGeom = {
            top: 5
        };
        return (
            <div className="timeline-slider-container">
                <div className="timeline-slider" onMouseDown={this.pickCurrentTimestamp}>
                    {this.props.displayMode === "features" ? this.renderTimeFeatures(sliderGeom) : null}
                    {this.props.displayMode === "layers" ? this.renderTimeLayers(sliderGeom) : null}
                    {this.renderGradient(sliderGeom)}
                </div>
                {this.renderCursor(timestamp)}
                {this.props.timeFeatures.pendingRequests > 0 ? (
                    <div className="timeline-slider-loading">
                        <Spinner /><span>{LocaleUtils.tr("timemanager.loading")}</span>
                    </div>
                ) : null}
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
                        {this.props.cursorFormat.includes("date") ? (
                            <div><Input onChange={this.setCursorDate} required type="date" value={dayjs(timestamp).format('YYYY-MM-DD')} /></div>
                        ) : null}
                        {this.props.cursorFormat.includes("time") ? (
                            <div><Input onChange={this.setCursorTime} required type="time" value={dayjs(timestamp).format("HH:mm:ss")} /></div>
                        ) : null}
                    </div>
                </div>
            );
        }
        return null;
    };
    setCursorDate = (date) => {
        if (date) {
            const newdate = dayjs(date, "YYYY-MM-DD");
            this.props.timestampChanged(+dayjs(this.props.currentTimestamp).year(newdate.year()).month(newdate.month()).date(newdate.date()));
        }
    };
    setCursorTime = (time) => {
        if (time) {
            const parts = time.split(":").map(x => parseInt(x, 10));
            this.props.timestampChanged(+dayjs(this.props.currentTimestamp).hour(parts[0]).minute(parts[1]).second(parts[2]));
        }
    };
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
            const pos = Math.max(0, Math.min(ev.clientX - rect.left, rect.right - rect.left));
            let newTimestamp = dayjs(this.props.computeTimeFromPixel(pos));
            // Snap to configured step interval
            let add = null;
            if (this.props.stepSizeUnit.endsWith("m")) {
                add = newTimestamp.second() > 30;
                newTimestamp = newTimestamp.second(0);
            } else if (this.props.stepSizeUnit.endsWith("h")) {
                add = newTimestamp.minute() > 30;
                newTimestamp = newTimestamp.second(0).minute(0);
            } else if (this.props.stepSizeUnit.endsWith("d")) {
                add = newTimestamp.hour() > 12;
                newTimestamp = newTimestamp.second(0).minute(0).hour(0);
            } else if (this.props.stepSizeUnit.endsWith("M")) {
                add = newTimestamp.date() > 15;
                newTimestamp = newTimestamp.second(0).minute(0).hour(0).date(1);
            } else if (this.props.stepSizeUnit.endsWith("y")) {
                add = newTimestamp.month() > 5;
                newTimestamp = newTimestamp.second(0).minute(0).hour(0).date(1).month(0);
            }
            if (add) {
                const num = parseInt(this.props.stepSizeUnit.slice(0, -1), 10) || 1;
                newTimestamp = newTimestamp.add(num, this.props.stepSizeUnit.slice(-1));
            }
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
    };
    renderTimeFeatures = (sliderGeom) => {
        return Object.entries(this.props.timeFeatures.features).map(([layer, features]) => {
            const layerTitleStyle = {
                top: sliderGeom.top + "px",
                left: 0,
                right: 0
            };
            sliderGeom.top += 30;

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
            return [
                (
                    <div className="timeline-slider-layertitle" key={layer} style={layerTitleStyle}>
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
                ),
                sliderFeatures
            ];
        });
    };
    renderTimeLayers = (sliderGeom) => {
        return Object.entries(this.props.timeFeatures.features).reduce((res, [layer, features]) => {
            if (features.length > 0) {
                let tstart = features[0].properties.__startdate;
                let tend = features[0].properties.__enddate;
                for (let i = 1; i < features.length; ++i) {
                    if (features[i].properties.__startdate < tstart) {
                        tstart = features[i].properties.__startdate;
                    }
                    if (features[i].properties.__enddate > tend) {
                        tend = features[i].properties.__enddate;
                    }
                }
                return [
                    ...res,
                    this.renderTimeFeature(sliderGeom, tstart, tend, features, layer)
                ];
            }
            return res;
        }, []);
    };
    renderTimeFeature = (sliderGeom, tstart, tend, features, label, attr, featClass) => {
        const left = tstart.isValid() ? this.props.computePixelFromTime(tstart) : 0;
        const right = tend.isValid() ? this.props.computePixelFromTime(tend) : 0;

        const style = {
            top: sliderGeom.top + "px",
            left: left + "px"
        };
        if (tend.isValid()) {
            style.width = (right - left) + "px";
        } else {
            style.right = 0;
        }
        let tooltip =
            LocaleUtils.tr("timemanager.starttime") + ": " + (tstart.isValid() ? tstart.format(this.props.dateFormat) : "-") + "\n" +
            LocaleUtils.tr("timemanager.endtime") + ": " + (tend.isValid() ? tend.format(this.props.dateFormat) : "-");

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
    };
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
    };
    setClassification = (layer, attr) => {
        this.setState((state) => {
            const newLayerClassifications = {
                ...state.layerClassifications
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
                ...state.layerAttrGroups
            };
            delete newLayerAttrGroups[layer];
            return {layerClassifications: newLayerClassifications, layerAttrGroups: newLayerAttrGroups};
        });
    };
    setGroupAttr = (layer, attr) => {
        this.setState((state) => {
            const newLayerAttrGroups = {
                ...state.layerAttrGroups
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
                ...state.layerClassifications
            };
            delete newLayerClassifications[layer];
            return {layerClassifications: newLayerClassifications, layerAttrGroups: newLayerAttrGroups};
        });
    };
}

export default connect(() => ({}), {
    addLayerFeatures: addLayerFeatures,
    removeLayer: removeLayer
})(TimelineFeaturesSlider);
