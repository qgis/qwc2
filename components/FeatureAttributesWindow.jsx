/**
 * Copyright 2025 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';

import LocaleUtils from '../utils/LocaleUtils';
import Icon from './Icon';
import ResizeableWindow from './ResizeableWindow';
import TextInput from './widgets/TextInput';

import './style/FeatureAttributesWindow.css';


class FeatureAttributesWindow extends React.Component {
    static propTypes = {
        allAttribs: PropTypes.array,
        feature: PropTypes.object,
        onClose: PropTypes.func,
        onFeatureChanged: PropTypes.func
    };
    render() {
        let body = null;
        if (!this.props.feature) {
            body = (<span>{LocaleUtils.tr("featureattributes.nofeature")}</span>);
        } else {
            body = this.renderAttributesList();
        }
        return (
            <ResizeableWindow fitHeight icon="list-alt" initialWidth={320}
                onClose={this.props.onClose} scrollable title={LocaleUtils.tr("featureattributes.windowtitle")} >
                <div className="feature-attributes-body" role="body">{body}</div>
            </ResizeableWindow>
        );
    }
    renderAttributesList = () => {
        const featureAttribs = new Set(Object.keys(this.props.feature.properties || {}));
        featureAttribs.add("label");
        return (
            <form action="" onSubmit={this.addAttrib}>
                <table>
                    <tbody>
                        {Object.entries(this.props.feature.properties || {}).filter(
                            ([name, value]) => (name !== "label" && typeof value === 'string')
                        ).map(([name, value]) => (
                            <tr key={name}>
                                <td>{name}</td>
                                <td><TextInput onChange={(text) => this.updateAttrib(name, text)} value={value} /></td>
                                <td><button className="button" type="button"><Icon icon="trash" onClick={() => this.removeAttrib(name)} /></button></td>
                            </tr>
                        ))}
                        {this.props.allAttribs.filter(attrib => !featureAttribs.has(attrib)).map(name => (
                            <tr key={name}>
                                <td><i>{name}</i></td>
                                <td><TextInput onChange={(text) => this.updateAttrib(name, text)} value={""} /></td>
                                <td />
                            </tr>
                        ))}
                        <tr>
                            <td>
                                <input name="name" placeholder={LocaleUtils.tr("featureattributes.name")} type="text" />
                            </td>
                            <td>
                                <input name="value" placeholder={LocaleUtils.tr("featureattributes.value")} type="text" />
                            </td>
                            <td>
                                <button className="button" type="submit">
                                    <Icon icon="plus" />
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </form>
        );
    };
    updateAttrib = (name, value) => {
        const newFeature = {...this.props.feature};
        newFeature.properties = {...newFeature.properties};
        newFeature.properties[name] = value.trim();
        this.props.onFeatureChanged(newFeature);
    };
    removeAttrib = (name) => {
        const newFeature = {...this.props.feature};
        newFeature.properties = {...newFeature.properties};
        delete newFeature.properties[name];
        this.props.onFeatureChanged(newFeature, [name]);
    };
    addAttrib = (ev) => {
        ev.preventDefault();
        const newFeature = {...this.props.feature};
        newFeature.properties = {...newFeature.properties};
        const name = ev.target.elements.name.value.trim();
        const value = ev.target.elements.value.value.trim();
        if (name && !(name in newFeature.properties)) {
            newFeature.properties[name] = value;
            this.props.onFeatureChanged(newFeature);
            ev.target.elements.name.value = "";
            ev.target.elements.value.value = "";
        }
    };
}

export default connect((state, ownProps) => ({
    allAttribs: [...(state.layers.flat.find(layer => layer.id === ownProps.layerid)?.features ?? []).reduce((res, feature) => {
        Object.keys(feature.properties || {}).forEach(key => res.add(key));
        return res;
    }, new Set())]
}), {
})(FeatureAttributesWindow);
