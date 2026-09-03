/**
 * Copyright 2026 Dominik Warch
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import isEmpty from 'lodash.isempty';

import {unescapeDxfUnicode} from './DxfUtils';
import MiscUtils from './MiscUtils';

// Stroke color for entities left at the ACI default color
const DXF_DEFAULT_COLOR = '#1565C0';

// Color numbers deferring to the layer resp. to the placing INSERT
const COLOR_BYBLOCK = 0;
const COLOR_BYLAYER = 256;

// Points per full turn of an arc, scaled down for arcs which are small within the drawing
const ARC_MIN_SEGMENTS = 8;
const ARC_MAX_SEGMENTS = 72;

// An arc reaches the full resolution once its radius covers this fraction of the drawing
const ARC_FULL_RESOLUTION_RADIUS = 0.005;

// Coordinates are rounded to this fraction of the drawing extent, which halves the payload without being visible
const COORDINATE_PRECISION = 1e-6;

// Ring simplification tolerance, as a fraction of the ring's own extent, so that it does not depend on the
// unit the drawing is in. Straight edged outlines are unaffected by it
const RING_SIMPLIFY_TOLERANCE = 0.01;

// A block instance smaller than this fraction of the drawing is a point symbol rather than an area
const SYMBOL_MAX_EXTENT = 0.0005;

// Symbols are only collapsed on layers repeating them at least this often, small real areas are not repeated
const SYMBOL_MIN_PER_LAYER = 20;

// On screen radius of a collapsed symbol
const SYMBOL_RADIUS = 4;

// Scale factors on the base size of the text feature style
const TEXT_SCALE_SMALL = 0.85;
const TEXT_SCALE_NORMAL = 1.0;
const TEXT_SCALE_LARGE = 1.3;

// Text below/above these fractions of the drawing's median text height counts as small/large
const TEXT_SMALL_FRACTION = 0.75;
const TEXT_LARGE_FRACTION = 1.5;

// Bit 1 of an attribute's flags marks it invisible
const ATTRIBUTE_INVISIBLE = 1;

// %%<c> codes standing for a character rather than for a formatting toggle
const CONTROL_CODE_CHARS = {d: "\u00b0", p: "\u00b1", c: "\u2300"};

// %%u, %%o and %%k toggle underline, overline and strikethrough, which have no equivalent here
const CONTROL_CODE_TOGGLES = "uUoOkK";

// Escaped literals have to match first, so that an escaped backslash does not start a code of its own
const MTEXT_INLINE_CODES = /\\([\\{}])|\\S([^;]*);|\\[pfF][^;]*;|\\[HWQATCc][^;]*;|\\[PX]|\\~|\\[LlOoKk]|[{}]/g;

// QGIS Server omits the text height (group code 40) and writes it as an inline MTEXT override instead
const MTEXT_HEIGHT_OVERRIDE = /\\H([0-9.]+);/;

// Entity types which become a line feature
const LINE_ENTITIES = ["LINE", "LWPOLYLINE", "POLYLINE", "CIRCLE", "ARC", "ELLIPSE", "SOLID", "3DFACE"];

// Entity types which become a text feature
const TEXT_ENTITIES = ["TEXT", "MTEXT", "ATTRIB"];

// Guards against a block ends up inserting itself
const MAX_BLOCK_DEPTH = 16;

const EMPTY_BOUNDS = [Infinity, Infinity, -Infinity, -Infinity];

// The AutoCAD Color Index palette as 24 bit values
const ACI_COLORS = [
    0, 16711680, 16776960, 65280, 65535, 255, 16711935, 16777215, 4276545, 8421504, 16711680, 16755370, 12386304, 12418686, 8454144, 8476246,
    6815744, 6833477, 5177344, 5190965, 16727808, 16760746, 12398080, 12422526, 8462080, 8478806, 6822144, 6835781, 5182208, 5192501, 16744192, 16766122,
    12410368, 12426622, 8470528, 8481622, 6829056, 6837829, 5187328, 5194293, 16760576, 16771754, 12422400, 12430718, 8478720, 8484438, 6835712, 6840133,
    5192448, 5196085, 16776960, 16777130, 12434688, 12434814, 8487168, 8487254, 6842368, 6842437, 5197568, 5197621, 12582656, 15400874, 9288960, 11386238,
    6324480, 7766358, 5138432, 6252613, 3886848, 4804405, 8388352, 13959082, 6208768, 10337662, 4227328, 7045462, 3434496, 5662789, 2576128, 4345653,
    4194048, 12582826, 3063040, 9289086, 2064640, 6324566, 1665024, 5138501, 1265408, 3886901, 65280, 11206570, 48384, 8306046, 33024, 5669206,
    26624, 4548677, 20224, 3493685, 65343, 11206591, 48430, 8306061, 33055, 5669216, 26649, 4548686, 20243, 3493691, 65407, 11206612,
    48478, 8306077, 33088, 5669227, 26676, 4548694, 20263, 3493698, 65471, 11206634, 48525, 8306093, 33120, 5669238, 26702, 4548703,
    20283, 3493705, 65535, 11206655, 48573, 8306109, 33153, 5669249, 26728, 4548712, 20303, 3493711, 49151, 11201279, 36285, 8302013,
    24705, 5666433, 20072, 4546408, 15183, 3492175, 32767, 11195647, 24253, 8297917, 16513, 5663617, 13416, 4544104, 10063, 3490383,
    16383, 11190271, 11965, 8293821, 8065, 5660801, 6504, 4542056, 4943, 3488591, 255, 11184895, 189, 8289981, 129, 5658241,
    104, 4539752, 79, 3487055, 4129023, 12561151, 3014845, 9273021, 2031745, 6313601, 1638504, 5129576, 1245263, 3880271, 8323327, 13937407,
    6160573, 10321597, 4194433, 7034497, 3407976, 5653864, 2555983, 4339023, 12517631, 15379199, 9240765, 11370173, 6291585, 7755393, 5111912, 6243688,
    3866703, 4797775, 16711935, 16755455, 12386493, 12418749, 8454273, 8476289, 6815848, 6833512, 5177423, 5190991, 16711871, 16755434, 12386445, 12418733,
    8454240, 8476278, 6815822, 6833503, 5177403, 5190985, 16711807, 16755412, 12386398, 12418717, 8454208, 8476267, 6815796, 6833494, 5177383, 5190978,
    16711743, 16755391, 12386350, 12418701, 8454175, 8476256, 6815769, 6833486, 5177363, 5190971, 3355443, 5263440, 6908265, 8553090, 12500670, 16777215
];


/* Bounds */

