import {remove as removeDiacritics} from 'diacritics';


const END_MARKERS = {
    SECTION: 'ENDSEC',
    TABLE: 'ENDTAB',
    BLOCK: 'ENDBLK'
};

export function explodeDxf(text) {
    const tuples = text.replace(/\s+$/, '').split(/\r\n|\r|\n/g).flatMap((_, i, a) => i % 2 ? [] : [a.slice(i, i + 2).map(x => x.trim())]);
    let maxHandle = 100; // Value in QGIS

    const explode = (pairs) => {
        const toplevelTuples = [];
        let sectionTuples;
        let marker;
        let expectEndMarker;
        const children = pairs.reduce((acc, tuple) => {
            if (tuple[0] === '5' && tuple[1] !== '9999999') {
                maxHandle = Math.max(parseInt(tuple[1], 16), maxHandle);
            }
            if (tuple[0] === '0') {
                if (expectEndMarker && tuple[1] === expectEndMarker) {
                    acc.push({
                        type: marker,
                        ...explode(sectionTuples)
                    });
                    sectionTuples = undefined;
                    marker = undefined;
                    expectEndMarker = undefined;
                } else if (expectEndMarker && tuple[1] !== expectEndMarker) {
                    sectionTuples.push(tuple);
                } else if (!expectEndMarker) {
                    if (sectionTuples) {
                        acc.push({
                            type: marker,
                            ...explode(sectionTuples)
                        });
                    }
                    sectionTuples = [];
                    marker = tuple[1];
                    expectEndMarker = END_MARKERS[marker];
                }
            } else if (sectionTuples) {
                sectionTuples.push(tuple);
            } else if (acc.length > 0) {
                acc[acc.length - 1].tailValues.push(tuple);
            } else {
                toplevelTuples.push(tuple);
            }
            return acc;
        }, []);
        if (marker && sectionTuples && !expectEndMarker) {
            children.push({type: marker, ...explode(sectionTuples)});
        }
        const name = toplevelTuples.find(tuple => tuple[0] === '2')?.[1];
        return {
            name: name,
            values: toplevelTuples,
            children: children,
            tailValues: []
        };
    };

    const result = explode(tuples);
    result.maxHandle = maxHandle;
    return result;
}

export function implodeDxf(exploded) {
    let output = "";
    let handleSeed = 100;

    const dumpValues = (values) => values.forEach(tuple => {
        if (tuple[0] === '5' && parseInt(tuple[0], 16) >= 100) {
            output += `5\n${(handleSeed++).toString(16)}\n`;
        } else {
            output += `${tuple[0]}\n${tuple[1]}\n`;
        }
    });
    const implode = (data) => {
        dumpValues(data.values);
        data.children.forEach(child => {
            output += `0\n${child.type}\n`;
            implode(child);
            if (END_MARKERS[child.type]) {
                output += `0\n${END_MARKERS[child.type]}\n`;
            }
            dumpValues(child.tailValues);
        });
    };
    implode(exploded);
    return output;
}

