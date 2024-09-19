import React from 'react';
import {Provider} from "react-redux";

import {act, fireEvent, render, screen} from '@testing-library/react';
import configureStore from 'redux-mock-store';

import SearchBox from '../../components/SearchBox';

const mockStore = configureStore();

const searchProviders = {
    testing: {
        onSearch: (text, searchParams, callback) => callback({
            results: [
                {
                    id: 'layer1',
                    title: 'Layer 1',
                    items: [
                        {
                            id: 'item1',
                            text: 'Item 1'
                        },
                        {
                            id: 'item2',
                            text: 'Item 2'
                        }
                    ]
                },
                {
                    id: 'layer2',
                    title: 'Layer 2',
                    items: [
                        {
                            id: 'item3',
                            text: 'Item 3'
                        }
                    ]
                }
            ]
        })
    }
};

// eslint-disable-next-line
const Search = SearchBox(searchProviders);

test('search results are visible', () => {
    const store = mockStore({
        map: { projection: 'EPSG:4326' },
        layers: { flat: [] },
        theme: { current: { searchProviders: ['testing'] } }
    });

    const searchOptions = {
        allowSearchFilters: false
    };

    render(
        <Provider store={store}>
            <Search searchOptions={searchOptions} />
        </Provider>
    );

    const input = screen.getByRole('input');
    expect(input).toHaveValue('');

    fireEvent.change(input, { target: { value: 'Test' } });
    act(() => input.focus());

    expect(input).toHaveValue('Test');
    expect(screen.getByText('Layer 1')).toBeInTheDocument();
    expect(screen.getByText('Layer 2')).toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('Item 3')).toBeInTheDocument();
});
