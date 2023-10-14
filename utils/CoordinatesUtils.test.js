import CoordinatesUtils from './CoordinatesUtils';

describe('setCrsLabels', () => {
    it('should set crsLabels', () => {
        CoordinatesUtils.setCrsLabels({ testIn: 'testOut' });
        expect(
            CoordinatesUtils.getCrsLabel("testIn")
        ).toBe('testOut');
    });
});

describe('getCrsLabel', () => {
    it('should retrieve default values', () => {
        expect(
            CoordinatesUtils.getCrsLabel("EPSG:4326")
        ).toBe('WGS 84');
        expect(
            CoordinatesUtils.getCrsLabel("EPSG:3857")
        ).toBe('WGS 84 / Pseudo Mercator');
    });
});

describe('getAvailableCRS', () => {
    it('should retrieve default values', () => {
        const available = CoordinatesUtils.getAvailableCRS();
        expect(available["EPSG:4326"].label).toBe('WGS 84');
        expect(available["EPSG:3857"].label).toBe('WGS 84 / Pseudo Mercator');
        expect(available["GOOGLE"].label).toBe('GOOGLE');
        expect(available["WGS84"].label).toBe('WGS84');
    });
});

describe('getUnits', () => {
    it('should return degrees by default', () => {
        expect(
            CoordinatesUtils.getUnits('XXYY')
        ).toBe('degrees');

    });
});
