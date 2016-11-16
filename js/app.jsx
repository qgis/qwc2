/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
const React = require('react');
const ReactDOM = require('react-dom');
const {connect} = require('react-redux');

const {initialState} = require('./appConfig');
const Localized = require('../QWC2/MapStore2/web/client/components/I18N/Localized');
const Main = require('./Main');

const StandardApp = require('../QWC2/MapStore2/web/client/components/app/StandardApp');
const StandardStore = require('../QWC2/MapStore2/web/client/stores/StandardStore').bind(null, initialState, {});

const appComponent = React.createClass({
    propTypes: {
        plugins: React.PropTypes.object,
        locale: React.PropTypes.object,
    },
    render() {
        return (
            <Localized messages={this.props.locale.messages} locale={this.props.locale.current} loadingError={this.props.locale.localeError}>
                <Main plugins={this.props.plugins}/>
            </Localized>
        );
    }
});

const appConfig = {
    storeOpts: {},
    appStore: StandardStore,
    pluginsDef: require('./plugins.js'),
    initialActions: [],
    appComponent: connect(state => ({
        locale: state.locale || {messages: {}, current: ''}
    }))(appComponent)
};

ReactDOM.render(
    <StandardApp {...appConfig}/>,
    document.getElementById('container')
);