// The [minx, miny, maxx, maxy] of a list of [x, y] points
function pointsBounds(points) {
    const bounds = EMPTY_BOUNDS.slice();
    for (const point of points) {
        bounds[0] = Math.min(bounds[0], point[0]);
        bounds[1] = Math.min(bounds[1], point[1]);
        bounds[2] = Math.max(bounds[2], point[0]);
        bounds[3] = Math.max(bounds[3], point[1]);
    }
    return bounds;
}

function mergeBounds(bounds, other) {
    return [
        Math.min(bounds[0], other[0]), Math.min(bounds[1], other[1]),
        Math.max(bounds[2], other[2]), Math.max(bounds[3], other[3])
    ];
}

function boundsSize(bounds) {
    return Math.max(bounds[2] - bounds[0], bounds[3] - bounds[1]);
}

function boundsCenter(bounds) {
    return [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2];
}


/* Colors */

function packedToHex(value) {
    return "#" + (value & 0xffffff).toString(16).padStart(6, "0");
}

// AutoCAD draws on black, so an ACI black or white mostly means "no color was chosen"
function isDefaultAciColor(value) {
    return value === 0 || value === 0xffffff;
}

// The hex color to draw an entity in, in the precedence the DXF spec: an own 24 bit color, an own color
// number, then BYLAYER/BYBLOCK. layers are the layer table entries, insertColor the color of the placing INSERT.
function resolveColor(entity, insertColor, layers) {
    let colorIndex = entity.colorIndex;
    if (colorIndex === COLOR_BYBLOCK && insertColor !== undefined) {
        return packedToHex(insertColor);
    }
    // An own 24 bit color is a deliberate choice and is used verbatim, black included
    if (entity.color !== undefined && colorIndex !== COLOR_BYLAYER && colorIndex !== COLOR_BYBLOCK) {
        return packedToHex(entity.color);
    }
    if (colorIndex === undefined || colorIndex === COLOR_BYLAYER || colorIndex === COLOR_BYBLOCK) {
        const layer = layers[entity.layer];
        if (layer?.color !== undefined) {
            return isDefaultAciColor(layer.color) ? DXF_DEFAULT_COLOR : packedToHex(layer.color);
        }
        colorIndex = layer?.colorIndex;
    }
    const color = ACI_COLORS[colorIndex];
    if (color === undefined || isDefaultAciColor(color)) {
        return DXF_DEFAULT_COLOR;
    }
    return packedToHex(color);
}


