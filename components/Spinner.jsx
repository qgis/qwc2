/*
 * Copyright (c) 2017 Cheng Lou. All rights reserved.

 * This work is licensed under the terms of the MIT license.
 * For a copy, see <https://opensource.org/licenses/MIT>.
 */

import React from 'react';

import './style/Spinner.css';

export default class Spinner extends React.Component {
    render() {
        const bars = [];

        for (let i = 0; i < 12; ++i) {
            const barStyle = {};
            barStyle.WebkitAnimationDelay = barStyle.animationDelay = (i - 12) / 10 + 's';
            barStyle.WebkitTransform = barStyle.transform = 'rotate(' + (i * 30) + 'deg) translate(146%)';

            bars.push(
                <div key={i} style={barStyle} />
            );
        }

        return (
            <div className="spinner">
                {bars}
            </div>
        );
    }
}
