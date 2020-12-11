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
            <SideBar icon="info" id="Help" title="appmenu.items.Help" width="20em">
                {() => ({
                    body: (<div>{this.props.renderBody(this.props)}</div>)
                })}
            </SideBar>
        );
    }
}

module.exports = (renderHelp) => {
    return {
        HelpPlugin: connect(() => ({
            renderBody: renderHelp
        }), {})(Help),
        reducers: {
            task: require('../reducers/task')
        }
    };
};
