/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const {connect} = require('react-redux');
const Message = require('../../MapStore2/web/client/components/I18N/Message');
const ConfigUtils = require("../../MapStore2/web/client/utils/ConfigUtils");
require('./style/Toolbar.css');
const {triggerTool} = require('../actions/maptools');
const {setCurrentTask} = require('../actions/task')

const Toolbar = React.createClass({
    propTypes: {
        toolbarItems: React.PropTypes.array,
        toolbaritemClicked: React.PropTypes.func,
        setCurrentTask: React.PropTypes.func,
        currentTask: React.PropTypes.string
    },
    getDefaultProps() {
        return {
        }
    },
    renderToolbarItem(item) {
        let assetsPath = ConfigUtils.getConfigProp("assetsPath");
        let active = this.props.currentTask == item.key;
        return (<img key={item.key}
            className={active ? "toolbar-item-active" : ""}
            src={assetsPath + "/" + item.icon}
            onClick={active ? () => this.props.setCurrentTask(null) : () => this.props.toolbaritemClicked(item.key)} />);
    },
    render() {
        return (
            <span id="Toolbar">
                {this.props.toolbarItems.map(this.renderToolbarItem)}
            </span>
        );
    }
});

module.exports = {
    Toolbar: connect((state) => ({
        currentTask: state.task ? state.task.current : "",
    }), {
        toolbaritemClicked: triggerTool,
        setCurrentTask: setCurrentTask,
    })(Toolbar)
};
