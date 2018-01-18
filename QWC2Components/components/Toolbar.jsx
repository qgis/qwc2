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
const Message = require('../../MapStore2Components/components/I18N/Message');
const ConfigUtils = require("../../MapStore2Components/utils/ConfigUtils");
const LocaleUtils = require("../../MapStore2Components/utils/LocaleUtils");
require('./style/Toolbar.css');
const {setCurrentTask} = require('../actions/task')

class Toolbar extends React.Component {
    static propTypes = {
        toolbarItems: PropTypes.array,
        setCurrentTask: PropTypes.func,
        currentTask: PropTypes.string,
        currentTaskMode: PropTypes.string
    }
    static contextTypes = {
        messages: PropTypes.object
    }
    renderToolbarItem = (item) => {
        let assetsPath = ConfigUtils.getConfigProp("assetsPath");
        let active = this.props.currentTask == item.key && this.props.currentTaskMode == item.mode;
        let title = LocaleUtils.getMessageById(this.context.messages, "appmenu.items." + item.key) || null;
        return (
            <img
                key={item.key + item.mode}
                className={active ? "toolbar-item-active" : ""}
                src={assetsPath + "/" + item.icon}
                onClick={active ? () => this.props.setCurrentTask(null) : () => this.props.setCurrentTask(item.key, item.mode)}
                title={title}
            />
        );
    }
    render() {
        return (
            <span id="Toolbar">
                {this.props.toolbarItems.map(this.renderToolbarItem)}
            </span>
        );
    }
};

module.exports = connect((state) => ({
    currentTask: state.task ? state.task.current : "",
    currentTaskMode: state.task ? state.task.mode : "",
}), {
    setCurrentTask: setCurrentTask,
})(Toolbar);