/* Block placement */

// A point of a block's content is first offset by the base point, then scaled, rotated and moved to the
// insertion point. Nested blocks chain these steps
function applyPlacement(point, angle, placements) {
    let x = point[0];
    let y = point[1];
    let rotation = angle;
    let scale = 1;
    for (const placement of placements) {
        x = (x - placement.baseX) * placement.scaleX;
        y = (y - placement.baseY) * placement.scaleY;
        scale *= Math.abs(placement.scaleY);
        if (placement.rotation) {
            const rad = placement.rotation / 180 * Math.PI;
            const rotatedX = x * Math.cos(rad) - y * Math.sin(rad);
            const rotatedY = y * Math.cos(rad) + x * Math.sin(rad);
            x = rotatedX;
            y = rotatedY;
            rotation += rad;
        }
        x += placement.x;
        y += placement.y;
    }
    return {x: x, y: y, rotation: rotation, scale: scale};
}

function placePoints(points, placements) {
    return points.map(point => {
        const placed = applyPlacement(point, 0, placements);
        return [placed.x, placed.y];
    });
}

// Flattens the drawing into a list of {entity, placements, insertColor}, replacing every INSERT by the
// contents of the block it places
function expandBlocks(dxf) {
    const blocks = dxf.blocks ?? {};
    const expanded = [];
    const visit = (entities, placements, insertColor, depth) => {
        for (const entity of entities) {
            if (entity.type !== "INSERT") {
                expanded.push({entity: entity, placements: placements, insertColor: insertColor});
                continue;
            }
            for (const attrib of entity.attribs ?? []) {
                expanded.push({entity: attrib, placements: [], insertColor: insertColor});
            }
            const block = blocks[entity.name];
            if (!block || depth >= MAX_BLOCK_DEPTH) {
                continue;
            }
            // Block content on layer "0" takes the layer of the INSERT, everything else keeps its own
            const contents = (block.entities ?? []).map(blockEntity => (
                blockEntity.layer === "0" ? {...blockEntity, layer: entity.layer} : blockEntity
            ));
            const rotation = entity.rotation ?? 0;
            const cos = Math.cos(rotation / 180 * Math.PI);
            const sin = Math.sin(rotation / 180 * Math.PI);
            const rowSpacing = entity.rowSpacing ?? 0;
            const colSpacing = entity.columnSpacing ?? 0;
            const rows = Math.max(1, entity.rowCount ?? 1);
            const cols = Math.max(1, entity.columnCount ?? 1);
            // An INSERT can place the block once per cell of a rows x columns grid
            for (let row = 0; row < rows; ++row) {
                for (let col = 0; col < cols; ++col) {
                    const placement = {
                        x: entity.position.x - sin * rowSpacing * row + cos * colSpacing * col,
                        y: entity.position.y + cos * rowSpacing * row + sin * colSpacing * col,
                        baseX: block.position?.x ?? 0,
                        baseY: block.position?.y ?? 0,
                        scaleX: entity.xScale ?? 1,
                        scaleY: entity.yScale ?? 1,
                        rotation: rotation
                    };
                    visit(contents, [...placements, placement], entity.color ?? insertColor, depth + 1);
                }
            }
        }
    };
    visit(dxf.entities ?? [], [], undefined, 0);
    return expanded;
}


/* Geometry */

