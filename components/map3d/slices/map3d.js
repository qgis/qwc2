import {createSlice} from '@reduxjs/toolkit';

const initialState = {
    center: null
};

const map3dSlice = createSlice({
    name: 'map',
    initialState,
    reducers: {
        setCenter(state, action) {
            state.center = action.payload;
        }
    }
});

export const {setCenter} = map3dSlice.actions;
export default map3dSlice.reducer;
