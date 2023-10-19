import Signal from './Signal';

describe('connect', () => {
    it('should add a callback to the list of callbacks', () => {
        const signal = new Signal();
        const callback = jest.fn();
        signal.connect(callback);
        expect(signal.callbacks).toContain(callback);
    });
});

describe('disconnect', () => {
    it('should remove a callback from the list of callbacks', () => {
        const signal = new Signal();
        const callback = jest.fn();
        signal.connect(callback);
        signal.disconnect(callback);
        expect(signal.callbacks).not.toContain(callback);
    });
});

describe('notify', () => {
    it('should call all callbacks with the data', () => {
        const signal = new Signal();
        const callback = jest.fn();
        signal.connect(callback);
        signal.notify('data');
        expect(callback).toHaveBeenCalledWith('data');
    });

    it('should remove callbacks that return true', () => {
        const signal = new Signal();
        const callback1 = jest.fn(() => true);
        const callback2 = jest.fn(() => false);
        signal.connect(callback1);
        signal.connect(callback2);
        signal.notify('data');
        expect(signal.callbacks).not.toContain(callback1);
        expect(signal.callbacks).toContain(callback2);
    });
});