// SIMPLIFACTION
// How many segments an arc of this radius is allowed to have in a drawing of this size
function arcSegments(sweep, radius, drawingSize) {
    const segments = Math.ceil(Math.abs(sweep) / (2 * Math.PI) * ARC_MAX_SEGMENTS);
    if (!(drawingSize > 0)) {
        return Math.max(ARC_MIN_SEGMENTS, segments);
    }
    const share = Math.min(1, radius / (drawingSize * ARC_FULL_RESOLUTION_RADIUS));
    return Math.max(ARC_MIN_SEGMENTS, Math.min(segments, Math.ceil(segments * share)));
}

// The points between two polyline vertices joined by a bulge, which is the tangent of a quarter of the sweep
function interpolateBulge(from, to, bulge, drawingSize) {
    const sweep = 4 * Math.atan(bulge);
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const chord = Math.hypot(dx, dy);
    if (chord === 0) {
        return [];
    }
    const radius = chord / (2 * Math.sin(sweep / 2));
    const centerX = (from[0] + to[0]) / 2 - dy / chord * radius * Math.cos(sweep / 2);
    const centerY = (from[1] + to[1]) / 2 + dx / chord * radius * Math.cos(sweep / 2);
    const startAngle = Math.atan2(from[1] - centerY, from[0] - centerX);
    const steps = arcSegments(sweep, Math.abs(radius), drawingSize);
    const points = [];
    for (let i = 1; i < steps; ++i) {
        const angle = startAngle + sweep * i / steps;
        points.push([centerX + Math.abs(radius) * Math.cos(angle), centerY + Math.abs(radius) * Math.sin(angle)]);
    }
    return points;
}

function verticesToPoints(vertices, closed, drawingSize) {
    const points = [];
    for (let i = 0; i < vertices.length; ++i) {
        const vertex = vertices[i];
        points.push([vertex.x, vertex.y]);
        // The bulge of the last vertex leads back to the first one, which only exists on a closed shape
        if (vertex.bulge && (closed || i < vertices.length - 1)) {
            const next = vertices[(i + 1) % vertices.length];
            points.push(...interpolateBulge([vertex.x, vertex.y], [next.x, next.y], vertex.bulge, drawingSize));
        }
    }
    if (closed && vertices.length > 1) {
        points.push([vertices[0].x, vertices[0].y]);
    }
    return points;
}

// Arcs are interpolated here rather than by the parser
function arcToPoints(centerX, centerY, radiusX, radiusY, startAngle, endAngle, drawingSize) {
    let sweep = endAngle - startAngle;
    while (sweep <= 0) {
        sweep += 2 * Math.PI;
    }
    const steps = arcSegments(sweep, Math.max(radiusX, radiusY), drawingSize);
    const points = [];
    for (let i = 0; i <= steps; ++i) {
        const angle = startAngle + sweep * i / steps;
        points.push([centerX + radiusX * Math.cos(angle), centerY + radiusY * Math.sin(angle)]);
    }
    return points;
}

function ellipseToPoints(entity, drawingSize) {
    const majorX = entity.majorAxisEndPoint?.x ?? 0;
    const majorY = entity.majorAxisEndPoint?.y ?? 0;
    const radiusX = Math.hypot(majorX, majorY);
    const radiusY = radiusX * (entity.axisRatio ?? 1);
    const points = arcToPoints(0, 0, radiusX, radiusY, entity.startAngle ?? 0, entity.endAngle ?? 2 * Math.PI, drawingSize);
    // The arc is built axis parallel and then turned into the direction of the major axis
    const tilt = Math.atan2(majorY, entity.majorAxisEndPoint?.x ?? 1);
    return points.map(point => [
        entity.center.x + point[0] * Math.cos(tilt) - point[1] * Math.sin(tilt),
        entity.center.y + point[1] * Math.cos(tilt) + point[0] * Math.sin(tilt)
    ]);
}

