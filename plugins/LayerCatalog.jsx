/**
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {connect} from 'react-redux';
import PropTypes from 'prop-types';
import isEmpty from 'lodash.isempty';
import axios from 'axios';
import {setCurrentTask} from '../actions/task';
import LayerCatalogWidget from '../components/widgets/LayerCatalogWidget';
import ResizeableWindow from '../components/ResizeableWindow';
import LocaleUtils from '../utils/LocaleUtils';
import './style/LayerCatalog.css';

class LayerCatalog extends React.Component {
    static propTypes = {
        active: PropTypes.bool,
        catalogUrl: PropTypes.string,
        setCurrentTask: PropTypes.func,
        windowSize: PropTypes.object
    }
    static defaultProps = {
        windowSize: {width: 320, height: 320}
    }
    state = {
        catalog: []
    }
    componentDidUpdate(prevProps) {
        if (this.props.active && !prevProps.active && this.props.catalogUrl) {
            axios.get(this.props.catalogUrl).then(this.setCatalog).catch(e => {
                console.warn("Failed to load catalog: " + e);
            });
        }
    }
    setCatalog = (response) => {
        this.setState({
            catalog: response.data.catalog
        });
        this.props.setCurrentTask("LayerTree");
    }
    render() {
        if (isEmpty(this.state.catalog)) {
            return null;
        }
        return (
            <ResizeableWindow icon="catalog" initialHeight={this.props.windowSize.height} initialWidth={this.props.windowSize.width}
                onClose={this.onClose} title={LocaleUtils.trmsg("layercatalog.windowtitle")} >
                <div className="layer-catalog" role="body">
                    <LayerCatalogWidget catalog={this.state.catalog} />
                </div>
            </ResizeableWindow>
        );
    }
    onClose = () => {
        this.setState({catalog: []});
    }
}

export default connect(state => ({
    active: state.task.id === "LayerCatalog"
}), {
    setCurrentTask: setCurrentTask
})(LayerCatalog);
