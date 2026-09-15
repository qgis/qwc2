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
import LocaleUtils from '../utils/LocaleUtils';


/**
 * Displays a custom help dialog in a sidebar.
 *
 * Define the help contents by specifying the `bodyContentsFragmentUrl` prop.
 *
 * Further variants can be configured through the `modes` prop, selected by the `mode` of the
 * app menu or toolbar entry which opens them, i.e. to display a privacy policy next to the
 * regular help contents:
 *
 *     {"name": "Help", "cfg": {"bodyContentsFragmentUrl": "assets/help.html", "modes": {"Privacy": {"icon": "lock", "bodyContentsFragmentUrl": "assets/privacy.html"}}}}
 *     {"key": "Help", "mode": "Privacy", "icon": "lock"}
 */
class Help extends React.Component {
    static availableIn3D = true;
    static propTypes = {
        /** URL to a document containing a HTML fragment to display in the Help sidebar. */
        bodyContentsFragmentUrl: PropTypes.string,
        currentTask: PropTypes.object,
        /** Alternative help contents, keyed by the `mode` of the app menu or toolbar entry which opens them.
         *  `icon` defaults to `info`, `title` to the `appmenu.items.Help<mode>` message. */
        modes: PropTypes.objectOf(PropTypes.shape({
            /** URL to a document containing a HTML fragment to display in the Help sidebar. */
            bodyContentsFragmentUrl: PropTypes.string,
            /** The icon to display in the sidebar title bar. */
            icon: PropTypes.string,
            /** The title of the sidebar. Defaults to the `appmenu.items.Help<mode>` message, as for the menu entry. */
            title: PropTypes.string
        })),
        renderBody: PropTypes.func,
        /** The side of the application on which to display the sidebar. */
        side: PropTypes.string
    };
    static defaultProps = {
        modes: {},
        renderBody: () => { return null; },
        side: 'right'
    };
    state = {
        bodies: {}
    };
    // Fragments are cached by url, so that switching modes back and forth does not refetch
    fetched = new Set();
    componentDidMount() {
        this.componentDidUpdate();
    }
    componentDidUpdate() {
        const url = this.modeConfig().bodyContentsFragmentUrl;
        if (url && !this.fetched.has(url)) {
            this.fetched.add(url);
            axios.get(url).then(response => {
                this.setState((state) => ({bodies: {...state.bodies, [url]: response.data.replace('$VERSION$', process.env.BuildDate)}}));
            }).catch(() => {});
        }
    }
    modeConfig = () => {
        const mode = this.props.currentTask?.id === "Help" ? this.props.currentTask.mode : null;
        return {
            bodyContentsFragmentUrl: this.props.bodyContentsFragmentUrl,
            icon: "info",
            title: "appmenu.items.Help" + (mode || ""),
            ...this.props.modes[mode]
        };
    };
    render() {
        const config = this.modeConfig();
        return (
            <SideBar icon={config.icon} id="Help" side={this.props.side} title={LocaleUtils.tr(config.title)} width="20em">
                {() => ({
                    body: this.renderBody(config)
                })}
            </SideBar>
        );
    }
    renderBody = (config) => {
        if (config.bodyContentsFragmentUrl) {
            return (<div dangerouslySetInnerHTML={{__html: this.state.bodies[config.bodyContentsFragmentUrl] ?? ''}} />);
        } else {
            return this.props.renderBody();
        }
    };
}

export default (renderHelp) => {
    return connect((state) => ({
        currentTask: state.task,
        renderBody: renderHelp
    }), {})(Help);
};
