const LOCAL_CONFIG_LOADED = 'LOCAL_CONFIG_LOADED';
const SET_STARTUP_PARAMETERS = 'SET_STARTUP_PARAMETERS';

function localConfigLoaded(config) {
    return {
        type: LOCAL_CONFIG_LOADED,
        config
    };
}

function setStartupParameters(params) {
    return {
        type: SET_STARTUP_PARAMETERS,
        params
    };
}

module.exports = {
    LOCAL_CONFIG_LOADED,
    SET_STARTUP_PARAMETERS,
    localConfigLoaded,
    setStartupParameters
};
