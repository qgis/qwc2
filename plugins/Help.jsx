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
import axios from 'axios';
import SideBar from '../components/SideBar';

class Help extends React.Component {
    static propTypes = {
        bodyContentsFragmentUrl: PropTypes.string,
        renderBody: PropTypes.func,
        side: PropTypes.string
    }
    static defaultProps = {
        renderBody: () => { return null; },
        side: 'right'
    }
    constructor(props) {
        super(props);
        this.bodyEl = null;
    }
    componentDidMount() {
        if (this.props.bodyContentsFragmentUrl) {
            axios.get(this.props.bodyContentsFragmentUrl).then(response => {
                this.bodyEl.innerHTML = response.data;
            }).catch(() => {});
        }
    }
    render() {
        return (
            <SideBar icon="info" id="Help" renderWhenHidden side={this.props.side} title="appmenu.items.Help" width="20em">
                {() => ({
                    body: this.renderBody()
                })}
            </SideBar>
        );
    }
    renderBody = () => {
        if (this.props.bodyContentsFragmentUrl) {
            return (<div ref={el => {this.bodyEl = el;}} />);
        } else {
            return this.props.renderBody();
        }
    }
}

export default (renderHelp) => {
    return connect(() => ({
        renderBody: renderHelp
    }), {})(Help);
};