// The point run of an entity, still in block coordinates
function entityToPoints(entity, drawingSize) {
    switch (entity.type) {
    case "LINE":
        return (entity.vertices ?? []).map(vertex => [vertex.x, vertex.y]);
    case "LWPOLYLINE":
    case "POLYLINE":
        return verticesToPoints(entity.vertices ?? [], entity.shape === true || entity.closed === true, drawingSize);
    case "CIRCLE":
        return arcToPoints(entity.center.x, entity.center.y, entity.radius, entity.radius, 0, 2 * Math.PI, drawingSize);
    case "ARC":
        return arcToPoints(entity.center.x, entity.center.y, entity.radius, entity.radius, entity.startAngle, entity.endAngle, drawingSize);
    case "ELLIPSE":
        return ellipseToPoints(entity, drawingSize);
    case "SOLID":
    case "3DFACE": {
        // The four corners are given in Z order, not around the outline
        const corners = (entity.points ?? []).map(vertex => [vertex.x, vertex.y]);
        if (corners.length === 4) {
            return [corners[0], corners[1], corners[3], corners[2], corners[0]];
        }
        return [...corners, corners[0]].filter(Boolean);
    }
    case "POINT":
        return entity.position ? [[entity.position.x, entity.position.y]] : [];
    default:
        return [];
    }
}

// The reference points of an entity
function entityReferencePoints(entity) {
    if (entity.center && entity.radius !== undefined) {
        return [
            [entity.center.x - entity.radius, entity.center.y - entity.radius],
            [entity.center.x + entity.radius, entity.center.y + entity.radius]
        ];
    }
    if (entity.center) {
        return [[entity.center.x, entity.center.y]];
    }
    const points = entity.vertices ?? entity.points ?? [entity.position, entity.startPoint].filter(Boolean);
    return points.map(point => [point.x, point.y]);
}

// A fast estimate of the drawing extent as base for simplications
function drawingSizeOf(entities) {
    let bounds = EMPTY_BOUNDS;
    for (const entry of entities) {
        const points = placePoints(entityReferencePoints(entry.entity), entry.placements);
        bounds = mergeBounds(bounds, pointsBounds(points));
    }
    const size = boundsSize(bounds);
    return Number.isFinite(size) ? size : 0;
}


/* Hatch boundaries */

// A boundary loop can be built from edges rather than from a polyline
function edgeToPoints(edge, drawingSize) {
    if (edge.type === "line") {
        return [[edge.start.x, edge.start.y], [edge.end.x, edge.end.y]];
    }
    if (edge.type !== "arc" && edge.type !== "ellipse") {
        return [];
    }
    const radiusX = edge.type === "arc" ? edge.radius : Math.hypot(edge.majorAxisEndPoint?.x ?? 0, edge.majorAxisEndPoint?.y ?? 0);
    const radiusY = edge.type === "arc" ? edge.radius : radiusX * (edge.axisRatio ?? 1);
    const startAngle = edge.startAngle ?? 0;
    let sweep = (edge.endAngle ?? 0) - startAngle;
    while (sweep <= 0) {
        sweep += 2 * Math.PI;
    }
    const direction = edge.ccw === false ? -1 : 1;
    const steps = arcSegments(sweep, Math.max(radiusX, radiusY), drawingSize);
    const points = [];
    for (let i = 0; i <= steps; ++i) {
        const angle = startAngle + direction * sweep * i / steps;
        points.push([edge.center.x + radiusX * Math.cos(angle), edge.center.y + radiusY * Math.sin(angle)]);
    }
    return points;
}

function boundaryToRing(path, drawingSize) {
    if (path.polylineVertices) {
        // A boundary polyline is a loop, so the bulge of its last vertex leads back to the first one
        return verticesToPoints(path.polylineVertices, true, drawingSize);
    }
    const points = [];
    for (const edge of path.edges ?? []) {
        points.push(...edgeToPoints(edge, drawingSize));
    }
    return points;
}

function perpendicularDistance(point, start, end) {
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const length = Math.hypot(dx, dy);
    if (length === 0) {
        return Math.hypot(point[0] - start[0], point[1] - start[1]);
    }
    return Math.abs(dy * point[0] - dx * point[1] + end[0] * start[1] - end[1] * start[0]) / length;
}

