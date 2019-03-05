/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const Message = require('../components/I18N/Message');
const {SideBar} = require('../components/SideBar');

class Help extends React.Component {
    static propTypes = {
        renderBody: PropTypes.func
    }
    static defaultProps = {
        renderBody: () => { return null; }
    }
    render() {
        return (
            <SideBar id="Help" width="20em" title="appmenu.items.Help"
                icon="info">
                {() => ({
                    body: (<div>{this.props.renderBody()}</div>)
                })}
            </SideBar>
        );
    }
};

module.exports = (renderHelp) => { return {
    HelpPlugin: connect((state) => ({
        renderBody: renderHelp
    }), {})(Help),
    reducers: {
        task: require('../reducers/task')
    }
}};
