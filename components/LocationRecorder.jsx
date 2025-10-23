/**
 * Copyright 2015 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import ReactDOM from 'react-dom';
import {connect} from 'react-redux';

import classNames from 'classnames';
import PropTypes from 'prop-types';

import CoordinatesUtils from '../utils/CoordinatesUtils';
import LocaleUtils from '../utils/LocaleUtils';
import Icon from './Icon';
import {BottomToolPortalContext} from './PluginsContainer';
import NumberInput from './widgets/NumberInput';

import './style/LocationRecorder.css';


class LocationRecorder extends React.Component {
    static contextType = BottomToolPortalContext;
    static propTypes = {
        drawInteraction: PropTypes.object,
        geomType: PropTypes.string,
        locateEnabled: PropTypes.bool,
        locatePosition: PropTypes.array,
        map: PropTypes.object
    };
    state = {
        recording: false,
        interval: 1
    };
    constructor(props) {
        super(props);
        this.pollInterval = null;
    }
    componentWillUnmount() {
        this.stopRecording();
    }
    render() {
        if (!this.props.locateEnabled || !this.props.locatePosition) {
            return null;
        }
        const buttonClasses = classNames({
            button: true,
            pressed: this.state.recording
        });
        return ReactDOM.createPortal((
            <div className="LocationRecorder">
                <Icon icon="screenshot" />
                <button className={buttonClasses} onClick={this.toggleRecording}>
                    <Icon icon={this.state.recording ? "square" : "circle_full"} />
                    <span>{this.state.recording ? LocaleUtils.tr("locationrecorder.stop") : LocaleUtils.tr("locationrecorder.record")}</span>
                </button>
                <NumberInput decimals={1} max={30} min={0.5} mobile onChange={value => this.setState({interval: value})} step={0.5} suffix="s" value={this.state.interval} />
            </div>
        ), this.context);
    }
    toggleRecording = () => {
        if (this.state.recording) {
            this.stopRecording();
        } else {
            this.props.drawInteraction.abortDrawing();
            this.props.drawInteraction.setActive(false);
            // Re-add overlay to map, removed by setActive(false), to ensure traced feature is visibile
            this.props.drawInteraction.getOverlay().setMap(this.props.map);

            this.setState({recording: true});
            if (!navigator.geolocation) {
                this.stopRecording();
                /* eslint-disable-next-line */
                console.error("Geolocation not supported");
            } else {
                console.log(this.props.locatePosition);
                this.props.drawInteraction.appendCoordinates([this.props.locatePosition]);
                if (this.props.geomType === "Point") {
                    this.stopRecording();
                } else {
                    this.pollInterval = setInterval(() => {
                        console.log(this.props.locatePosition);
                        this.props.drawInteraction.appendCoordinates([this.props.locatePosition]);
                    }, this.state.interval * 1000);
                }
            }
        }
    };
    stopRecording = () => {
        this.setState({recording: false}, this.finishDrawing);
        clearInterval(this.pollInterval);
    };
    finishDrawing = () => {
        this.props.drawInteraction.finishDrawing();
        this.props.drawInteraction.setActive(true);
    };
}

export default connect((state) => ({
    locateEnabled: ["ENABLED", "FOLLOWING"].includes(state.locate.state),
    locatePosition: state.locate.mapPos
}))(LocationRecorder);
