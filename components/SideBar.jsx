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
const {Swipeable} = require('react-swipeable');
const Message = require('../components/I18N/Message');
const {setCurrentTask} = require('../actions/task');
const Icon = require('./Icon')
require('./style/SideBar.css');

class SideBar extends React.Component {
    static propTypes = {
        id: PropTypes.string.isRequired,
        extraClasses: PropTypes.string,
        currentTask: PropTypes.object,
        onShow: PropTypes.func,
        onHide: PropTypes.func,
        width: PropTypes.string,
        setCurrentTask: PropTypes.func,
        title: PropTypes.string,
        icon: PropTypes.string,
        extraTitlebarContent: PropTypes.object
    }
    static defaultProps = {
        extraClasses: '',
        onShow: (mode) => {},
        onHide: () => {},
        width: '15em',
        minWidth: '15em'
    }
    state = {
        render: false
    }
    componentDidMount(props) {
        let visible = this.props.currentTask && this.props.currentTask.id === this.props.id;
        this.setState({render: visible});
    }
    componentWillReceiveProps(newProps) {
        let newVisible = newProps.currentTask && newProps.currentTask.id === newProps.id;
        let oldVisible = this.props.currentTask && this.props.currentTask.id === this.props.id;
        if(newVisible && (!oldVisible || newProps.currentTask.mode !== this.props.currentTask.mode)) {
            this.setState({render: true});
            newProps.onShow(newProps.currentTask.mode);
        } else if(!newVisible && oldVisible) {
            newProps.onHide();
            // Hide the element after the transition period (see SideBar.css)
            setTimeout(() => {this.setState({render: false})}, 300);
        }
    }
    closeClicked = () => {
        if(this.props.currentTask.id === this.props.id) {
            this.props.setCurrentTask(null);
        }
    }
    renderRole = (role) => {
        return React.Children.toArray(this.props.children).filter((child) => child.props.role === role);
    }
    render() {
        let visible = this.props.currentTask.id === this.props.id;
        let render = visible || this.state.render;
        let style = {
            width: this.props.width,
            minWidth: this.props.minWidth,
            right: 0,
            transform: visible ? '' : 'translateX(100%) translateX(8px)',
            zIndex: visible ? 5 : 4
        }
        let contents = null;
        if(render && typeof this.props.children === "function") {
            contents = this.props.children();
        }
        return (
            <div>
                <Swipeable onSwipedRight={this.closeClicked} delta={30}>
                    <div id={this.props.id} className={"sidebar" + " " + this.props.extraClasses} style={style}>
                        <div className="sidebar-titlebar">
                            <Icon className="sidebar-titlebar-icon" icon={this.props.icon} size="large"/>
                            <span className="sidebar-titlebar-title"><Message msgId={this.props.title} /></span>
                            {this.state.render ? this.props.extraTitlebarContent : null}
                            <span className="sidebar-titlebar-spacer" />
                            <Icon className="sidebar-titlebar-closeicon" onClick={this.closeClicked} icon="chevron-right"/>
                        </div>
                        <div className="sidebar-body">
                            {render ? (contents ? contents.body || null : this.renderRole("body")) : null}
                        </div>
                    </div>
                </Swipeable>
                {render ? (contents ? contents.extra || null : this.renderRole("extra")) : null}
            </div>
        );
    }
};

const selector = (state) => ({
    currentTask: state.task
});

module.exports = {
    SideBar: connect(selector, {
        setCurrentTask: setCurrentTask,
    })(SideBar)
}
