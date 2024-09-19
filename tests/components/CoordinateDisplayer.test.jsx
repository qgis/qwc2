import React from 'react';
import {Provider} from "react-redux";

import {render, screen} from '@testing-library/react';
import configureStore from 'redux-mock-store';

import CoordinateDisplayer from '../../components/CoordinateDisplayer';

const mockStore = configureStore();

test('current coordinates are shown', () => {
    const store = mockStore({
        map: { projection: 'EPSG:4326' },
        mousePosition: { position: { coordinate: [123, 456] } }
    });

    render(
        <Provider store={store}>
            <CoordinateDisplayer displaycrs={'EPSG:4326'} />
        </Provider>
    );

    expect(screen.getByRole('textbox')).toHaveValue('123.0000 456.0000');
});
