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
import classnames from 'classnames';
import {clearProcess, ProcessStatus} from '../actions/processNotifications';
import Icon from '../components/Icon';
import Spinner from '../components/Spinner';
import './style/ProcessNotifications.css';

class ProcessNotifications extends React.Component {
    static propTypes = {
        clearProcess: PropTypes.func,
        processes: PropTypes.object
    }
    render() {
        return (
            <div className="process-notifications">
                {Object.values(this.props.processes).map(this.renderProcessNotification)}
            </div>
        );
    }
    renderProcessNotification = (process) => {
        const className = classnames({
            "process-notification": true,
            "process-notification-pending": process.status === ProcessStatus.BUSY,
            "process-notification-success": process.status === ProcessStatus.SUCCESS,
            "process-notification-failure": process.status === ProcessStatus.FAILURE
        });
        let icon = "";
        let close = false;
        if (process.status === ProcessStatus.BUSY) {
            icon = (<Spinner />);
        } else if (process.status === ProcessStatus.SUCCESS) {
            setTimeout(() => {
                this.props.clearProcess(process.id);
            }, 7000);
            icon = (<Icon icon="ok" />);
            close = true;
        } else if (process.status === ProcessStatus.FAILURE) {
            icon = (<Icon icon="warning" />);
            close = true;
        }
        return (
            <div className={className} key={process.id}>
                <div className="process-notification-head">
                    {icon}
                    <span className="process-notification-label">{process.name}</span>
                    {close ? (<Icon icon="remove" onClick={() => this.props.clearProcess(process.id)} />) : null}
                </div>
                {process.message ? (
                    <div className="process-notification-detail">
                        {process.message}
                    </div>
                ) : null}
            </div>
        );
    }
}


export default connect(state => ({
    processes: state.processNotifications.processes
}), {
    clearProcess: clearProcess
})(ProcessNotifications);
