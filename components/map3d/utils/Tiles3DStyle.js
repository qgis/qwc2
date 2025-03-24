import { Float32BufferAttribute } from "three";

const Tiles3DStyle = {
    applyDeclarativeStyle(group, tilesetConfig) {
        const batchTable = group.batchTable;

        const batchColorCache = {};
        const batchColor = (batchId) => {
            if (!batchColorCache[batchId]) {
                const color = batchTable.getDataFromId(batchId)[tilesetConfig.colorAttr] ?? 0xFFFFFF;
                const r = ((color >> 16) & 0xff) / 255;
                const g = ((color >> 8) & 0xff) / 255;
                const b = (color & 0xff) / 255;
                batchColorCache[batchId] = [r, g, b];
            }
            return batchColorCache[batchId];
        };
        group.traverse(c => {
            if (c.geometry) {
                if (tilesetConfig.colorAttr) {
                    const batchidAttr = c.geometry.getAttribute( '_batchid' );
                    const colors = [];
                    batchidAttr.array.forEach(batchId => {
                        colors.push(...batchColor(batchId));
                    });
                    c.geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
                    c.material.vertexColors = true;
                }
            }
        });
    }
};

export default Tiles3DStyle;
