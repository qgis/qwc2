import CoordinatesUtils from './CoordinatesUtils';

const invalidProjections = ['XXYY', 'ABCD', 'EPSG'];


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
    it('should throw if the projection is unknown', () => {
        invalidProjections.forEach((projection) => {
            expect(() => {
                CoordinatesUtils.getUnits(projection)
            }).toThrow(/^Invalid projection.+/);
        });
    });

    it('should return proper units for known projections', () => {
        expect(
            CoordinatesUtils.getUnits('EPSG:4326')
        ).toBe('degrees');
        expect(
            CoordinatesUtils.getUnits('EPSG:3857')
        ).toBe('m');
    });
});


describe('getAxisOrder', () => {
    it('should throw if the projection is unknown', () => {
        invalidProjections.forEach((projection) => {
            expect(() => {
                CoordinatesUtils.getAxisOrder(projection)
            }).toThrow(/^Invalid projection.+/);
        });
    });

    it('should return proper order for known projections', () => {
        expect(
            CoordinatesUtils.getAxisOrder('EPSG:4326')
        ).toBe('neu');
        expect(
            CoordinatesUtils.getAxisOrder('EPSG:3857')
        ).toBe('enu');
    });
});


describe('reproject', () => {
    it("should return null if no src or no dest", () => {
        expect(
            CoordinatesUtils.reproject([1, 2], 'EPSG:4326', null)
        ).toBe(null);
        expect(
            CoordinatesUtils.reproject([1, 2], null, 'EPSG:4326')
        ).toBe(null);
        expect(
            CoordinatesUtils.reproject([1, 2], 'EPSG:4326', undefined)
        ).toBe(null);
        expect(
            CoordinatesUtils.reproject([1, 2], undefined, 'EPSG:4326')
        ).toBe(null);
        expect(
            CoordinatesUtils.reproject([1, 2], 'EPSG:4326', '')
        ).toBe(null);
        expect(
            CoordinatesUtils.reproject([1, 2], '', 'EPSG:4326')
        ).toBe(null);
    });
    it("should return same point if same CRS", () => {
        expect(
            CoordinatesUtils.reproject([1, 2], undefined, undefined)
        ).not.toBe([1, 2]);
        expect(
            CoordinatesUtils.reproject([1, 2], undefined, undefined)
        ).toStrictEqual([1, 2]);
        expect(
            CoordinatesUtils.reproject([1, 2], 'EPSG:4326', 'EPSG:4326')
        ).not.toBe([1, 2]);
        expect(
            CoordinatesUtils.reproject([1, 2], 'EPSG:4326', 'EPSG:4326')
        ).toStrictEqual([1, 2]);
    });
    it("should convert from EPSG:4326 to EPSG:3857", () => {
        const converted = CoordinatesUtils.reproject(
            [0, 0], 'EPSG:4326', 'EPSG:3857'
        );
        expect(converted[0]).toBeCloseTo(0, 4);
        expect(converted[1]).toBeCloseTo(0, 4);
    });
    it("should convert from EPSG:3857 to EPSG:4326", () => {
        const converted = CoordinatesUtils.reproject(
            [0, 0], 'EPSG:3857', 'EPSG:4326'
        );
        expect(converted[0]).toBeCloseTo(0, 4);
        expect(converted[1]).toBeCloseTo(0, 4);
    });
});


