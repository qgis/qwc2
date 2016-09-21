/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {TEXT_SEARCH_RESULTS_LOADED} = require("../../MapStore2/web/client/actions/search");

 function searchResultLoaded(results) {
   console.log(results);
     return {
         type: TEXT_SEARCH_RESULTS_LOADED,
         results: results
     };
 }

function qwc2TextSearch(text) {
    return (dispatch) => {
      /*dispatch(searchResultLoaded({data: [
        {
          boundingbox: [288838,4642322,288839,4642323],
          display_name: "Greifensee (Niederuster, Gewässer stehendes)",
          searchtable: "av_user.suchtabelle"
        },{
          boundingbox: [288838,4642322,288839,4642323],
          display_name: "Greifensee (Flurname, Uster)",
          searchtable: "av_user.suchtabelle"
        }
      ]}));*/
      fetch('http://localhost:5000/search?query=' + text)
      .then((response) => { return response.json() })
      .then((obj) => { dispatch(searchResultLoaded(obj.results)); });
    };
}

module.exports = {qwc2TextSearch}
