import React from 'react';
import ReactDOM from 'react-dom';

import PropTypes from 'prop-types';

export default class PopupMenu extends React.Component {
    static propTypes = {
        children: PropTypes.array,
        className: PropTypes.string,
        onClose: PropTypes.func,
        width: PropTypes.number,
        x: PropTypes.number,
        y: PropTypes.number
    };
    constructor(props) {
        super(props);
        this.container = document.createElement("div");
        this.container.id = 'popup-container';
        this.container.style.position = 'fixed';
        this.container.style.left = 0;
        this.container.style.right = 0;
        this.container.style.top = 0;
        this.container.style.bottom = 0;
        this.container.style.zIndex = 100000;
        this.container.addEventListener('click', this.props.onClose);
        document.body.appendChild(this.container);
    }
    componentWillUnmount() {
        document.body.removeChild(this.container);
    }
    render() {
        const style = {
            position: 'absolute',
            left: this.props.x + 'px',
            top: this.props.y + 'px',
            minWidth: this.props.width + 'px',
            maxHeight: (window.innerHeight - this.props.y) + 'px',
            overflowY: 'auto'
        };
        return ReactDOM.createPortal((
            <div className={this.props.className} style={style}>
                {this.props.children}
            </div>
        ), this.container);
    }
}
