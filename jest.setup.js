// import jest from 'jest';
// export default async function (globalConfig, projectConfig) {
//     console.log(")))))))0------------------(((((((((((((");
//     console.log(globalConfig.testPathPattern);
//     console.log(projectConfig.cache);


// };

jest.mock('./libs/openlayers.js', () => {
    
});
jest.mock('ol', () => {

});
jest.mock('ol-ext', () => {

});
jest.mock('openlayers', () => {

});

// class Worker {
//     constructor(stringUrl) {
//         this.url = stringUrl;
//         this.onmessage = () => { };
//     }

//     postMessage(msg) {
//         this.onmessage(msg);
//     }
// }

// function noOp() { }
// if (typeof window.URL.createObjectURL === 'undefined') {
//     Object.defineProperty(window.URL, 'createObjectURL', { value: noOp })
// }



// window.Worker = Worker;

// const ol = require('./node_modules/ol/dist/ol');
// window.ol = ol;
