/**
 * Copyright 2017, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const isEmpty = require('lodash.isempty');
const isEqual = require('lodash.isequal');
const assign = require('object-assign');
const ConfigUtils = require("../../MapStore2Components/utils/ConfigUtils");
const CoordinatesUtils = require('../../MapStore2Components/utils/CoordinatesUtils');
const Message = require('../../MapStore2Components/components/I18N/Message');
const {changeEditingState} = require('../actions/editing');
const {setCurrentTaskBlocked} = require('../actions/task');
const {refreshLayer} = require('../actions/layers')
const {clickOnMap} = require("../actions/map");
const {SideBar} = require('../components/SideBar');
const ButtonBar = require('../components/widgets/ButtonBar');
const ToggleSwitch = require('../components/widgets/ToggleSwitch');
require('./style/Editing.css');

class Editing extends React.Component {
    static propTypes = {
        enabled: PropTypes.bool,
        theme: PropTypes.object,
        themeLayerId: PropTypes.string,
        map: PropTypes.object,
        iface: PropTypes.object,
        editing: PropTypes.object,
        clickOnMap: PropTypes.func,
        changeEditingState: PropTypes.func,
        setCurrentTaskBlocked: PropTypes.func,
        refreshLayer: PropTypes.func
    }
    state = {
        selectedLayer: null,
        selectedFeature: null,
        busy: false,
        deleteClicked: false
    }
    onShow = (mode) => {
        let editLayers = Object.keys(this.props.theme.editConfig || {});
        this.changeSelectedLayer(editLayers[0], "Pick");
    }
    onHide = () => {
        this.props.changeEditingState({action: null, geomType: null, feature: null})
    }
    componentWillReceiveProps(newProps) {
        if(newProps.theme) {
            let layerIds = Object.keys(newProps.theme.editConfig || {});
            if(!isEmpty(layerIds)) {
                if(!layerIds.includes(this.state.selectedLayer)) {
                    this.setState({selectedLayer: layerIds[0]})
                }
            } else {
                this.setState({selectedLayer: null})
            }
        }
        // If clickPoint changed and in pick mode with a selected layer, trigger a pick
        if(newProps.enabled && this.props.enabled && newProps.editing.action === 'Pick' && this.state.selectedLayer) {
            const newPoint = newProps.map.clickPoint || {};
            const oldPoint = this.props.map.clickPoint || {};
            if(newPoint.coordinate && !isEqual(newPoint.coordinate, oldPoint.coordinate)) {
                let point = {x: newPoint.coordinate[0], y: newPoint.coordinate[1]};
                let scale = this.props.map.scales[this.props.map.zoom];
                this.props.iface.getFeature(this.state.selectedLayer, point, this.props.map.projection, scale, 96, (feature) => {
                    this.props.changeEditingState(assign({}, this.props.editing, {feature: feature, changed: false}));
                });
            }
        }
        if(this.props.editing.changed !== newProps.editing.changed) {
            this.props.setCurrentTaskBlocked(newProps.editing.changed === true);
        }
        if(!newProps.editing.feature || newProps.editing.changed) {
            this.setState({deleteClicked: false});
        }
        // Always clear clicked pos if enabled
        if(newProps.map.clickPoint && newProps.enabled) {
            this.props.clickOnMap(null);
        }
    }
    renderField = (field) => {
        let constraints = field.constraints || {};
        let disabled = this.props.editing.feature ? "" : "disabled";
        let value = "";
        if(this.props.editing.feature && this.props.editing.feature.properties) {
            value = this.props.editing.feature.properties[field.id] || "";
        }
        let input = null;
        if(field.type == "boolean" || field.type == "bool") {
            input = (
                <ToggleSwitch active={value} onChange={active => this.updateField(field.id, active)} />
            );
        }
        else if(constraints.values) {
            input = (
                <span className="input-frame">
                    <select value={value} onChange={ev => this.updateField(field.id, ev.target.value)}>
                        {constraints.values.map((item,index) => { return (
                            <option key={field.id + index} value={item}>{item}</option>
                        );})}
                    </select>
                </span>
            );
        } else {
            input = (
                <span className="input-frame">
                    <input type={field.type} {...constraints} disabled={disabled}
                        onChange={(ev) => this.updateField(field.id, ev.target.value)}
                        value={value}/>
                </span>
            );
        }
        return (
            <tr key={field.id}>
                <td>{field.name}:</td>
                <td>{input}</td>
            </tr>
        );
    }
    renderBody = () => {
        if(!this.props.theme || isEmpty(this.props.theme.editConfig)) {
            return (
                <div role="body" style={{padding: "1em"}}>
                    <Message msgId="editing.noeditablelayers" />
                </div>
            );
        }
        const editConfig = this.props.theme.editConfig;
        const curConfig = editConfig[this.state.selectedLayer];
        if(!curConfig) {
            return (
                <div role="body" style={{padding: "1em"}}>
                    <Message msgId="editing.noeditablelayers" />
                </div>
            );
        }

        let assetsPath = ConfigUtils.getConfigProp("assetsPath");
        let actionBar = null;
        const actionButtons = [
            {key: 'Pick', icon: 'pick.svg', label: "editing.pick", data: {action: 'Pick'}},
            {key: 'Draw', icon: 'editdraw.svg', label: "editing.draw", data: {action: 'Draw', feature: null}}
        ];
        actionBar = (<ButtonBar buttons={actionButtons} active={this.props.editing.action} disabled={this.props.editing.changed} onClick={(action, data) => this.props.changeEditingState({...data})} />);

        let commitBar = null;
        if(this.props.editing.changed) {
            const commitButtons = [
                {key: 'Commit', glyph: 'ok', label: "editing.commit", extraClasses: "edit-commit", type: "submit"},
                {key: 'Discard', glyph: 'remove', label: "editing.discard", extraClasses: "edit-discard"}
            ];
            commitBar = (<ButtonBar buttons={commitButtons} onClick={this.onDiscard}/>); /* submit is handled via onSubmit in the form */
        }
        let fieldsTable = null;
        if(this.props.editing.feature) {
            fieldsTable = (
                <div>
                    <div className="separator"></div>
                    <form action="" onSubmit={this.onSubmit}>
                        <table className="fields-table">
                            <tbody>
                                {(curConfig.fields || []).map(field => this.renderField(field))}
                            </tbody>
                        </table>
                        {commitBar}
                    </form>
                </div>
            );
        }
        let deleteBar = null;
        if(this.props.editing.action === 'Pick' && this.props.editing.feature && !this.props.editing.changed) {
            if(!this.state.deleteClicked) {
                const deleteButtons = [
                    {key: 'Delete', glyph: 'trash', label: "editing.delete"}
                ];
                deleteBar = (<ButtonBar buttons={deleteButtons} onClick={this.deleteClicked} />);
            } else {
                const deleteButtons = [
                    {key: 'Yes', glyph: 'ok', label: "editing.reallydelete", extraClasses: "edit-commit"},
                    {key: 'No', glyph: 'remove', label: "editing.canceldelete", extraClasses: "edit-discard"}
                ];
                deleteBar = (<ButtonBar buttons={deleteButtons} onClick={this.deleteFeature} />);
            }
        }
        let busyDiv = null;
        if(this.state.busy) {
            busyDiv = (<div className="editing-busy"></div>);
        }
        return (
            <div role="body" className="editing-body">
                <div>
                    <span className="input-frame">
                        <select className="editing-layer-select" value={this.state.selectedLayer || ""} onChange={ev => this.changeSelectedLayer(ev.target.value)} disabled={this.props.editing.changed === true}>
                            {Object.keys(editConfig).map(layerId => {
                                return (
                                    <option key={layerId} value={layerId}>{editConfig[layerId].layerName}</option>
                                );
                            })}
                        </select>
                    </span>
                </div>
                {actionBar}
                {fieldsTable}
                {deleteBar}
                {busyDiv}
            </div>

        );
    }
    render() {
        let assetsPath = ConfigUtils.getConfigProp("assetsPath");
        return (
            <SideBar id="Editing" width="20em" onShow={this.onShow} onHide={this.onHide}
                title="appmenu.items.Editing" icon={assetsPath + "/img/editing.svg"}>
                {this.renderBody()}
            </SideBar>
        );
    }
    changeSelectedLayer = (selectedLayer, action=null) => {
        this.setState({selectedLayer: selectedLayer});
        const curConfig = this.props.theme.editConfig[selectedLayer];
        let geomType = null;
        if(curConfig) {
            geomType = curConfig.geomType.startsWith("Multi") ? curConfig.geomType.substring(5) : curConfig.geomType;
        }
        this.props.changeEditingState(assign({}, this.props.editing, {action: action || this.props.editing.action, feature: null, geomType: geomType}));
    }
    updateField = (key, value) => {
        let newProperties = assign({}, this.props.editing.feature.properties, {[key]: value});
        let newFeature = assign({}, this.props.editing.feature, {properties: newProperties});
        this.props.changeEditingState(assign({}, this.props.editing, {feature: newFeature, changed: true}));
    }
    onDiscard = (action) => {
        if(action === "Discard") {
            this.props.changeEditingState(assign({}, this.props.editing, {feature: null}));
        }
    }
    onSubmit = (ev) => {
        ev.preventDefault();
        this.setState({busy: true});

        let feature = this.props.editing.feature;
        // Convert geometry to multitype if necessary
        if(this.props.editing.geomType.startsWith("Multi") && !feature.geometry.type.startsWith("Multi")) {
            feature = assign({}, feature, {geometry: {
                type: "Multi" + feature.geometry.type,
                coordinates: [feature.geometry.coordinates]
            }});
        }
        // Ensure properties is not null
        feature = assign({}, feature, {properties: feature.properties || {}});

        if(this.props.editing.action === "Draw") {
            this.props.iface.addFeature(this.state.selectedLayer, feature, this.props.map.projection, this.commitFinished);
        } else if(this.props.editing.action === "Pick") {
            this.props.iface.editFeature(this.state.selectedLayer, feature, this.props.map.projection, this.commitFinished);
        }
    }
    deleteClicked = () => {
        this.setState({deleteClicked: true});
        this.props.setCurrentTaskBlocked(true);
    }
    deleteFeature = (action) => {
        if(action == 'Yes') {
            this.setState({busy: true});
            this.props.iface.deleteFeature(this.state.selectedLayer, this.props.editing.feature.id, this.deleteFinished);
        } else {
            this.setState({deleteClicked: false});
            this.props.setCurrentTaskBlocked(false);
        }
    }
    commitFinished = (success) => {
        this.setState({busy: false});
        if(success) {
            this.props.changeEditingState(assign({}, this.props.editing, {feature: null}));
            this.props.refreshLayer(this.props.themeLayerId);
        } else {
            alert('Commit failed');
        }
    }
    deleteFinished = (success) => {
        this.setState({busy: false});
        if(success) {
            this.setState({deleteClicked: false});
            this.props.setCurrentTaskBlocked(false);
            this.props.changeEditingState(assign({}, this.props.editing, {feature: null}));
            this.props.refreshLayer(this.props.themeLayerId);
        } else {
            alert('Delete failed');
        }
    }
};

module.exports = (iface) => {return {
    EditingPlugin: connect(state => ({
        enabled: state.task ? state.task.id === 'Editing': false,
        theme: state.theme ? state.theme.current : null,
        themeLayerId: state.theme ? state.theme.currentlayer : '',
        map: state.map || {},
        iface: iface,
        editing: state.editing || {},
    }), {
        clickOnMap: clickOnMap,
        changeEditingState: changeEditingState,
        setCurrentTaskBlocked: setCurrentTaskBlocked,
        refreshLayer: refreshLayer
    })(Editing),
    reducers: {
        editing: require('../reducers/editing')
    }
}};
