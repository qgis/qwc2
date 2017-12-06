/**
 * Copyright 2016, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
const React = require('react');
const PropTypes = require('prop-types');
const {Provider} = require('react-redux');

// Needed for IE11 to avoid 'Promise not defined' error in axios
require("babel-polyfill");
// Avoid Intl is not defined (Intl needed by react-intl further on)
if (!global.Intl) {
   require('intl')
}

const Localized = require('../../MapStore2Components/components/I18N/Localized');
const StandardStore = require('../../MapStore2Components/stores/StandardStore')
const PluginsContainer = require('./PluginsContainer');

const {changeBrowserProperties} = require('../../MapStore2Components/actions/browser');
const {loadLocale} = require('../../MapStore2Components/actions/locale');
const {localConfigLoaded} = require('../../MapStore2Components/actions/localConfig');
const {loadMapConfig} = require('../actions/config');

const ConfigUtils = require('../../MapStore2Components/utils/ConfigUtils');
const LocaleUtils = require('../../MapStore2Components/utils/LocaleUtils');
const PluginsUtils = require('../../MapStore2Components/utils/PluginsUtils');

const assign = require('object-assign');
const url = require('url');

const urlQuery = url.parse(window.location.href, true).query;

class StandardApp extends React.Component {
    static propTypes = {
        appConfig: PropTypes.object
    }
    static defaultProps = {
        appConfig: {}
    }
    constructor(props) {
        super(props);

        const onInit = () => {
            if (!global.Intl ) {
                require.ensure(['intl', 'intl/locale-data/jsonp/en.js', 'intl/locale-data/jsonp/it.js'], (require) => {
                    global.Intl = require('intl');
                    require('intl/locale-data/jsonp/en.js');
                    require('intl/locale-data/jsonp/it.js');
                    this.init();
                });
            } else {
                this.init();
            }
        };
        this.store = StandardStore(this.props.appConfig.initialState || {}, this.props.appConfig.pluginsDef.plugins, {onPersist: onInit});
        onInit();
    }
    render() {
        let plugins = assign(PluginsUtils.getPlugins(this.props.appConfig.pluginsDef.plugins));
        return (
            <Provider store={this.store}>
                <Localized>
                    <PluginsContainer plugins={plugins} />
                </Localized>
            </Provider>
        );
    }
    init = () => {
        this.store.dispatch(changeBrowserProperties(ConfigUtils.getBrowserProperties()));
        if (urlQuery.localConfig) {
            ConfigUtils.setLocalConfigurationFile(urlQuery.localConfig + '.json');
        }
        ConfigUtils.loadConfiguration().then((config) => {
            this.store.dispatch(localConfigLoaded(config));
            const locale = LocaleUtils.getUserLocale();
            this.store.dispatch(loadLocale(null, locale));
            this.store.dispatch(loadMapConfig());
        });
    }
}

module.exports = StandardApp;
