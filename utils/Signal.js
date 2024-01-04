export default class Signal {
    constructor() {
        this.callbacks = [];
    }
    connect = (callback) => {
        this.callbacks.push(callback);
    };
    disconnect = (callback) => {
        this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
    notify = (data) => {
        const newcallbacks = [];
        this.callbacks.forEach(callback => {
            // If a callback returns true, don't re-execute it
            const result = callback(data);
            if (!result) {
                newcallbacks.push(callback);
            }
        });
        this.callbacks = newcallbacks;
    };
}
