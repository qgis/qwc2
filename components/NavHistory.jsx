/**
 * Copyright Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';

import LocaleUtils from '../utils/LocaleUtils';
import MapUtils from '../utils/MapUtils';
import Icon from './Icon';


class NavHistory extends React.Component {
    static propTypes = {
        theme: PropTypes.object
    };
    state = {
        history: [],
        index: -1
    };
    componentDidMount() {
        this.map = MapUtils.getHook(MapUtils.GET_MAP);
        this.map.on('moveend', this.storeHistory);
    }
    componentDidUpdate(prevProps) {
        if (this.props.theme !== prevProps.theme) {
            this.setState({history: [], index: -1});
        }
    }
    render() {
        return (
            <div className="NavHistory controlgroup">
                <button
                    className="button"
                    disabled={this.state.index <= 0}
                    onClick={this.back}
                    title={LocaleUtils.tr("navhistory.back")}
                    type="button"
                >
                    <Icon icon="arrow-left" />
                </button>
                <button
                    className="button"
                    disabled={this.state.index < 0 || this.state.index >= this.state.history.length - 1}
                    onClick={this.forward}
                    title={LocaleUtils.tr("navhistory.forward")}
                    type="button"
                >
                    <Icon icon="arrow-right" />
                </button>
            </div>
        );
    }
    storeHistory = () => {
        if (this.restoringHistory) {
            this.restoringHistory = false;
            return;
        }
        const view = this.map.getView();
        const entry = {
            center: view.getCenter(),
            resolution: view.getResolution(),
            rotation: view.getRotation()
        };
        this.setState(state => ({
            history: [...state.history.slice(0, state.index + 1), entry],
            index: state.index + 1
        }));
    };
    back = () => {
        this.setState(state => {
            if (state.index > 0) {
                this.applyHistoryEntry(state.history[state.index - 1]);
                return {index: state.index - 1};
            }
            return {};
        });
    };
    forward = () => {
        this.setState(state => {
            if (state.index < state.history.length - 1) {
                this.applyHistoryEntry(state.history[state.index + 1]);
                return {index: state.index + 1};
            }
            return {};
        });
    };
    applyHistoryEntry = (entry) => {
        const view = this.map.getView();
        this.restoringHistory = true;
        view.setCenter(entry.center);
        view.setResolution(entry.resolution);
        view.setRotation(entry.rotation);
    };
}

export default connect(state => ({
    theme: state.theme.current
}))(NavHistory);
