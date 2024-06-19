import React from 'react';
import {Provider} from "react-redux";

import {render} from '@testing-library/react';
import configureStore from 'redux-mock-store';

import StandardApp from "../../components/StandardApp";

const mockStore = configureStore();

test('app is running w/o plugins', () => {
    const store = mockStore({});

    const appConfig = {
        initialState: {
            defaultState: {}
        },
        pluginsDef: {
            plugins: {}
        }
    };

    render(
        <Provider store={store}>
            <StandardApp appConfig={appConfig} />
        </Provider>
    );
});
