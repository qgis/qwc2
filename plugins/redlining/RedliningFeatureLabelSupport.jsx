/**
 * Copyright 2026 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';

import PropTypes from 'prop-types';

import {addLayer, addLayerFeatures, removeLayerFeatures, removeLayer, LayerRole} from '../../actions/layers';
import Icon from '../../components/Icon';
import PickFeature from '../../components/PickFeature';
import ComboBox from '../../components/widgets/ComboBox';
import TextInput from '../../components/widgets/TextInput';
import {parseExpression} from '../../utils/EditingUtils';
import LocaleUtils from '../../utils/LocaleUtils';


class RedliningFeatureLabelSupport extends React.Component {
    static propTypes = {
        addLayer: PropTypes.func,
        addLayerFeatures: PropTypes.func,
        layers: PropTypes.array,
        projection: PropTypes.string,
        redlining: PropTypes.object,
        removeLayer: PropTypes.func,
        removeLayerFeatures: PropTypes.func
    };
    state = {
        cur: null,
        currentProfile: null
    };
    componentDidUpdate(prevProps) {
        if (this.props.redlining.action !== "FeatureLabel" && prevProps.redlining.action === "FeatureLabel") {
            this.setState({cur: null, currentProfile: null});
            this.props.removeLayer("__redliningfeaturelabelhighlight");
        }
    }
    componentWillUnmount() {
        this.props.removeLayer("__redliningfeaturelabelhighlight");
    }
    render() {
        let control = null;
        if (this.state.cur) {
            const selectedProfile = this.state.cur.profiles.find(profile => profile.name === this.state.currentProfile);
            const isCustomProfile = this.state.currentProfile === "__custom";
            control = (
                <div className="controlgroup" key="Control">
                    {this.state.cur.profiles.length > 1 ? (
                        <ComboBox onChange={this.setCurrentProfile} value={this.state.currentProfile}>
                            {this.state.cur.profiles.map(profile => (
                                <div key={profile.name} value={profile.name}>{profile.title ?? profile.name}</div>
                            ))}
                        </ComboBox>
                    ) : null}
                    <TextInput
                        className="controlgroup-expanditem" multiline onChange={this.setProfileExpression}
                        placeholder={"'Text: ' || \"fieldname\""}
                        readOnly={!isCustomProfile} value={selectedProfile?.expression} />
                    {isCustomProfile ? (
                        <button className="button" type="button"><Icon icon="ok" /></button>
                    ) : null}
                </div>
            );
        } else {
            control = (
                <div className="redlining-message" key="Control">
                    {LocaleUtils.tr("redlining.labelselectfeature")}
                </div>
            );
        }
        return [control, (
            <PickFeature featurePicked={this.featurePicked} key="FeaturePicker" layerFilterFunc={layer => layer.type === "wms"} />
        )];
    }
    featurePicked = (layer, feature, map, mapPos) => {
        const sellayer = {
            id: "__redliningfeaturelabelhighlight",
            role: LayerRole.SELECTION
        };
        this.props.addLayerFeatures(sellayer, [feature], true);
        const profiles = [...(this.props.layers.find(l => l.wms_name === map)?.labelProfiles?.[layer] ?? [])];
        profiles.push({name: "__custom", expression: "", title: LocaleUtils.tr("common.custom")});
        this.setState({cur: {layer, feature, map, profiles, mapPos}, currentProfile: profiles[0].name}, this.updateLabelFeature);
    };
    setCurrentProfile = (value) => {
        this.setState({currentProfile: value}, this.updateLabelFeature);
    };
    setProfileExpression = (value) => {
        this.setState(state => ({
            cur: {
                ...state.cur,
                profiles: state.cur.profiles.map(profile => ({
                    ...profile, expression: profile.name === state.currentProfile ? value : profile.expression
                }))
            }
        }), this.updateLabelFeature);
    };
    updateLabelFeature = () => {
        const cur = this.state.cur;
        const layer = {
            id: this.props.redlining.layer,
            title: this.props.redlining.layerTitle,
            role: LayerRole.USERLAYER
        };
        const featureId = `label::${cur.map}::${cur.layer}::${cur.feature.id}`;
        const profile = cur.profiles.find(entry => entry.name === this.state.currentProfile);
        const expression = profile.expression;
        if (!expression) {
            this.props.removeLayerFeatures(layer, [featureId]);
            return;
        }
        const fakeEditConfig = {layerName: this.state.cur.layer};
        let text = parseExpression(expression, this.state.cur.feature, fakeEditConfig, null, this.state.cur.map, this.props.projection, this.updateLabelFeature);
        if (text === null) {
            text = expression;
        } else {
            text = String(text);
        }
        const center = cur.mapPos;
        let feature = (this.props.layers.find(l => l.id === this.props.redlining.layer)?.features || []).find(f => f.id === featureId);
        if (feature) {
            feature = {
                ...feature,
                properties: {label: text},
                styleOptions: {
                    ...feature.styleOptions,
                    strokeWidth: (profile.size ?? null) !== null ? 1 + 0.5 * (profile.size) : feature.styleOptions.strokeWidth
                }};
        } else {
            feature = {
                id: featureId,
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: center
                },
                properties: {
                    label: text
                },
                shape: "Text",
                styleName: "textlabel",
                styleOptions: {
                    strokeWidth: 1 + 0.5 * (profile.size ?? 1),
                    fillColor: [255, 255, 255, 1],
                    textFillColor: [0, 0, 0, 1],
                    strokeColor: [0, 0, 0, 1],
                    strokeDash: [],
                    anchor: center
                }
            };
        }
        this.props.addLayerFeatures(layer, [feature]);
    };
}

export default {
    cfg: {
        key: "FeatureLabel",
        tooltip: LocaleUtils.trmsg("redlining.featurelabel"),
        tooltype: "draw",
        icon: "label",
        data: {action: "FeatureLabel", geomType: null}
    },
    controls: connect((state) => ({
        projection: state.map.projection,
        layers: state.layers.flat,
        redlining: state.redlining
    }), {
        addLayerFeatures: addLayerFeatures,
        removeLayer: removeLayer,
        removeLayerFeatures: removeLayerFeatures,
        addLayer: addLayer
    })(RedliningFeatureLabelSupport)
};