describe('reprojectBbox', () => {
    it("should compute the bbox of a point", () => {
        const result = CoordinatesUtils.reprojectBbox(
            [1, 2, 1, 2], 'EPSG:4326', 'EPSG:3857'
        );
        expect(result[0]).toBeCloseTo(111319.49, 1);
        expect(result[1]).toBeCloseTo(222684.20, 1);
        expect(result[2]).toBeCloseTo(111319.49, 1);
        expect(result[3]).toBeCloseTo(222684.20, 1);
    });
    it("should compute the bbox of a line", () => {
        const result = CoordinatesUtils.reprojectBbox(
            [1, 2, 3, 4], 'EPSG:4326', 'EPSG:3857'
        );
        expect(result[0]).toBeCloseTo(111319.49, 1);
        expect(result[1]).toBeCloseTo(222684.20, 1);
        expect(result[2]).toBeCloseTo(333958.47, 1);
        expect(result[3]).toBeCloseTo(445640.10, 1);
    });
    it("should silently ignore the invalid CRS", () => {
        expect(
            CoordinatesUtils.reprojectBbox([1, 2, 3, 4], 'EPSG', 'EPSG')
        ).toStrictEqual([1, 2, 3, 4]);
        expect(
            CoordinatesUtils.reprojectBbox([1, 2, 3, 4], 'EPSG', 'EPSG:3857')
        ).toStrictEqual([0, 0, 0, 0]);
        expect(
            CoordinatesUtils.reprojectBbox([1, 2, 3, 4], 'EPSG:4326', 'EPSG')
        ).toStrictEqual([0, 0, 0, 0]);
    });
    it("should throw on empty CRS", () => {
        expect(() => {
            CoordinatesUtils.reprojectBbox([1, 2, 3, 4], null)
        }).toThrow(/^object null is not iterable+/);
    });
});


describe('calculateAzimuth', () => {
    it("should silently ignore the invalid CRS", () => {
        expect(
            CoordinatesUtils.calculateAzimuth([1, 2], [3, 4], 'EPSG')
        ).toBe(0);
        expect(
            CoordinatesUtils.calculateAzimuth([1, 2], [3, 4], '3857')
        ).toBe(0);
    });
    it("should throw on empty CRS", () => {
        expect(() => {
            CoordinatesUtils.calculateAzimuth([1, 2], [3, 4], null)
        }).toThrow(/^Cannot read properties of null+/);
        expect(() => {
            CoordinatesUtils.calculateAzimuth([1, 2], [3, 4], undefined)
        }).toThrow(/^Cannot read properties of null+/);
        expect(() => {
            CoordinatesUtils.calculateAzimuth([1, 2], [3, 4], '')
        }).toThrow(/^Cannot read properties of null+/);
    });
    it("should return 0 if the two points are the same", () => {
        expect(
            CoordinatesUtils.calculateAzimuth([1, 2], [1, 2], 'EPSG:4326')
        ).toBe(0);
        expect(
            CoordinatesUtils.calculateAzimuth([1, 2], [1, 2], 'EPSG:3857')
        ).toBe(0);
    });
    it("should return the azimuth between two points", () => {
        expect(
            CoordinatesUtils.calculateAzimuth([1, 2], [3, 4], 'EPSG:4326')
        ).toBeCloseTo(45, 0);
        expect(
            CoordinatesUtils.calculateAzimuth([1, 2], [3, 4], 'EPSG:3857')
        ).toBeCloseTo(45, 0);
    });
});


describe('extendExtent', () => {
    it("should return a good result", () => {
        expect(
            CoordinatesUtils.extendExtent([1, 2, 3, 4], [5, 6, 7, 8])
        ).toStrictEqual([1, 2, 7, 8]);
        expect(
            CoordinatesUtils.extendExtent([0, 0, 0, 0], [0, 0, 0, 0])
        ).toStrictEqual([0, 0, 0, 0]);
    });
});


