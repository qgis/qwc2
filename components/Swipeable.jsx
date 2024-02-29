import React from 'react';
import {useSwipeable} from 'react-swipeable';

import PropTypes from 'prop-types';


export const Swipeable = ({children, ...props}) => {
    const handlers = useSwipeable(props);
    return (<div { ...handlers }>{children}</div>);
};

Swipeable.propTypes = {
    children: PropTypes.oneOfType([PropTypes.node, PropTypes.func])
};
