/**
 * Copyright 2020, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const Message = require('../components/I18N/Message');
const {setActiveServiceInfo} = require('../actions/serviceinfo');
const ResizeableWindow = require("../components/ResizeableWindow");
const MiscUtils = require('../utils/MiscUtils');
require('./style/ServiceInfoWindow.css');

class ServiceInfoWindow extends React.Component {
    static propTypes = {
        service: PropTypes.object,
        setActiveServiceInfo: PropTypes.func,
        windowSize: PropTypes.object
    }
    renderLink(text, url) {
        if (url) {
            return (<a href={url} rel="noreferrer" target="_blank">{text}</a>);
        } else if (text) {
            return text;
        }
        return null;
    }
    renderRow = (title, content, html = false) => {
        if (content) {
            return (
                <tr>
                    <td><Message msgId={title} />:</td>
                    {html ? (
                        <td dangerouslySetInnerHTML={{__html: MiscUtils.addLinkAnchors(content)}} />
                    ) : (<td>{content}</td>)}
                </tr>
            );
        }
        return null;
    }
    render() {
        if (!this.props.service) {
            return null;
        }
        return (
            <ResizeableWindow icon="info-sign" initialHeight={this.props.windowSize.height} initialWidth={this.props.windowSize.width} onClose={this.onClose}
                title="serviceinfo.title" zIndex={10}>
                <div className="service-info-window-body" role="body">
                    <h4 className="service-info-window-title">{this.props.service.title}</h4>
                    <div className="service-info-window-frame">
                        <table className="service-info-window-table">
                            <tbody>
                                {this.renderRow("serviceinfo.abstract", this.props.service.abstract, true)}
                                {this.renderRow("serviceinfo.keywords", this.props.service.keywords)}
                                {this.renderRow("serviceinfo.onlineResource", this.renderLink(this.props.service.onlineResource, this.props.service.onlineResource))}
                                {this.renderRow("serviceinfo.contactPerson", this.props.service.contact.person)}
                                {this.renderRow("serviceinfo.contactOrganization", this.props.service.contact.organization)}
                                {this.renderRow("serviceinfo.contactPosition", this.props.service.contact.position)}
                                {this.renderRow("serviceinfo.contactPhone", this.props.service.contact.phone)}
                                {this.renderRow("serviceinfo.contactEmail", this.props.service.contact.email)}
                            </tbody>
                        </table>
                    </div>
                </div>
            </ResizeableWindow>
        );
    }
    onClose = () => {
        this.props.setActiveServiceInfo(null);
    }
}

const selector = state => ({
    service: state.serviceinfo.service || null
});

module.exports = connect(selector, {
    setActiveServiceInfo: setActiveServiceInfo
})(ServiceInfoWindow);
