/** 
 * A callback used with the `Signal` class.
 * @callback Callback
 * @param {*} data - The data passed to the callback.
 * @returns {boolean} - If the callback returns `true`,
 *  it will be removed from the signal.
 */


/**
 * A simple event system that allows you to connect and disconnect callbacks
 * and notify them of events.
 * @constructor
 */
export default class Signal {
    constructor() {
        /**
         * The list of callbacks to execute when the signal is notified.
         * @type {Callback[]}
         */
        this.callbacks = [];
    }

    /**
     * Install a callback to be executed when the signal is notified.
     * 
     * @param {Callback} callback - The callback to connect to the signal.
     */
    connect = (callback) => {
        this.callbacks.push(callback);
    }

    /**
     * Remove a callback from the signal.
     * 
     * @param {Callback} callback - The callback to remove from the signal.
     */
    disconnect = (callback) => {
        this.callbacks = this.callbacks.filter(cb => cb !== callback);
    }

    /**
     * Trigger all callbacks connected to the signal.
     * 
     * If a callback returns `true`, it will be removed from the signal.
     * 
     * @param {*} data - The data to pass to the callbacks.
     */
    notify = (data) => {
        const newcallbacks = [];
        this.callbacks.forEach(callback => {
            const result = callback(data);
            if (!result) {
                newcallbacks.push(callback);
            }
        });
        this.callbacks = newcallbacks;
    }
}
