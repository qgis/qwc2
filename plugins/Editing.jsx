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
const axios = require('axios');
const clone = require('clone');
const CoordinatesUtils = require('../utils/CoordinatesUtils');
const LocaleUtils = require("../utils/LocaleUtils");
const MapUtils = require("../utils/MapUtils");
const Message = require('../components/I18N/Message');
const {changeEditingState} = require('../actions/editing');
const {setCurrentTaskBlocked} = require('../actions/task');
const {LayerRole, refreshLayer} = require('../actions/layers');
const {clickOnMap} = require("../actions/map");
const AutoEditForm = require('../components/AutoEditForm');
const QtDesignerForm = require('../components/QtDesignerForm');
const {SideBar} = require('../components/SideBar');
const ButtonBar = require('../components/widgets/ButtonBar');
const ConfigUtils = require('../utils/ConfigUtils');
const LayerUtils = require("../utils/LayerUtils");
require('./style/Editing.css');

class Editing extends React.Component {
    static propTypes = {
        enabled: PropTypes.bool,
        theme: PropTypes.object,
        layers: PropTypes.array,
        map: PropTypes.object,
        iface: PropTypes.object,
        editing: PropTypes.object,
        clickOnMap: PropTypes.func,
        changeEditingState: PropTypes.func,
        setCurrentTaskBlocked: PropTypes.func,
        refreshLayer: PropTypes.func,
        touchFriendly: PropTypes.bool,
        width: PropTypes.string
    }
    static contextTypes = {
        messages: PropTypes.object
    }
    static defaultProps = {
        touchFriendly: true,
        width: "25em"
    }
    state = {
        selectedLayer: null,
        relationTables: {},
        pickedFeatures: null,
        busy: false,
        deleteClicked: false
    }
    onShow = (mode) => {
        this.changeSelectedLayer(this.state.selectedLayer, "Pick");
    }
    onHide = () => {
        this.props.changeEditingState({action: null, geomType: null, feature: null})
    }
    componentWillReceiveProps(newProps) {
        let themeSublayers = newProps.layers.reduce((accum, layer) => {
            return layer.role === LayerRole.THEME ? accum.concat(LayerUtils.getSublayerNames(layer)) : accum;
        }, []);
        // Update selected layer on layers change
        if(newProps.layers !== this.props.layers) {
            let layerIds = Object.keys(newProps.theme && newProps.theme.editConfig || {}).filter(layerId => themeSublayers.includes(layerId));
            if(!isEmpty(layerIds)) {
                if(!layerIds.includes(this.state.selectedLayer)) {
                    this.changeSelectedLayer(layerIds[0]);
                }
            } else if(this.state.selectedLayer) {
                this.changeSelectedLayer(null);
            }
        }
        // If clickPoint changed and in pick mode with a selected layer, trigger a pick
        if(newProps.enabled && this.props.enabled && newProps.editing.action === 'Pick' && this.state.selectedLayer && !newProps.editing.changed) {
            const newPoint = newProps.map.clickPoint || {};
            const oldPoint = this.props.map.clickPoint || {};
            if(newPoint.coordinate && !isEqual(newPoint.coordinate, oldPoint.coordinate)) {
                let scale = Math.round(MapUtils.computeForZoom(this.props.map.scales, this.props.map.zoom));
                this.props.iface.getFeature(this.state.selectedLayer, newPoint.coordinate, this.props.map.projection, scale, 96, (featureCollection) => {
                    let features = featureCollection ? featureCollection.features : null;
                    this.setState({pickedFeatures: features});
                    let feature = features ? features[0] : null;
                    this.props.changeEditingState(assign({}, this.props.editing, {feature: feature, changed: false}));

                    // Query relation values for picked feature
                    if(feature) {
                        let relTables = Object.entries(this.state.relationTables).map(([name,fk]) => name + ":" + fk).join(",");
                        this.props.iface.getRelations(this.state.selectedLayer, feature.id, relTables, (response => {
                            let newFeature = assign({}, this.props.editing.feature, {relationValues: response.relationvalues});
                            this.props.changeEditingState(assign({}, this.props.editing, {feature: newFeature}));
                        }));
                    }
                });
            }
        }
        if(this.props.editing.changed !== newProps.editing.changed) {
            this.props.setCurrentTaskBlocked(newProps.editing.changed === true);
        }
        if(!newProps.editing.feature || newProps.editing.changed) {
            this.setState({deleteClicked: false});
        }
        if(!newProps.editing.feature) {
            this.setState({pickedFeatures: null});
        }
        // Always clear clicked pos if enabled
        if(newProps.map.clickPoint && newProps.enabled) {
            this.props.clickOnMap(null);
        }
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

        const actionButtons = [
            {key: 'Pick', icon: 'pick', label: "editing.pick", data: {action: 'Pick'}},
            {key: 'Draw', icon: 'editdraw', label: "editing.draw", data: {action: 'Draw', feature: null}}
        ];

        let commitBar = null;
        if(this.props.editing.changed) {
            const commitButtons = [
                {key: 'Commit', icon: 'ok', label: "editing.commit", extraClasses: "edit-commit", type: "submit"},
                {key: 'Discard', icon: 'remove', label: "editing.discard", extraClasses: "edit-discard"}
            ];
            commitBar = (<ButtonBar buttons={commitButtons} onClick={this.onDiscard}/>); /* submit is handled via onSubmit in the form */
        }
        let featureSelection = null;
        if(this.state.pickedFeatures){
            let featureText = LocaleUtils.getMessageById(this.context.messages, "editing.feature");
            featureSelection = (
                <div className="editing-feature-selection">
                    <select className="editing-feature-select" value={(this.props.editing.feature || {}).id || ""} onChange={(ev) => this.setEditFeature(ev.target.value)}  disabled={this.props.editing.changed === true}>
                        {this.state.pickedFeatures.map(feature => (
                            <option key={feature.id} value={feature.id}>{editConfig.displayField ? feature.properties[editConfig.displayField] : featureText + " " + feature.id}</option>
                        ))}
                    </select>
                </div>
            );
        }
        let fieldsTable = null;
        if(this.props.editing.feature) {
            fieldsTable = (
                <div className="editing-edit-frame">
                    <form action="" onSubmit={this.onSubmit}>
                        {curConfig.form ? (
                            <QtDesignerForm values={this.props.editing.feature.properties} updateField={this.updateField} form={curConfig.form}
                                addRelationRecord={this.addRelationRecord} removeRelationRecord={this.removeRelationRecord}
                                updateRelationField={this.updateRelationField} relationValues={this.props.editing.feature.relationValues} />
                        ) : (
                            <AutoEditForm fields={curConfig.fields} values={this.props.editing.feature.properties}
                                touchFriendly={this.props.touchFriendly} updateField={this.updateField} />
                        )}
                        {commitBar}
                    </form>
                </div>
            );
        }
        let deleteBar = null;
        if(this.props.editing.action === 'Pick' && this.props.editing.feature && !this.props.editing.changed) {
            if(!this.state.deleteClicked) {
                const deleteButtons = [
                    {key: 'Delete', icon: 'trash', label: "editing.delete"}
                ];
                deleteBar = (<ButtonBar buttons={deleteButtons} onClick={this.deleteClicked} />);
            } else {
                const deleteButtons = [
                    {key: 'Yes', icon: 'ok', label: "editing.reallydelete", extraClasses: "edit-commit"},
                    {key: 'No', icon: 'remove', label: "editing.canceldelete", extraClasses: "edit-discard"}
                ];
                deleteBar = (<ButtonBar buttons={deleteButtons} onClick={this.deleteFeature} />);
            }
        }
        let busyDiv = null;
        if(this.state.busy) {
            busyDiv = (<div className="editing-busy"></div>);
        }
        let themeSublayers = this.props.layers.reduce((accum, layer) => {
            return layer.role === LayerRole.THEME ? accum.concat(LayerUtils.getSublayerNames(layer)) : accum;
        }, []);
        return (
            <div className="editing-body">
                <div className="editing-layer-selection">
                    <select className="editing-layer-select" value={this.state.selectedLayer || ""} onChange={ev => this.changeSelectedLayer(ev.target.value)} disabled={this.props.editing.changed === true}>
                        {Object.keys(editConfig).filter(layerId => themeSublayers.includes(layerId)).map(layerId => {
                            return (
                                <option key={layerId} value={layerId}>{editConfig[layerId].layerName}</option>
                            );
                        })}
                    </select>
                </div>
                <ButtonBar buttons={actionButtons} active={this.props.editing.action} disabled={this.props.editing.changed} onClick={(action, data) => this.props.changeEditingState({...data})} />
                {featureSelection}
                {fieldsTable}
                {deleteBar}
                {busyDiv}
            </div>

        );
    }
    render() {
        return (
            <SideBar id="Editing" width={this.props.width} onShow={this.onShow} onHide={this.onHide}
                title="appmenu.items.Editing" icon="editing">
                {() => ({
                    body: this.renderBody()
                })}
            </SideBar>
        );
    }
    changeSelectedLayer = (selectedLayer, action=null) => {
        const curConfig = this.props.theme && this.props.theme.editConfig && selectedLayer ? this.props.theme.editConfig[selectedLayer] : null;
        this.props.changeEditingState(assign({}, this.props.editing, {action: action || this.props.editing.action, feature: null, geomType: curConfig ? curConfig.geomType : null}));

        // Gather relation tables for selected layer if config is a designer form
        this.setState({selectedLayer: selectedLayer, relationTables: {}});
        if(curConfig && curConfig.form) {
            let url = curConfig.form;
            if(url && url.startsWith(":/")) {
                let assetsPath = ConfigUtils.getConfigProp("assetsPath");
                url = assetsPath + curConfig.form.substr(1);
            }
            axios.get(url).then(response => {
                let relationTables = {};
                let domParser = new DOMParser();
                let doc = domParser.parseFromString(response.data, 'text/xml');
                for(let widget of doc.getElementsByTagName("widget")) {
                    let name = widget.attributes.name;
                    if(name) {
                        let parts = widget.attributes.name.value.split("__");
                        if(parts.length === 3 && parts[0] === "nrel") {
                            relationTables[parts[1]] = parts[2];
                        }
                    }
                }
                this.setState({relationTables: relationTables});
            }).catch(e => {
                console.log(e);
            });
        }
    }
    updateField = (key, value) => {
        let newProperties = assign({}, this.props.editing.feature.properties, {[key]: value});
        let newFeature = assign({}, this.props.editing.feature, {properties: newProperties});
        this.props.changeEditingState(assign({}, this.props.editing, {feature: newFeature, changed: true}));
    }
    addRelationRecord = (table) => {
        let newRelationValues = assign({}, this.props.editing.feature.relationValues || {});
        if(!newRelationValues[table]) {
            newRelationValues[table] = {
                "fk": this.state.relationTables[table],
                "records": []
            };
        }
        newRelationValues[table].records = newRelationValues[table].records.concat([{
            "__status__": "new"
        }]);
        let newFeature = assign({}, this.props.editing.feature, {relationValues: newRelationValues});
        this.props.changeEditingState(assign({}, this.props.editing, {feature: newFeature, changed: true}));
    }
    removeRelationRecord = (table, idx) => {
        let newRelationValues = assign({}, this.props.editing.feature.relationValues);
        newRelationValues[table] = assign({}, newRelationValues[table]);
        newRelationValues[table].records = newRelationValues[table].records.slice(0);
        let fieldStatus = newRelationValues[table].records[idx]["__status__"] || "";
        // If field was new, delete it directly, else mark it as deleted
        if(fieldStatus === "new") {
            newRelationValues[table].records.splice(idx, 1);
        } else {
            newRelationValues[table].records[idx] = assign({}, newRelationValues[table].records[idx], {
                "__status__": fieldStatus.startsWith("deleted") ? fieldStatus.substr(8) : "deleted:" + fieldStatus
            });
        }
        let newFeature = assign({}, this.props.editing.feature, {relationValues: newRelationValues});
        this.props.changeEditingState(assign({}, this.props.editing, {feature: newFeature, changed: true}));
    }
    updateRelationField = (table, idx, key, value) => {
        let newRelationValues = assign({}, this.props.editing.feature.relationValues);
        newRelationValues[table] = assign({}, newRelationValues[table]);
        newRelationValues[table].records = newRelationValues[table].records.slice(0);
        newRelationValues[table].records[idx] = assign({}, newRelationValues[table].records[idx], {
            [key]: value,
            "__status__": newRelationValues[table].records[idx]["__status__"] === "new" ? "new" : "changed"
        });
        let newFeature = assign({}, this.props.editing.feature, {relationValues: newRelationValues});
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
        // Ensure properties is not null
        feature = assign({}, feature, {properties: feature.properties || {}});

        // Keep relation values separate
        let relationValues = clone(feature.relationValues || {});
        delete feature.relationValues;

        // Collect all values from form fields
        let fieldnames = Array.from(ev.target.elements).map(element => element.name).filter(x => x);
        fieldnames.forEach(name => {
            let element = ev.target.elements.namedItem(name);
            if(element) {
                let value = element.type === "radio" || element.type === "checkbox" ? element.checked : element.value;
                if (element.type === "date" && element.value === "") {
                    // Set empty date value to null instead of empty string
                    value = null;
                }
                let parts = name.split("__");
                if(parts.length === 3) {
                    let table = parts[0];
                    let field = parts[1];
                    let index = parseInt(parts[2]);
                    // relationValues for table must exist as rows are either pre-existing or were added
                    if(relationValues[parts[0]].records[index][field] === undefined) {
                        relationValues[parts[0]].records[index][field] = value;
                    }
                } else {
                    if(feature.properties[name] === undefined) {
                        feature.properties[name] = value;
                    }
                }
            }
        });

        if(this.props.editing.action === "Draw") {
            this.props.iface.addFeature(this.state.selectedLayer, feature, this.props.map.projection, (success, result) => this.featureCommited(success, result, relationValues));
        } else if(this.props.editing.action === "Pick") {
            this.props.iface.editFeature(this.state.selectedLayer, feature, this.props.map.projection, (success, result) => this.featureCommited(success, result, relationValues));
        }
    }
    featureCommited = (success, result, relationValues) => {
        if(!success) {
            this.commitFinished(success, result);
            return;
        }
        let newFeature = result;
        // Commit relations
        if(!isEmpty(relationValues)) {
            this.props.iface.writeRelations(this.state.selectedLayer, newFeature.id, relationValues, (result) => {
                if(result.success !== true) {
                    // Relation values commit failed, switch to pick update relation values with response and switch to pick to
                    // to avoid adding feature again on next attempt
                    this.commitFinished(false, "Some relation records could not be committed");
                    newFeature = assign({}, newFeature, {relationValues: result.relationvalues});
                    this.props.changeEditingState(assign({}, this.props.editing, {action: "Pick", feature: newFeature, changed: true}));
                } else {
                    this.commitFinished(true);
                }
            });
        } else {
            this.commitFinished(success, result);
        }
    }
    setEditFeature = (featureId) => {
        let feature = this.state.pickedFeatures.find(feature => feature.id == featureId);
        this.props.changeEditingState(assign({}, this.props.editing, {feature: feature, changed: false}));
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
    commitFinished = (success, errorMsg) => {
        this.setState({busy: false});
        if(success) {
            this.props.changeEditingState(assign({}, this.props.editing, {feature: null}));
            this.props.refreshLayer(layer => layer.role === LayerRole.THEME);
        } else {
            alert(errorMsg);
        }
    }
    deleteFinished = (success, errorMsg) => {
        this.setState({busy: false});
        if(success) {
            this.setState({deleteClicked: false});
            this.props.setCurrentTaskBlocked(false);
            this.props.changeEditingState(assign({}, this.props.editing, {feature: null}));
            this.props.refreshLayer(layer => layer.role === LayerRole.THEME);
        } else {
            alert(errorMsg);
        }
    }
};

module.exports = (iface) => {return {
    EditingPlugin: connect(state => ({
        enabled: state.task ? state.task.id === 'Editing': false,
        theme: state.theme ? state.theme.current : null,
        layers: state.layers ? state.layers.flat : [],
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
