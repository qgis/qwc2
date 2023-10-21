import ol from 'openlayers';

describe("content of libs/openlayers", () => {
    it("should import ol", () => {
        expect(ol).not.toBe(undefined);
    });
});
