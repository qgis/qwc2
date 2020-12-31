/**
* Copyright 2016, GeoSolutions Sas.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/

import {connect} from 'react-redux';
import {changeLocateState, onLocateError} from '../../actions/locate';
import olLocale from '../../components/map/openlayers/Locate';

export default connect((state) => ({
    status: state.locate && state.locate.state,
    messages: state.locale && state.locale.messages ? state.locale.messages.locate : undefined,
    startupParams: state.localConfig.startupParams
}), {
    changeLocateState,
    onLocateError
})(olLocale);