describe('isValidExtent', () => {
    it("should return false if the extent is not an array", () => {
        expect(
            CoordinatesUtils.isValidExtent(null)
        ).toBe(false);
        expect(
            CoordinatesUtils.isValidExtent(undefined)
        ).toBe(false);
        expect(
            CoordinatesUtils.isValidExtent("")
        ).toBe(false);
        expect(
            CoordinatesUtils.isValidExtent(1)
        ).toBe(false);
        expect(
            CoordinatesUtils.isValidExtent({})
        ).toBe(false);
    });
    it("should return false if the extent is not an array of 4 numbers", () => {
        expect(
            CoordinatesUtils.isValidExtent([1, 2, 3])
        ).toBe(false);
        expect(
            CoordinatesUtils.isValidExtent([1, 2])
        ).toBe(false);
        expect(
            CoordinatesUtils.isValidExtent([1])
        ).toBe(false);
    });
    it("should return false if the extent contains Infinity or -Infinity", () => {
        expect(
            CoordinatesUtils.isValidExtent([1, 2, 3, Infinity])
        ).toBe(false);
        expect(
            CoordinatesUtils.isValidExtent([1, 2, 3, -Infinity])
        ).toBe(false);
        expect(
            CoordinatesUtils.isValidExtent([1, 2, Infinity, 4])
        ).toBe(false);
        expect(
            CoordinatesUtils.isValidExtent([1, 2, -Infinity, 4])
        ).toBe(false);
        expect(
            CoordinatesUtils.isValidExtent([1, Infinity, 3, 4])
        ).toBe(false);
        expect(
            CoordinatesUtils.isValidExtent([1, -Infinity, 3, 4])
        ).toBe(false);
        expect(
            CoordinatesUtils.isValidExtent([Infinity, 2, 3, 4])
        ).toBe(false);
        expect(
            CoordinatesUtils.isValidExtent([-Infinity, 2, 3, 4])
        ).toBe(false);
    });
    it("should return false if the extent is not valid", () => {
        expect(
            CoordinatesUtils.isValidExtent([1, 2, 0, 4])
        ).toBe(false);
        expect(
            CoordinatesUtils.isValidExtent([1, 2, 3, 2])
        ).toBe(false);
    });
    it("should return true if the extent is valid", () => {
        expect(
            CoordinatesUtils.isValidExtent([1, 2, 3, 4])
        ).toBe(true);
    });
});


describe('fromOgcUrnCrs', () => {
    it("should throw if the CRS is invalid", () => {
        expect(() => {
            CoordinatesUtils.fromOgcUrnCrs("urn")
        }).toThrow(/^Invalid OGC CRS.+/);
        expect(() => {
            CoordinatesUtils.fromOgcUrnCrs("EPSG")
        }).toThrow(/^Invalid OGC CRS.+/);
        expect(() => {
            CoordinatesUtils.fromOgcUrnCrs("")
        }).toThrow(/^Invalid OGC CRS.+/);
    });
    it("should convert from urn:ogc:def:crs:EPSG::4326 to EPSG:4326", () => {
        expect(
            CoordinatesUtils.fromOgcUrnCrs("urn:ogc:def:crs:EPSG::4326")
        ).toBe("EPSG:4326");
    });
    it("Just sticks the last part of the URN onto EPSG:", () => {
        expect(
            CoordinatesUtils.fromOgcUrnCrs("have:fun")
        ).toBe("EPSG:fun");
    });
    it("deals with one special case", () => {
        expect(
            CoordinatesUtils.fromOgcUrnCrs("urn:ogc:def:crs:OGC:1.3:CRS84")
        ).toBe("EPSG:4326");
    });
});


describe('toOgcUrnCrs', () => {
    it("should throw if the CRS is invalid", () => {
        expect(() => {
            CoordinatesUtils.toOgcUrnCrs("EPSG:4326:4326")
        }).toThrow(/^Invalid CRS.+/);
        expect(() => {
            CoordinatesUtils.toOgcUrnCrs("EPSG")
        }).toThrow(/^Invalid CRS.+/);
        expect(() => {
            CoordinatesUtils.toOgcUrnCrs("4326")
        }).toThrow(/^Invalid CRS.+/);
    });
    it("should convert from EPSG:4326 to urn:ogc:def:crs:EPSG::4326", () => {
        expect(
            CoordinatesUtils.toOgcUrnCrs("EPSG:4326")
        ).toBe("urn:ogc:def:crs:EPSG::4326");
    });
});
