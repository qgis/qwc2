/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const {Glyphicon} = require('react-bootstrap');
const {connect} = require('react-redux');
const assign = require('object-assign');
const Swipeable = require('react-swipeable');
const Message = require('../../MapStore2/web/client/components/I18N/Message');
const MapUtils = require('../../MapStore2/web/client/utils/MapUtils');
const {configurePrintFrame, clearPrintFrame} = require('../../MapStore2/web/client/actions/printframe');
const {setCurrentSidebar} = require("../actions/sidebar");
require('./style/SideBar.css');
require('./style/Print.css');

const Print = React.createClass({
    propTypes: {
        sidebarVisible: React.PropTypes.bool,
        theme: React.PropTypes.object,
        setCurrentSidebar: React.PropTypes.func,
        map: React.PropTypes.object,
        configurePrintFrame: React.PropTypes.func,
        clearPrintFrame: React.PropTypes.func
    },
    getDefaultProps() {
        return {
            visible: false
        }
    },
    getInitialState() {
        return {layout: null, scale: null, dpi: 300};
    },
    componentWillReceiveProps(newProps) {
        let newState = assign({}, this.state);
        if(newProps.theme !== this.props.theme || !this.state.layout) {
            let layout = null;
            if(newProps.theme && newProps.theme.print && newProps.theme.print.length > 0) {
                layout = newProps.theme.print[0];
            }
            newState["layout"] = layout;
        }
        if(newProps.sidebarVisible && !this.props.sidebarVisible) {
            newState["scale"] = Math.round(MapUtils.getGoogleMercatorScale(newProps.map.zoom + 1));
        }
        this.setState(newState);
        if(newProps.sidebarVisible) {
            this.updatePrintArea(newProps.map, newState.scale, newState.layout);
        }
    },
    closeClicked() {
        if(this.props.sidebarVisible) {
            this.props.setCurrentSidebar(null);
        }
        this.props.clearPrintFrame();
    },
    renderBody() {
        if(!this.props.sidebarVisible) {
            return null;
        } else if(!this.props.theme) {
            return (<Message msgId="print.notheme" />);
        } else if(!this.props.theme.print || this.props.theme.print.length === 0) {
            return (<Message msgId="print.nolayouts" />);
        }
        let currentLayoutname = this.state.layout ? this.state.layout.name : "";
        return (
            <table className="options-table"><tbody>
                <tr>
                    <td><Message msgId="print.layout" /></td>
                    <td>
                        <select onChange={this.changeLayout} value={currentLayoutname}>
                            {this.props.theme.print.map(item => {
                                return (
                                    <option key={item.name} value={item.name}>{item.name}</option>
                                )
                            })}
                        </select>
                    </td>
                </tr>
                <tr>
                    <td><Message msgId="print.scale" /></td>
                    <td><span className="input-frame">1 : <input type="number" value={this.state.scale} onChange={this.changeScale}/></span></td>
                </tr>
                <tr>
                    <td><Message msgId="print.resolution" /></td>
                    <td><span className="input-frame"><input type="number" value={this.state.dpi} onChange={this.changeResolution}/> dpi</span></td>
                </tr>
            </tbody></table>
        );
    },
    render() {
        return (
            <Swipeable onSwipedRight={this.closeClicked}>
                <div id="Print" className={this.props.sidebarVisible ? "sidebar sidebar-visible" : "sidebar"}>
                    <div className="sidebar-title"><Message msgId="print.paneltitle" /><Glyphicon onClick={this.closeClicked} glyph="remove"/></div>
                    <div className="print-body">
                        {this.renderBody()}
                    </div>
                </div>
            </Swipeable>
        );
    },
    changeLayout(ev) {
        let layout = this.props.theme.print.find(item => item.name == ev.target.value);
        this.setState({layout: layout});
        this.updatePrintArea(this.props.map, this.state.scale, layout);
    },
    changeScale(ev) {
        this.setState({scale: ev.target.value});
        this.updatePrintArea(this.props.map, ev.target.value, this.state.layout);
    },
    changeResolution(ev) {
        this.setState({dpi: ev.target.value});
    },
    updatePrintArea(map, scale, layout) {
        if(!this.state.layout) {
            return;
        }
        let widthmm = layout.map.width;
        let heightmm = layout.map.height;
        this.props.configurePrintFrame(map.center, scale, widthmm, heightmm);
    }
});

const selector = (state) => ({
    sidebarVisible: state.sidebar ? state.sidebar.current === 'print' : false,
    theme: state.theme ? state.theme.current : null,
    map: state.map ? state.map.present : null
});

module.exports = {
    PrintPlugin: connect(selector, {
        setCurrentSidebar: setCurrentSidebar,
        configurePrintFrame: configurePrintFrame,
        clearPrintFrame: clearPrintFrame
    })(Print),
    reducers: {
        sidebar: require('../reducers/sidebar'),
        printframe: require('../../MapStore2/web/client/reducers/printframe')
    }
}
