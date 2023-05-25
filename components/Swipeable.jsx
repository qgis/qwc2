import React from 'react';
import {useSwipeable} from 'react-swipeable';

export const Swipeable = ({children, ...props}) => {
    const handlers = useSwipeable(props);
    return (<div { ...handlers }>{children}</div>);
};
