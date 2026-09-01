/**
 * Copyright 2025 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const END_MARKERS = {
    SECTION: 'ENDSEC',
    TABLE: 'ENDTAB',
    BLOCK: 'ENDBLK'
};

// Code pages whose $DWGCODEPAGE name does not map to a "windows-<n>" encoding label
const DWG_CODEPAGE_ENCODINGS = {
    932: "shift_jis",
    936: "gbk",
    949: "euc-kr",
    950: "big5"
};

// AutoCAD 2007 (AC1021) and newer write UTF-8, older versions the $DWGCODEPAGE code page
export function detectDxfEncoding(buffer) {
    // The header is ASCII in all code pages of interest, so it can be sniffed as latin1
    const headerBytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 8192));
    const lines = new TextDecoder("iso-8859-1").decode(headerBytes).split(/\r\n|\r|\n/).map(line => line.trim());
    // Header variables are stored as name, group code, value
    const headerValue = (variable) => {
        const idx = lines.indexOf(variable);
        return idx >= 0 ? lines[idx + 2] : undefined;
    };
    // Version markers are AC<4 digits>, hence they compare lexicographically
    if ((headerValue("$ACADVER") || "") >= "AC1021") {
        return "utf-8";
    }
    const codePage = (headerValue("$DWGCODEPAGE") || "").match(/^ANSI_(\d+)$/)?.[1];
    return DWG_CODEPAGE_ENCODINGS[codePage] ?? (codePage ? "windows-" + codePage : "windows-1252");
}

export function decodeDxf(buffer) {
    const encoding = detectDxfEncoding(buffer);
    try {
        return new TextDecoder(encoding).decode(buffer);
    } catch {
        // TextDecoder throws on unknown encoding labels
        return new TextDecoder("windows-1252").decode(buffer);
    }
}

// Reverse of DWG_CODEPAGE_ENCODINGS, to go from a detectDxfEncoding() label back to a $DWGCODEPAGE value
const ENCODING_DWG_CODEPAGES = Object.fromEntries(
    Object.entries(DWG_CODEPAGE_ENCODINGS).map(([codePage, encoding]) => [encoding, "ANSI_" + codePage])
);

// Rewrite $DWGCODEPAGE to the "ANSI_<n>" form the DXF spec expects (QGIS Server writes the non-standard "8859_1")
export function setDwgCodepage(document, encoding) {
    if (encoding === "utf-8") {
        return;
    }
    const codePage = ENCODING_DWG_CODEPAGES[encoding] ?? "ANSI_" + (encoding.match(/^windows-(\d+)$/)?.[1] ?? "1252");
    const header = document.children.find(child => child.type === 'SECTION' && child.name === 'HEADER');
    const nameIdx = header.values.findIndex(tuple => tuple[0] === '9' && tuple[1] === '$DWGCODEPAGE');
    if (nameIdx >= 0) {
        header.values[nameIdx + 1][1] = codePage;
    } else {
        header.values.push(['9', '$DWGCODEPAGE'], ['3', codePage]);
    }
}

// DXF escapes characters the file code page cannot represent as \U+XXXX
export function unescapeDxfUnicode(text) {
    return text.replace(/\\U\+([0-9A-Fa-f]{4})/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
}

const COLOR_BYBLOCK = 0;
const COLOR_BYLAYER = 256;

const rgbToHex = (rgb) => "#" + rgb.map(v => v.toString(16).padStart(2, "0")).join("");

// AutoCAD draws on black, so an ACI black or white mostly means "no color was chosen"
const isDefaultAciColor = (rgb) => rgb.every(v => v === 0) || rgb.every(v => v === 255);

// dxf has no handler for group code 420 (24 bit true color), so it has to be read off the raw file
function extractTrueColors(text) {
    const lines = text.split(/\r\n|\r|\n/);
    const trueColors = {};
    let handle = null;
    for (let i = 0; i + 1 < lines.length; i += 2) {
        const code = lines[i].trim();
        if (code === "0") {
            handle = null;
        } else if (code === "5") {
            handle = lines[i + 1].trim();
        } else if (code === "420" && handle !== null) {
            const value = parseInt(lines[i + 1].trim(), 10);
            if (value >= 0) {
                trueColors[handle] = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
            }
        }
    }
    return trueColors;
}

// Returns a resolveColor(entity) yielding the hex color to draw an entity in
export function createDxfColorResolver(text, parsed, colors, defaultColor) {
    const trueColors = extractTrueColors(text);
    const layerTables = parsed.tables?.layers ?? {};
    return (entity) => {
        // An own 24 bit color is a deliberate choice and is used verbatim, black included
        const trueColor = trueColors[entity.handle];
        if (trueColor) {
            return rgbToHex(trueColor);
        }
        let colorNumber = entity.colorNumber;
        // BYBLOCK should take the color of the placing INSERT, which denormalise() drops, so it falls back to the layer as well
        if (colorNumber === undefined || colorNumber === COLOR_BYLAYER || colorNumber === COLOR_BYBLOCK) {
            colorNumber = layerTables[entity.layer]?.colorNumber;
        }
        const rgb = colors[colorNumber] ?? colors[0];
        return isDefaultAciColor(rgb) ? defaultColor : rgbToHex(rgb);
    };
}

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
    const mergedLtypes = documents[0].children.find(
        child => child.type === 'SECTION' && child.name === 'TABLES'
    ).children.find(
        child => child.type === 'TABLE' && child.name === 'LTYPE'
    );
    // Reference the common block handles of the first document in subsequent documents
    const commonBlockHandles = {
        "*Model_Space": mergedBlockRecords.children.find(br => br.name === "*Model_Space")?.values?.find(t => t[0] === "5")?.[1],
        "*Paper_Space": mergedBlockRecords.children.find(br => br.name === "*Paper_Space")?.values?.find(t => t[0] === "5")?.[1],
        "*Paper_Space0": mergedBlockRecords.children.find(br => br.name === "*Paper_Space0")?.values?.find(t => t[0] === "5")?.[1]
    };
    // A layer defined in more than one document is only kept once
    const existingLayerNames = new Set(mergedLayers.children.map(layer => layer.name));
    // These linetypes are assumed identical everywhere, everything else is uniquified below
    const STANDARD_LTYPES = ["ByLayer", "ByBlock", "CONTINUOUS", "DASH", "DOT", "DASHDOT", "DASHDOTDOT"];
    let maxHandle = documents[0].maxHandle;
    documents.slice(1).forEach((document, docIndex) => {
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
        const ltypes = document.children.find(
            child => child.type === 'SECTION' && child.name === 'TABLES'
        ).children.find(
            child => child.type === 'TABLE' && child.name === 'LTYPE'
        );
        const handleMapping = {};
        // Block names are only unique within a document, so QGIS symbol blocks collide across merged documents
        const blockNameMapping = {};
        // Same problem for non standard linetypes (see STANDARD_LTYPES above)
        const ltypeNameMapping = {};

        // Remap the handle (5) and owner handle reference (330) found in a tuple list, if any are there
        const remapValueHandles = (values) => {
            const handleRefTuple = values.find(tuple => tuple[0] === "330");
            if (handleRefTuple && handleMapping[handleRefTuple[1]] !== undefined) {
                handleRefTuple[1] = handleMapping[handleRefTuple[1]];
            }
            const handleTuple = values.find(tuple => tuple[0] === "5");
            if (handleTuple) {
                const newHandle = (++maxHandle).toString(16);
                handleMapping[handleTuple[1]] = newHandle;
                handleTuple[1] = newHandle;
            }
        };
        // Recursively remap an item, its children (VERTEX, SEQEND, ...) and its end marker's tailValues
        const remapHandles = (item) => {
            remapValueHandles(item.values);
            item.children.forEach(remapHandles);
            remapValueHandles(item.tailValues);
        };
        // Remap an INSERT entity's block name reference (2) to the uniquified name
        const remapBlockNameRef = (item) => {
            if (item.type === 'INSERT') {
                const nameTuple = item.values.find(tuple => tuple[0] === "2");
                if (nameTuple && blockNameMapping[nameTuple[1]]) {
                    nameTuple[1] = blockNameMapping[nameTuple[1]];
                }
            }
            item.children.forEach(remapBlockNameRef);
        };
        // Remap any entity's linetype reference (6) to the uniquified name
        const remapLinetypeRef = (item) => {
            const linetypeTuple = item.values.find(tuple => tuple[0] === "6");
            if (linetypeTuple && ltypeNameMapping[linetypeTuple[1]]) {
                linetypeTuple[1] = ltypeNameMapping[linetypeTuple[1]];
            }
            item.children.forEach(remapLinetypeRef);
        };

        // Merge items, adjusting handles and block names to avoid conflicts
        blockRecords.children.forEach(blockRecord => {
            const handleTuple = blockRecord.values.find(tuple => tuple[0] === "5");
            if (["*Model_Space", "*Paper_Space", "*Paper_Space0"].includes(blockRecord.name)) {
                handleMapping[handleTuple[1]] = commonBlockHandles[blockRecord.name];
            } else {
                const newHandle = (++maxHandle).toString(16);
                handleMapping[handleTuple[1]] = newHandle;
                handleTuple[1] = newHandle;
                const newName = `${blockRecord.name}_m${docIndex + 1}`;
                blockNameMapping[blockRecord.name] = newName;
                blockRecord.values.find(tuple => tuple[0] === "2")[1] = newName;
                blockRecord.name = newName;
                mergedBlockRecords.children.push(blockRecord);
            }
        });
        blocks.children.forEach(block => {
            // Note: Don't merge common blocks
            if (!["*Model_Space", "*Paper_Space", "*Paper_Space0"].includes(block.name)) {
                remapValueHandles(block.values);
                // The ENDBLK's own handle/owner reference end up in the block's tailValues
                remapValueHandles(block.tailValues);
                const newName = blockNameMapping[block.name];
                if (newName) {
                    // Group codes 2 and 3 both carry the block name
                    block.values.filter(tuple => tuple[0] === "2" || tuple[0] === "3").forEach(tuple => {
                        tuple[1] = newName;
                    });
                    block.name = newName;
                }
                // Block contents have their own handles and may INSERT other blocks
                block.children.forEach(remapHandles);
                block.children.forEach(remapBlockNameRef);
                block.children.forEach(remapLinetypeRef);
                mergedBlocks.children.push(block);
            }
        });
        ltypes.children.forEach(ltype => {
            if (!STANDARD_LTYPES.includes(ltype.name)) {
                const newName = `${ltype.name}_m${docIndex + 1}`;
                ltypeNameMapping[ltype.name] = newName;
                ltype.values.find(tuple => tuple[0] === "2")[1] = newName;
                ltype.name = newName;
                ltype.values.find(tuple => tuple[0] === "5")[1] = (++maxHandle).toString(16);
                mergedLtypes.children.push(ltype);
            }
        });
        layers.children.forEach(layer => {
            // Note: Don't merge dummy layer 0, or a layer already defined by an earlier document
            if (layer.name !== '0' && !existingLayerNames.has(layer.name)) {
                existingLayerNames.add(layer.name);
                layer.values.find(tuple => tuple[0] === "5")[1] = (++maxHandle).toString(16);
                mergedLayers.children.push(layer);
            }
        });
        entities.children.forEach(entity => {
            remapHandles(entity);
            remapBlockNameRef(entity);
            remapLinetypeRef(entity);
            mergedEntities.children.push(entity);
        });
    });

    // Update layer and linetype counts
    mergedLayers.values.find(tuple => tuple[0] === "70")[1] = String(mergedLayers.children.length);
    mergedLtypes.values.find(tuple => tuple[0] === "70")[1] = String(mergedLtypes.children.length);

    return documents[0];
}
