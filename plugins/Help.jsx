/**
 * Copyright Sourcepole AG
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
import LocaleUtils from '../utils/LocaleUtils';


/**
 * Displays a custom help dialog in a sidebar.
 *
 * Define the help contents by specifying the `bodyContentsFragmentUrl` prop.
 *
 * By overriding `id`, `icon` and `title`, multiple instances of this plugin can be configured
 * in parallel, i.e. one for the help contents and one for a privacy policy. To do so, give the
 * additional entries in the `plugins` block of `config.json` a distinct `key`:
 *
 *     {"name": "Help", "key": "Privacy", "cfg": {"id": "Privacy", "title": "Privacy policy", "bodyContentsFragmentUrl": "assets/privacy.html"}}
 *
 * and use the configured `id` as `key` of the corresponding app menu entry.
 */
class Help extends React.Component {
    static availableIn3D = true;
    static propTypes = {
        /** URL to a document containing a HTML fragment to display in the Help sidebar. */
        bodyContentsFragmentUrl: PropTypes.string,
        /** The icon to display in the sidebar title bar. */
        icon: PropTypes.string,
        /** The task identifier of this plugin instance, i.e. the `key` of the corresponding app menu entry. Change it to configure multiple Help instances in parallel. */
        id: PropTypes.string,
        renderBody: PropTypes.func,
        /** The side of the application on which to display the sidebar. */
        side: PropTypes.string,
        /** The translation message id of the sidebar title. */
        title: PropTypes.string
    };
    static defaultProps = {
        icon: 'info',
        id: 'Help',
        renderBody: () => { return null; },
        side: 'right',
        title: 'appmenu.items.Help'
    };
    state = {
        body: ''
    };
    componentDidMount() {
        this.componentDidUpdate({});
    }
    componentDidUpdate(prevProps) {
        if (this.props.bodyContentsFragmentUrl && this.props.bodyContentsFragmentUrl !== prevProps.bodyContentsFragmentUrl) {
            axios.get(this.props.bodyContentsFragmentUrl).then(response => {
                this.setState({body: response.data.replace('$VERSION$', process.env.BuildDate)});
            }).catch(() => {});
        }
    }
    render() {
        return (
            <SideBar icon={this.props.icon} id={this.props.id} side={this.props.side} title={LocaleUtils.tr(this.props.title)} width="20em">
                {() => ({
                    body: this.renderBody()
                })}
            </SideBar>
        );
    }
    renderBody = () => {
        if (this.props.bodyContentsFragmentUrl) {
            return (<div dangerouslySetInnerHTML={{__html: this.state.body}} />);
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
