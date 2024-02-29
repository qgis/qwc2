/**
 * Copyright 2016-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import axios from 'axios';
import PropTypes from 'prop-types';

import SideBar from '../components/SideBar';


/**
 * Displays a custom help dialog in a sidebar.
 *
 * Define the help contents by specifying the `bodyContentsFragmentUrl` prop.
 */
class Help extends React.Component {
    static propTypes = {
        /** URL to a document containing a HTML fragment to display in the Help sidebar. */
        bodyContentsFragmentUrl: PropTypes.string,
        renderBody: PropTypes.func,
        /** The side of the application on which to display the sidebar. */
        side: PropTypes.string
    };
    static defaultProps = {
        renderBody: () => { return null; },
        side: 'right'
    };
    constructor(props) {
        super(props);
        this.bodyEl = null;
    }
    componentDidMount() {
        if (this.props.bodyContentsFragmentUrl) {
            axios.get(this.props.bodyContentsFragmentUrl).then(response => {
                this.bodyEl.innerHTML = response.data.replace('$VERSION$', process.env.BuildDate);
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
    };
}

export default (renderHelp) => {
    return connect(() => ({
        renderBody: renderHelp
    }), {})(Help);
};
