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
import ol from 'openlayers';
import {addLayerFeatures, refreshLayer, removeLayer, LayerRole} from '../actions/layers';
import Icon from './Icon';
import ButtonBar from './widgets/ButtonBar';
import ToggleSwitch from './widgets/ToggleSwitch';
import MiscUtils from '../utils/MiscUtils';
import NumberInput from './widgets/NumberInput';
import LocaleUtils from '../utils/LocaleUtils';
import './style/ContinuousTimeline.css';
import markerIcon from '../utils/img/marker-icon.png';


class ContinuousTimeline extends React.Component {
    static propTypes = {
        addLayerFeatures: PropTypes.func,
        currentTimestamp: PropTypes.number,
        dialogWidth: PropTypes.number, // Just to trigger a re-render when the width changes
        enabled: PropTypes.bool,
        endTime: PropTypes.object,
        gradientSteps: PropTypes.array,
        markerConfiguration: PropTypes.shape({
            markersAvailable: PropTypes.bool,
            gradient: PropTypes.arrayOf(PropTypes.string),
            markerOffset: PropTypes.array,
            markerPins: PropTypes.bool
        }),
        refreshLayer: PropTypes.func,
        removeLayer: PropTypes.func,
        startTime: PropTypes.object,
        stepSizeUnit: PropTypes.string,
        timeFeatures: PropTypes.object,
        timestampChanged: PropTypes.func
    }
    state = {
        markersEnabled: false,
        ticksContainer: null,
        currentTimestampDrag: null,
        highlightFeatures: null,
        layerClassifications: {},
        layerAttrGroups: {},
        panOffset: 0, // pixels
        timeScale: 1,
        zoomFactor: 1 // 1 = [startTime, endTime] fits dialog width in linear scale
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.state.highlightFeatures !== prevState.highlightFeatures) {
            if (!this.state.highlightFeatures) {
                this.props.removeLayer("ctimelinehighlight");
            } else {
                const layer = {
                    id: "ctimelinehighlight",
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
        if (!this.state.markersEnabled && prevState.markersEnabled) {
            this.props.removeLayer("timemarkers");
        } else if (this.state.markersEnabled && this.props.timeFeatures) {
            if (
                this.state.markersEnabled !== prevState.markersEnabled ||
                this.props.timeFeatures !== prevProps.timeFeatures
            ) {
                const layer = {
                    id: "timemarkers",
                    role: LayerRole.MARKER,
                    styleFunction: this.markerStyle,
                    rev: +new Date()
                };
                const features = Object.values(this.props.timeFeatures.features).flat();
                this.props.addLayerFeatures(layer, features, true);
            } else if (
                this.props.currentTimestamp !== prevProps.currentTimestamp ||
                this.props.enabled !== prevProps.enabled
            ) {
                this.props.refreshLayer(layer => layer.id === "timemarkers");
            }
        }
    }
    render() {
        const cursorPos = this.state.currentTimestampDrag ? this.state.currentTimestampDrag.pos : ((-this.state.panOffset) + "px + 50%");
        const timestamp = this.state.currentTimestampDrag ? this.state.currentTimestampDrag.time : this.props.currentTimestamp;
        const cursorStyle = {
            left: "calc(" + cursorPos + " - 2px)"
        };
        const labelStyle = {
            transform: "translateX(-50%)"
        };
        const navButtons = [
            {key: "home", tooltip: LocaleUtils.trmsg("timemanager.home"), icon: "home"},
            {key: "zoomout", tooltip: LocaleUtils.trmsg("timemanager.zoomout"), icon: "zoomout"},
            {key: "zoomin", tooltip: LocaleUtils.trmsg("timemanager.zoomin"), icon: "zoomin"}
        ];
        const sliderGeom = {
            rect: this.state.ticksContainer ? this.state.ticksContainer.getBoundingClientRect() : {},
            dt: this.props.endTime.diff(this.props.startTime),
            top: 30
        };
        sliderGeom.mid = 0.5 * sliderGeom.rect.width - this.state.panOffset;

        return (
            <div className="ctimeline" onWheel={this.onSliderWheel}>
                <div className="ctimeline-toolbar">
                    <ButtonBar buttons={navButtons} onClick={this.navButtonClicked} />
                    <div className="ctimeline-toolbar-block">
                        <span>{LocaleUtils.tr("timemanager.timelinescale")}: &nbsp;</span>
                        <NumberInput decimals={2} max={10} min={0.01} onChange={this.setTimeScale} value={this.state.timeScale} />
                    </div>
                    {this.props.markerConfiguration.markersAvailable ? (
                        <div className="ctimeline-toolbar-block">
                            <span>{LocaleUtils.tr("timemanager.markers")}: &nbsp;</span>
                            <ToggleSwitch active={this.state.markersEnabled} onChange={value => this.setState({markersEnabled: value})} readOnly={this.state.timeScale !== 1} />
                        </div>
                    ) : null}
                    <div className="ctimeline-toolbar-spacer" />
                </div>
                <div className="ctimeline-clip">
                    <button className="button ctimeline-pan-left" onMouseDown={() => this.pan(-20)}>
                        <Icon icon="chevron-left" />
                    </button>
                    <div className="ctimeline-ticks" ref={this.setTicksRef}>
                        {this.renderTicks()}
                    </div>
                    <button className="button ctimeline-pan-right" onMouseDown={() => this.pan(20)}>
                        <Icon icon="chevron-right" />
                    </button>
                </div>
                <div className="ctimeline-slider-container">
                    <div className="ctimeline-slider" onMouseDown={this.pickCurrentTimestamp}>
                        {this.renderTimeFeatures(sliderGeom)}
                        {this.renderGradient(sliderGeom)}
                    </div>
                    {this.props.enabled ? (
                        <div className="ctimeline-cursor" style={cursorStyle}>
                            <div className="ctimeline-cursor-label" style={labelStyle}>
                                {dayjs(timestamp).format("YYYY-MM-DD[\n]HH:mm:ss")}
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        );
    }
    setTimeScale = (value) => {
        this.setState({timeScale: value, markersEnabled: this.state.markersEnabled && parseFloat(value) === 1});
    }
    setTicksRef = (el) => {
        if (this.state.ticksContainer !== el) {
            this.setState({ticksContainer: el});
        }
    }
    pixelsToTimeDiffMS = (px, width, dt) => {
        const exp = this.state.timeScale;
        return Math.sign(px) * Math.pow(Math.abs(px) / (0.5 * width), exp) * 0.5 * dt * this.state.zoomFactor;
    }
    timeToPixelDiff = (time, width, dt) => {
        const curTimeDelta = time - this.props.currentTimestamp;
        const iexp = 1 / this.state.timeScale;
        return 0.5 * width * Math.sign(curTimeDelta) * Math.pow(Math.abs(curTimeDelta) / (0.5 * dt * this.state.zoomFactor), iexp);
    }
    renderTicks = () => {
        if (!this.state.ticksContainer) {
            return null;
        }

        const width = this.state.ticksContainer.offsetWidth;
        const deltaT = this.props.endTime.diff(this.props.startTime);
        const now = dayjs(this.props.currentTimestamp);
        const xnow = 0.5 * width;

        // Render one tick every 100px
        const ticks = [{
            perc: 50,
            time: now
        }];
        // Compute ticks before current time
        let x = xnow;
        x -= 100;
        while (x >= this.state.panOffset) {
            if (x < width + this.state.panOffset) {
                ticks.push({
                    perc: x / width * 100,
                    time: now + this.pixelsToTimeDiffMS(x - xnow, width, deltaT)
                });
            }
            x -= 100;
        }
        // Compute ticks after current time
        x = xnow;
        x += 100;
        while (x <= width + this.state.panOffset) {
            if (x > this.state.panOffset) {
                ticks.push({
                    perc: x / width * 100,
                    time: now + this.pixelsToTimeDiffMS(x - xnow, width, deltaT)
                });
            }
            x += 100;
        }
        // Intermediate ticks (lines only)
        const b = this.state.timeScale;
        const tickPos = [20, 40, 60, 80].map(p => Math.pow(p / 100, 1 / b) * 100);
        let i = 0;
        for (x = xnow; x - tickPos[i] >= this.state.panOffset;) {
            if (x - tickPos[i] < width + this.state.panOffset) {
                ticks.push({perc: (x - tickPos[i]) / width * 100});
            }
            i += 1;
            if (i >= tickPos.length) {
                x -= 100;
                i = 0;
            }
        }
        i = 0;
        for (x = xnow; x + tickPos[i] <= width + this.state.panOffset;) {
            if (x + tickPos[i] > this.state.panOffset) {
                ticks.push({perc: (x + tickPos[i]) / width * 100});
            }
            i += 1;
            if (i >= tickPos.length) {
                x += 100;
                i = 0;
            }
        }
        // Render ticks
        return ticks.map(tick => {
            const style = {
                left: "calc(" + (-this.state.panOffset) + "px + " + tick.perc + "% - 1px"
            };
            return (
                <span className={tick.time ? "ctimeline-ltick" : "ctimeline-tick"} key={"tick" + tick.perc} style={style}>
                    {tick.time ? (<span>{dayjs(tick.time).format("YYYY-MM-DD[\n]HH:mm:ss")}</span>) : null}
                </span>
            );
        });
    }
    navButtonClicked = (key) => {
        if (key === "home") {
            this.setState({panOffset: 0, zoomFactor: 1});
        } else if (key === "zoomin") {
            this.setState({zoomFactor: this.state.zoomFactor * 0.5});
        } else if (key === "zoomout") {
            this.setState({zoomFactor: this.state.zoomFactor * 2});
        }
    }
    pan = (offset) => {
        this.setState({panOffset: this.state.panOffset + offset});
        let panInterval = null;
        const panTimeout = setTimeout(() => {
            this.setState({panOffset: this.state.panOffset + offset});
            panInterval = setInterval(() => {
                this.setState({panOffset: this.state.panOffset + offset});
            }, 50);
        }, 250);
        document.addEventListener("mouseup", () => {
            clearInterval(panInterval);
            clearTimeout(panTimeout);
        }, {once: true, capture: true});
    }
    pickCurrentTimestamp = (event) => {
        clearTimeout(this.timestampChangeTimeout);
        const target = event.currentTarget;

        const computeTimestamp = (ev) => {
            if (!this.props.enabled) {
                return;
            }
            const rect = target.getBoundingClientRect();
            const deltaT = this.props.endTime.diff(this.props.startTime);
            const pos = ev.clientX;
            const dx = pos - (rect.left + 0.5 * rect.width) + this.state.panOffset;
            const newTimestamp = dayjs(this.props.currentTimestamp).add(this.pixelsToTimeDiffMS(dx, rect.width, deltaT), 'ms');
            this.setState({currentTimestampDrag: {
                pos: ((pos - rect.left) / rect.width * 100) + "%",
                time: newTimestamp,
                offset: dx
            }});
        };
        document.addEventListener("mousemove", computeTimestamp);
        document.addEventListener("mouseup", () => {
            if (this.state.currentTimestampDrag) {
                this.props.timestampChanged(+this.state.currentTimestampDrag.time);
                this.setState({
                    currentTimestampDrag: null,
                    panOffset: this.state.panOffset - this.state.currentTimestampDrag.offset
                });
            }
            document.removeEventListener("mousemove", computeTimestamp);
        }, {once: true, capture: true});
        computeTimestamp(event);
    }
    onSliderWheel = (ev) => {
        if (ev.shiftKey) {
            if (ev.deltaY < 0) {
                this.setState({zoomFactor: this.state.zoomFactor * 0.5});
            } else if (ev.deltaY > 0) {
                this.setState({zoomFactor: this.state.zoomFactor * 2});
            }
        } else {
            if (ev.deltaX < 0) {
                this.setState({panOffset: this.state.panOffset - 20});
            } else if (ev.deltaX > 0) {
                this.setState({panOffset: this.state.panOffset + 20});
            }
        }
        ev.preventDefault();
        ev.stopPropagation();
    }
    renderTimeFeatures = (sliderGeom) => {
        if (!this.state.ticksContainer) {
            return null;
        }

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
                    <div className="ctimeline-slider-layertitle">
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
        if (!this.state.ticksContainer || !this.state.markersEnabled) {
            return null;
        }
        const left = sliderGeom.mid + this.timeToPixelDiff(this.props.startTime, sliderGeom.rect.width, sliderGeom.dt);
        const right = sliderGeom.mid + this.timeToPixelDiff(this.props.endTime, sliderGeom.rect.width, sliderGeom.dt);
        const style = {
            left: left + "px",
            width: (right - left) + "px",
            height: sliderGeom.top + "px",
            background: 'linear-gradient(90deg, ' + this.props.markerConfiguration.gradient.join(", ") + ')'
        };
        return (
            <div className="ctimeline-slider-gradient" style={style} />
        );

    }
    renderTimeFeature = (sliderGeom, tstart, tend, features, label, attr, featClass) => {
        const left = sliderGeom.mid + this.timeToPixelDiff(tstart, sliderGeom.rect.width, sliderGeom.dt);
        const right = sliderGeom.mid + this.timeToPixelDiff(tend, sliderGeom.rect.width, sliderGeom.dt);

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
            <div className="ctimeline-slider-feature" key={features[0].id}
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
    markerStyle = (feature) => {
        const style = [
        ];
        const currentTime = dayjs(this.props.currentTimestamp);
        if (this.props.enabled && (feature.getProperties().__startdate > currentTime || feature.getProperties().__enddate < currentTime)) {
            return style;
        }
        const offset = this.props.markerConfiguration.markerOffset;
        if (this.props.markerConfiguration.markerPins) {
            style.push(new ol.style.Style({
                image: new ol.style.Icon({
                    anchor: [0.5, 1],
                    anchorXUnits: 'fraction',
                    anchorYUnits: 'fraction',
                    displacement: offset,
                    src: markerIcon
                })
            }));
        }
        const deltaT = this.props.endTime.diff(this.props.startTime);
        const markerStartTime = dayjs(Math.max(this.props.startTime, feature.getProperties().__startdate));
        const markerEndTime = dayjs(Math.min(this.props.endTime, feature.getProperties().__enddate));
        const markerMidTime = 0.5 * (markerStartTime + markerEndTime);
        const gradBarMaxWidth = 192;
        const gradBarHeight = 16;
        const gradBarWidth = gradBarMaxWidth * markerEndTime.diff(markerStartTime) / deltaT;

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const gradient = context.createLinearGradient(
            -gradBarWidth * (markerMidTime - this.props.startTime) / (markerMidTime - markerStartTime), 0,
            gradBarWidth * (this.props.endTime - markerMidTime) / (markerEndTime - markerMidTime), 0
        );
        const nStops = this.props.markerConfiguration.gradient.length;

        this.props.markerConfiguration.gradient.forEach((stop, idx) => {
            gradient.addColorStop(idx / (nStops - 1), stop);
        });

        style.push(new ol.style.Style({
            image: new ol.style.RegularShape({
                fill: new ol.style.Fill({color: gradient}),
                stroke: new ol.style.Stroke({color: 'black', width: 1}),
                points: 4,
                radius: gradBarWidth / Math.SQRT2,
                radius2: gradBarWidth,
                angle: 0,
                scale: [1, 1 / gradBarWidth * gradBarHeight],
                displacement: [offset[0], offset[1] * gradBarHeight / gradBarWidth - gradBarWidth]
            })
        }));
        return style;
    }
}

export default connect(() => ({}), {
    addLayerFeatures: addLayerFeatures,
    refreshLayer: refreshLayer,
    removeLayer: removeLayer
})(ContinuousTimeline);
