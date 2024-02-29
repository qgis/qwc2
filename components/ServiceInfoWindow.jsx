/**
 * Copyright 2020-2024 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';

import {setActiveServiceInfo} from '../actions/serviceinfo';
import ResizeableWindow from '../components/ResizeableWindow';
import LocaleUtils from '../utils/LocaleUtils';
import MiscUtils from '../utils/MiscUtils';

import './style/ServiceInfoWindow.css';

class ServiceInfoWindow extends React.Component {
    static propTypes = {
        layerInfoGeometry: PropTypes.object,
        service: PropTypes.object,
        setActiveServiceInfo: PropTypes.func
    };
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
                    <td>{LocaleUtils.tr(title)}:</td>
                    {html ? (
                        <td dangerouslySetInnerHTML={{__html: MiscUtils.addLinkAnchors(content)}} />
                    ) : (<td>{content}</td>)}
                </tr>
            );
        }
        return null;
    };
    render() {
        if (!this.props.service) {
            return null;
        }
        return (
            <ResizeableWindow icon="info-sign" initialHeight={this.props.layerInfoGeometry.initialHeight} initialWidth={this.props.layerInfoGeometry.initialWidth}
                initialX={this.props.layerInfoGeometry.initialX} initialY={this.props.layerInfoGeometry.initialY}
                initiallyDocked={this.props.layerInfoGeometry.initiallyDocked} onClose={this.onClose}
                title={LocaleUtils.trmsg("serviceinfo.title")}>
                <div className="service-info-window-body" role="body">
                    <h4 className="service-info-window-title">{this.props.service.title}</h4>
                    <div className="service-info-window-frame">
                        <table className="service-info-window-table">
                            <tbody>
                                {this.renderRow(LocaleUtils.trmsg("serviceinfo.abstract"), this.props.service.abstract, true)}
                                {this.renderRow(LocaleUtils.trmsg("serviceinfo.keywords"), this.props.service.keywords)}
                                {this.renderRow(LocaleUtils.trmsg("serviceinfo.onlineResource"), this.renderLink(this.props.service.onlineResource, this.props.service.onlineResource))}
                                {this.renderRow(LocaleUtils.trmsg("serviceinfo.contactPerson"), this.props.service.contact.person)}
                                {this.renderRow(LocaleUtils.trmsg("serviceinfo.contactOrganization"), this.props.service.contact.organization)}
                                {this.renderRow(LocaleUtils.trmsg("serviceinfo.contactPosition"), this.props.service.contact.position)}
                                {this.renderRow(LocaleUtils.trmsg("serviceinfo.contactPhone"), this.props.service.contact.phone)}
                                {this.renderRow(LocaleUtils.trmsg("serviceinfo.contactEmail"), this.props.service.contact.email)}
                            </tbody>
                        </table>
                    </div>
                </div>
            </ResizeableWindow>
        );
    }
    onClose = () => {
        this.props.setActiveServiceInfo(null);
    };
}

const selector = state => ({
    service: state.serviceinfo.service
});

export default connect(selector, {
    setActiveServiceInfo: setActiveServiceInfo
})(ServiceInfoWindow);
