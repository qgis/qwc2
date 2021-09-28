/**
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import SideBar from '../components/SideBar';

class Help extends React.Component {
    static propTypes = {
        renderBody: PropTypes.func,
        side: PropTypes.string
    }
    static defaultProps = {
        renderBody: () => { return null; },
        side: 'right'
    }
    render() {
        return (
            <SideBar side={this.props.side} icon="info" id="Help" title="appmenu.items.Help" width="20em">
                {() => ({
                    body: (<div>{this.props.renderBody(this.props)}</div>)
                })}
            </SideBar>
        );
    }
}

export default (renderHelp) => {
    return connect(() => ({
        renderBody: renderHelp
    }), {})(Help);
};
