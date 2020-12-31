/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import url from 'url';
import {createStore, compose, applyMiddleware} from 'redux';
import thunkMiddleware from  'redux-thunk';
import logger from 'redux-logger';
import immutable from 'redux-immutable-state-invariant';
import {persistState} from 'redux-devtools';
import DevTools from '../components/development/DevTools';

const urlQuery = url.parse(window.location.href, true).query;

const DebugUtils = {
    createDebugStore(reducer, initialState, userMiddlewares, enhancer) {
        let finalCreateStore;
        if (__DEVTOOLS__ && urlQuery.debug) {
            const middlewares = (userMiddlewares || []).concat([immutable(), thunkMiddleware, logger]);
            finalCreateStore = compose(
                applyMiddleware.apply(null, middlewares),
                window.devToolsExtension ? window.devToolsExtension() : DevTools.instrument(),
                persistState(window.location.href.match(/[?&]debug_session=([^&]+)\b/))
            )(createStore);
        } else {
            const middlewares = (userMiddlewares || []).concat([thunkMiddleware]);
            finalCreateStore = applyMiddleware.apply(null, middlewares)(createStore);
        }
        return finalCreateStore(reducer, initialState, enhancer);
    }
};

export default DebugUtils;