// Douglas-Peucker on an open point list
function simplifyPoints(points, tolerance) {
    if (points.length < 3) {
        return points;
    }
    const start = points[0];
    const end = points[points.length - 1];
    let farthest = 0;
    let maxDistance = 0;
    for (let i = 1; i < points.length - 1; ++i) {
        const distance = perpendicularDistance(points[i], start, end);
        if (distance > maxDistance) {
            maxDistance = distance;
            farthest = i;
        }
    }
    if (maxDistance <= tolerance) {
        return [start, end];
    }
    const head = simplifyPoints(points.slice(0, farthest + 1), tolerance);
    const tail = simplifyPoints(points.slice(farthest), tolerance);
    // The point the list was split at is the last of the head and the first of the tail
    return [...head.slice(0, -1), ...tail];
}

// Index of the ring vertex farthest away from the ring start
function oppositeVertex(ring) {
    let opposite = 0;
    let maxDistance = -1;
    for (let i = 0; i < ring.length; ++i) {
        const distance = Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1]);
        if (distance > maxDistance) {
            maxDistance = distance;
            opposite = i;
        }
    }
    return opposite;
}

function simplifyRing(ring) {
    const extent = boundsSize(pointsBounds(ring));
    if (!(extent > 0) || ring.length < 5) {
        return ring;
    }
    // Split the closed ring at its farthest vertex, so that neither half is a near straight line
    const opposite = oppositeVertex(ring);
    const tolerance = extent * RING_SIMPLIFY_TOLERANCE;
    const head = simplifyPoints(ring.slice(0, opposite + 1), tolerance);
    const tail = simplifyPoints(ring.slice(opposite), tolerance);
    const simplified = [...head.slice(0, -1), ...tail];
    // Never simplify a ring out of existence
    return simplified.length >= 4 ? simplified : ring;
}

function hatchRings(entity, placements, drawingSize) {
    const rings = [];
    for (const path of entity.boundaryPaths ?? []) {
        const ring = placePoints(boundaryToRing(path, drawingSize), placements);
        if (ring.length === 0) {
            continue;
        }
        const last = ring[ring.length - 1];
        if (ring[0][0] !== last[0] || ring[0][1] !== last[1]) {
            ring.push(ring[0]);
        }
        if (ring.length >= 4) {
            rings.push(simplifyRing(ring));
        }
    }
    return rings;
}


/* Text */

function decodeControlCodes(text) {
    return text.replace(/%%(.)/g, (match, code) => {
        if (code === "%") {
            return "%";
        } else if (CONTROL_CODE_CHARS[code.toLowerCase()]) {
            return CONTROL_CODE_CHARS[code.toLowerCase()];
        } else if (CONTROL_CODE_TOGGLES.includes(code)) {
            return "";
        }
        // Leave anything unrecognized alone rather than swallowing text
        return match;
    });
}

