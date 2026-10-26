#!/usr/bin/env node

/**
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Sorts the properties of the JSON schemas in schemas/ alphabetically, at every level, so that the generated documentation lists them in that order.
// With --check, only lists the schemas which are not sorted, and fails if there are any.

const fs = require('fs');
const path = require('path');

const schemaDir = path.join(__dirname, '..', 'schemas');

// Keywords whose value is a schema or a list of schemas
const subschemaKeywords = ["additionalItems", "additionalProperties", "allOf", "anyOf", "contains", "else", "if", "items", "not", "oneOf", "propertyNames", "then"];
// Keywords whose value maps names to schemas (or, for dependencies, also to lists of property names)
const schemaMapKeywords = ["$defs", "definitions", "dependencies", "patternProperties", "properties"];

const sortSchema = (schema) => {
    if (Array.isArray(schema)) {
        return schema.map(sortSchema);
    }
    if (typeof schema !== "object" || schema === null) {
        return schema;
    }
    return Object.fromEntries(Object.entries(schema).map(([key, value]) => {
        if (subschemaKeywords.includes(key)) {
            return [key, sortSchema(value)];
        } else if (schemaMapKeywords.includes(key)) {
            const names = key === "properties" ? Object.keys(value).sort((a, b) => a.localeCompare(b, "en")) : Object.keys(value);
            return [key, Object.fromEntries(names.map(name => [name, sortSchema(value[name])]))];
        }
        return [key, value];
    }));
};

const check = process.argv.includes("--check");
const unsorted = [];
for (const filename of fs.readdirSync(schemaDir).filter(name => name.endsWith(".json")).sort()) {
    const filepath = path.join(schemaDir, filename);
    const text = fs.readFileSync(filepath, "utf8");
    const sorted = JSON.stringify(sortSchema(JSON.parse(text)), null, 4) + "\n";
    if (sorted !== text) {
        unsorted.push(filename);
        if (!check) {
            fs.writeFileSync(filepath, sorted);
        }
    }
}
if (check && unsorted.length > 0) {
    process.stderr.write("Schema properties not sorted alphabetically in: " + unsorted.join(", ") + "\nRun npm run schemasort to sort them.\n");
    process.exit(1);
}
