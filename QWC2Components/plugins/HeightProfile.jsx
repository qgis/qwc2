/**
 * Copyright 2017, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const axios = require('axios');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const isEmpty = require('lodash.isempty');
const ChartistGraph = require('react-chartist').default;
const ConfigUtils = require('../../MapStore2Components/utils/ConfigUtils');

require('./style/HeightProfile.css');

class HeightProfile extends React.Component {
    static propTypes = {
        measurement: PropTypes.object,
        projection: PropTypes.string,
        samples: PropTypes.number
    }
    static defaultProps = {
        samples: 500
    }
    constructor(props) {
        super(props);
    }
    state = {
        width: window.innerWidth,
        data: []
    }
    componentDidMount() {
        window.addEventListener('resize', this.handleResize);
    }
    componentWillUnmount() {
        window.removeEventListener('resize', this.handleResize);
    }
    handleResize = (ev) => {
        this.setState({width: window.innerWidth});
    }
    componentWillReceiveProps(newProps) {
        if(newProps.measurement.coordinates !== this.props.measurement.coordinates) {
            if(newProps.measurement.drawing === false && newProps.measurement.geomType === "LineString" && !isEmpty(newProps.measurement.coordinates) ) {
                this.queryElevations(newProps.measurement.coordinates, newProps.measurement.length, newProps.projection);
            } else {
                this.setState({data: []});
            }
        }
    }
    queryElevations(coordinates, distances, projection) {
        let serviceUrl = ConfigUtils.getConfigProp("elevationServiceUrl");
        if(serviceUrl) {
            axios.post(serviceUrl, {coordinates, distances, projection, samples: this.props.samples}).then(response => {
                this.setState({data: response.data.elevations});
            }).catch(e => {
                console.log("Query failed: " + e);
            });
        }
    }
    render() {
        if(isEmpty(this.state.data)) {
            return null;
        }
        let totLength = (this.props.measurement.length || []).reduce((tot, num) => tot + num, 0);

        let data = {
            labels: new Array(this.props.samples).fill(0), // Just a dummy array of the right length, value is computed in labelInterpolationFnc
            series:  [this.state.data]
        };
        let options = {
            width: this.state.width,
            height: 100,
            low: 0,
            chartPadding: 0,
            showArea: true,
            axisX: {
                // Only draw approx 10 labels
                labelInterpolationFnc: (value, index) => {
                    return index % (this.props.samples / 10) == 0 ? Math.round((totLength * index) / this.props.samples) : null;
                }
            }
        };
        return (
            <div id="HeightProfile">
                <ChartistGraph type="Line" data={data} options={options} />
            </div>
        )
    }
};

module.exports = {
    HeightProfilePlugin: connect((state) => ({
        measurement: state.measurement,
        projection: state.map.projection
    }), {

    })(HeightProfile)
};