// MTEXT content is not plain text which is discarded here
function stripMTextFormatting(text) {
    return text.replace(MTEXT_INLINE_CODES, (match, literal, stacked) => {
        if (literal !== undefined) {
            return literal;
        } else if (stacked !== undefined) {
            // Stacked text is flattened to a plain fraction
            return stacked.split(/[\^#/]/).filter(Boolean).join("/");
        } else if (match === "\\P" || match === "\\X") {
            return "\n";
        } else if (match === "\\~") {
            return " ";
        }
        // Formatting codes and the grouping braces carry no content
        return "";
    });
}

function textContent(entity) {
    const raw = entity.text || "";
    const text = entity.type === "MTEXT" ? stripMTextFormatting(raw) : raw;
    return unescapeDxfUnicode(decodeControlCodes(text));
}

function textHeight(entity) {
    // MTEXT names its height differently from TEXT and ATTRIB
    const own = entity.textHeight ?? entity.height;
    if (own !== undefined) {
        return own;
    }
    const override = MTEXT_HEIGHT_OVERRIDE.exec(entity.text ?? "");
    return override ? parseFloat(override[1]) : 0;
}

// The MTEXT rotation is radians per the DXF spec but degrees as QGIS Server writes it. A rotation past a
// full turn is meaningless in radians, so one such value gives the writer away for the whole document.
function mtextRotationIsDegrees(entities) {
    return entities.some(entry => entry.entity.type === "MTEXT" && Math.abs(entry.entity.rotation ?? 0) > 2 * Math.PI);
}

// The position, rotation and height of a text entity in world coordinates
function textPlacement(entity, placements, mtextInDegrees) {
    const isMText = entity.type === "MTEXT";
    // A TEXT/ATTRIB with an alignment is positioned by its alignment point instead of by its start point
    const aligned = !isMText && (entity.halign || entity.valign) && entity.endPoint;
    const origin = isMText ? entity.position : (aligned ? entity.endPoint : entity.startPoint);
    const rotation = entity.rotation ?? 0;
    let angle = isMText && !mtextInDegrees ? rotation : rotation / 180 * Math.PI;
    if (isMText && entity.directionVector) {
        angle = Math.atan2(entity.directionVector.y ?? 0, entity.directionVector.x ?? 1);
    }
    const placed = applyPlacement([origin?.x ?? 0, origin?.y ?? 0], angle, placements);
    return {
        x: placed.x,
        y: placed.y,
        rotation: placed.rotation % (2 * Math.PI),
        height: textHeight(entity) * placed.scale
    };
}

function textScale(height, medianHeight) {
    if (!(medianHeight > 0) || !(height > 0)) {
        return TEXT_SCALE_NORMAL;
    }
    if (height < TEXT_SMALL_FRACTION * medianHeight) {
        return TEXT_SCALE_SMALL;
    }
    if (height > TEXT_LARGE_FRACTION * medianHeight) {
        return TEXT_SCALE_LARGE;
    }
    return TEXT_SCALE_NORMAL;
}

function isVisibleAttribute(entity) {
    const flags = Number(entity.attributeFlags ?? (entity.invisible ? ATTRIBUTE_INVISIBLE : 0));
    return !(flags & ATTRIBUTE_INVISIBLE);
}


/* Features */

function lineFeatures(entities, layers, crs, drawingSize) {
    const features = [];
    for (const entry of entities) {
        if (!LINE_ENTITIES.includes(entry.entity.type)) {
            continue;
        }
        const points = placePoints(entityToPoints(entry.entity, drawingSize), entry.placements);
        if (points.length < 2) {
            continue;
        }
        features.push({
            type: "Feature",
            crs: crs,
            geometry: {type: "LineString", coordinates: points},
            properties: {layer: unescapeDxfUnicode(entry.entity.layer ?? "")},
            styleName: "default",
            styleOptions: {
                strokeColor: resolveColor(entry.entity, entry.insertColor, layers),
                strokeWidth: 1,
                strokeDash: [],
                fillColor: [0, 0, 0, 0],
                circleRadius: 0
            }
        });
    }
    return features;
}

// SIMPLIFACTION
// Hatches become solid fills, except for the ones which are really point symbols: a block instance repeated
// all over a layer and far too small to ever be seen as an area is collapsed to a marker instead. lineBounds
// are the bounds of the line features, needed to know how large the drawing is in total.
function hatchFeatures(entities, layers, crs, lineBounds, drawingSize) {
    const hatches = [];
    let bounds = lineBounds;
    for (const entry of entities) {
        if (entry.entity.type !== "HATCH") {
            continue;
        }
        const rings = hatchRings(entry.entity, entry.placements, drawingSize);
        if (isEmpty(rings)) {
            continue;
        }
        const outline = pointsBounds(rings[0]);
        hatches.push({entry: entry, rings: rings, outline: outline, small: false});
        bounds = mergeBounds(bounds, outline);
    }
    // Count the symbol candidates per layer, so that no layer is drawn half as outlines and half as markers
    const maxSymbolSize = boundsSize(bounds) * SYMBOL_MAX_EXTENT;
    const candidatesPerLayer = {};
    for (const hatch of hatches) {
        hatch.small = !isEmpty(hatch.entry.placements) && boundsSize(hatch.outline) < maxSymbolSize;
        if (hatch.small) {
            const layer = hatch.entry.entity.layer;
            candidatesPerLayer[layer] = (candidatesPerLayer[layer] ?? 0) + 1;
        }
    }
    const features = [];
    let symbolCount = 0;
    for (const hatch of hatches) {
        const isSymbol = hatch.small && candidatesPerLayer[hatch.entry.entity.layer] >= SYMBOL_MIN_PER_LAYER;
        if (isSymbol) {
            symbolCount += 1;
        }
        const color = resolveColor(hatch.entry.entity, hatch.entry.insertColor, layers);
        features.push({
            type: "Feature",
            crs: crs,
            geometry: isSymbol
                ? {type: "Point", coordinates: boundsCenter(hatch.outline)}
                : {type: "Polygon", coordinates: hatch.rings},
            properties: {layer: unescapeDxfUnicode(hatch.entry.entity.layer ?? "")},
            styleName: "default",
            styleOptions: {
                strokeColor: color,
                strokeWidth: 1,
                strokeDash: [],
                fillColor: color,
                circleRadius: isSymbol ? SYMBOL_RADIUS : 0
            }
        });
    }
    return {features: features, symbolCount: symbolCount};
}

function textFeatures(entities, layers, crs) {
    const candidates = entities.filter(entry => (
        TEXT_ENTITIES.includes(entry.entity.type) &&
        (entry.entity.type !== "ATTRIB" || isVisibleAttribute(entry.entity))
    ));
    const mtextInDegrees = mtextRotationIsDegrees(candidates);
    const labels = [];
    for (const entry of candidates) {
        const text = textContent(entry.entity);
        if (text.trim() === "") {
            continue;
        }
        labels.push({
            entry: entry,
            text: text,
            placement: textPlacement(entry.entity, entry.placements, mtextInDegrees)
        });
    }
    const heights = labels.map(label => label.placement.height).filter(height => height > 0).sort((a, b) => a - b);
    const medianHeight = heights.length > 0 ? heights[Math.floor(heights.length / 2)] : 0;
    return labels.map(label => {
        const color = resolveColor(label.entry.entity, label.entry.insertColor, layers);
        const halo = MiscUtils.isBrightColor(color) ? '#333333' : '#FFFFFF';
        return {
            type: "Feature",
            crs: crs,
            geometry: {type: "Point", coordinates: [label.placement.x, label.placement.y]},
            properties: {
                label: label.text,
                rotation: -label.placement.rotation,
                layer: unescapeDxfUnicode(label.entry.entity.layer ?? "")
            },
            styleName: "text",
            styleOptions: {
                strokeWidth: textScale(label.placement.height, medianHeight),
                fillColor: color,
                strokeColor: halo,
                textFill: color,
                textStroke: halo
            }
        };
    });
}


/* Output */

// SIMPLIFICATION
// The number of decimals which keeps the rounding error below COORDINATE_PRECISION of the drawing extent
function coordinateDecimals(drawingSize) {
    const decimals = Math.ceil(-Math.log10(Math.max(drawingSize, 1) * COORDINATE_PRECISION));
    return Math.max(0, Math.min(12, decimals));
}

function roundPoint(point, decimals) {
    return [Number(point[0].toFixed(decimals)), Number(point[1].toFixed(decimals))];
}

function roundGeometry(geometry, decimals) {
    if (geometry.type === "Point") {
        return {...geometry, coordinates: roundPoint(geometry.coordinates, decimals)};
    } else if (geometry.type === "LineString") {
        return {...geometry, coordinates: geometry.coordinates.map(point => roundPoint(point, decimals))};
    }
    // Polygon
    return {...geometry, coordinates: geometry.coordinates.map(ring => ring.map(point => roundPoint(point, decimals)))};
}

export async function dxfToFeatures(text, crs) {
    const {parseDxf} = await import('dxf-render/parser');
    const dxf = parseDxf(text);
    const layers = dxf.tables?.layer?.layers ?? {};
    const entities = expandBlocks(dxf);
    const drawingSize = drawingSizeOf(entities);

    const lines = lineFeatures(entities, layers, crs, drawingSize);
    let lineBounds = EMPTY_BOUNDS;
    for (const line of lines) {
        lineBounds = mergeBounds(lineBounds, pointsBounds(line.geometry.coordinates));
    }
    const hatches = hatchFeatures(entities, layers, crs, lineBounds, drawingSize);
    const labels = textFeatures(entities, layers, crs);

    const decimals = coordinateDecimals(drawingSize);
    const features = [...hatches.features, ...lines, ...labels].map((feature, idx) => ({
        ...feature,
        id: idx,
        geometry: roundGeometry(feature.geometry, decimals)
    }));
    return {features: features, symbolCount: hatches.symbolCount};
}