export function mergeDxf(documents) {
    // Merge blockRecords, Blocks, Layers and Entities of dxf documents
    const mergedEntities =  documents[0].children.find(
        child => child.type === 'SECTION' && child.name === 'ENTITIES'
    );
    const mergedLayers = documents[0].children.find(
        child => child.type === 'SECTION' && child.name === 'TABLES'
    ).children.find(
        child => child.type === 'TABLE' && child.name === 'LAYER'
    );
    const mergedBlockRecords = documents[0].children.find(
        child => child.type === 'SECTION' && child.name === 'TABLES'
    ).children.find(
        child => child.type === 'TABLE' && child.name === 'BLOCK_RECORD'
    );
    const mergedBlocks =  documents[0].children.find(
        child => child.type === 'SECTION' && child.name === 'BLOCKS'
    );
    // Reference the common block handles of the first document in subsequent documents
    const commonBlockHandles = {
        "*Model_Space": mergedBlockRecords.children.find(br => br.name === "*Model_Space")?.values?.find(t => t[0] === "5")?.[1],
        "*Paper_Space": mergedBlockRecords.children.find(br => br.name === "*Paper_Space")?.values?.find(t => t[0] === "5")?.[1],
        "*Paper_Space0": mergedBlockRecords.children.find(br => br.name === "*Paper_Space0")?.values?.find(t => t[0] === "5")?.[1]
    };
    let maxHandle = documents[0].maxHandle;
    documents.slice(1).forEach(document => {
        // Get items to merge
        const entities =  document.children.find(
            child => child.type === 'SECTION' && child.name === 'ENTITIES'
        );
        const layers = document.children.find(
            child => child.type === 'SECTION' && child.name === 'TABLES'
        ).children.find(
            child => child.type === 'TABLE' && child.name === 'LAYER'
        );
        const blockRecords = document.children.find(
            child => child.type === 'SECTION' && child.name === 'TABLES'
        ).children.find(
            child => child.type === 'TABLE' && child.name === 'BLOCK_RECORD'
        );
        const blocks = document.children.find(
            child => child.type === 'SECTION' && child.name === 'BLOCKS'
        );
        const handleMapping = {};

        // Merge items, adjusting handles as necessary to avoid conflicting handles
        blockRecords.children.forEach(blockRecord => {
            const handleTuple = blockRecord.values.find(tuple => tuple[0] === "5");
            if (["*Model_Space", "*Paper_Space", "*Paper_Space0"].includes(blockRecord.name)) {
                handleMapping[handleTuple[1]] = commonBlockHandles[blockRecord.name];
            } else {
                const newHandle = (++maxHandle).toString(16);
                handleMapping[handleTuple[1]] = newHandle;
                handleTuple[1] = newHandle;
                mergedBlockRecords.children.push(blockRecord);
            }
        });
        blocks.children.forEach(block => {
            // Note: Don't merge common blocks
            if (!["*Model_Space", "*Paper_Space", "*Paper_Space0"].includes(block.name)) {
                const handleRefTuple = block.values.find(tuple => tuple[0] === "330");
                if (handleRefTuple) {
                    handleRefTuple[1] = handleMapping[handleRefTuple[1]];
                }
                block.values.find(tuple => tuple[0] === "5")[1] = (++maxHandle).toString(16);
                mergedBlocks.children.push(block);
            }
        });
        layers.children.forEach(layer => {
            // Note: Don't merge dummy layer 0
            if (layer.name !== '0') {
                layer.values.find(tuple => tuple[0] === "5")[1] = (++maxHandle).toString(16);
                mergedLayers.children.push(layer);
            }
        });
        entities.children.forEach(entity => {
            const handleRefTuple = entity.values.find(tuple => tuple[0] === "330");
            if (handleRefTuple) {
                handleRefTuple[1] = handleMapping[handleRefTuple[1]];
            }
            const handleTuple = entity.values.find(tuple => tuple[0] === "5");
            const newHandle = (++maxHandle).toString(16);
            handleMapping[handleTuple[1]] = newHandle;
            handleTuple[1] = newHandle;
            // VERTEX, SEQEND
            entity.children.forEach(child => {
                child.values.find(tuple => tuple[0] === "5")[1] = (++maxHandle).toString(16);
                const childHandleRefTuple = child.values.find(tuple => tuple[0] === "330");
                if (childHandleRefTuple) {
                    childHandleRefTuple[1] = handleMapping[childHandleRefTuple[1]];
                }
            });
            mergedEntities.children.push(entity);
        });
    });

    // Update layer count
    mergedLayers.values.find(tuple => tuple[0] === "70")[1] = String(mergedLayers.children.length);

    // Replace special characters in layer name
    mergedLayers.children.forEach(child => {
        const nameTuple = child.values.find(tuple => tuple[0] === "2");
        nameTuple[1] = removeDiacritics(nameTuple[1]).replace(/\W/g, '_');
    });

    return documents[0];
}
