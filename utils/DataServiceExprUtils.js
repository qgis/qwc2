const DataServiceExprUtils = {
    replaceExpressionVariables(expr, values, defaultValues) {
        if (expr.length < 3 || (expr.length % 2) === 0 || typeof expr[1] !== 'string') {
            // Invalid expression: array must have at least three and odd number of entries,
            // mid entry must be a string (operator)
            return null;
        }
        if (typeof expr[0] === 'string') {
            const op = expr[1].toLowerCase();
            if (typeof expr[2] === 'string') {
                const right = Object.entries(values).reduce((res, [key, value]) => res.replace(`$${key}$`, (value || defaultValues[key]) ?? value), expr[2]);
                return [expr[0], op, right];
            } else {
                return [expr[0], op, expr[2]];
            }
        } else {
            // Even indices must be arrays, odd and|or strings
            const isAndOr = (entry) => ["and", "or"].includes(String(entry).toLowerCase());
            const invalid = expr.find((entry, idx) => (idx % 2) === 0 ? !Array.isArray(entry) : !isAndOr(entry));
            if (invalid) {
                return null;
            }
            return expr.map((entry, idx) => (idx % 2) === 0 ? this.replaceExpressionVariables(entry, values, defaultValues) : entry);
        }
    },
    formatFilterExpr(expr) {
        if (expr.length === 3 && typeof expr[0] === "string") {
            const op = expr[1].toUpperCase();
            if (typeof expr[2] === "number") {
                return `"${expr[0]}" ${op} ${expr[2]}`;
            } else if (expr[2] === null) {
                return `"${expr[0]}" ${op} NULL`;
            } else if (Array.isArray(expr[2])) {
                return `"${expr[0]}" ${op} ( ${expr[2].join(' , ')} )`;
            } else {
                return `"${expr[0]}" ${op} '${expr[2].replace("'", "\\'")}'`;
            }
        } else {
            return "( " + expr.map(entry => Array.isArray(entry) ? this.formatFilterExpr(entry) : entry.toUpperCase()).join(" ") + " )";
        }
    },
    isSimpleExpr(expr) {
        // Simple expressions are expressions that only use simple operators (ILIKE, =, etc.), joined via AND
        if (expr.length < 3 || (expr.length % 2) === 0 || typeof expr[1] !== 'string') {
            // Invalid expression: array must have at least three and odd number of entries,
            // mid entry must be a string (operator)
            return false;
        }
        if (typeof expr[0] === 'string') {
            const op = expr[1].toLowerCase();
            const simpleOperators = ['ilike', '=', '<', '=<', '>=', '!='];
            return simpleOperators.includes(op) && typeof expr[3] !== 'string';
        } else {
            const isAnd = (entry) => String(entry).toLowerCase() === "and";
            const invalid = expr.any((entry, idx) => (idx % 2) === 0 ? !Array.isArray(entry) : !isAnd(entry));
            if (invalid) {
                return false;
            }
            return expr.every((entry, idx) => (idx % 2) === 0 ? this.isSimpleExpr(entry) : String(entry).toLowerCase() === 'and');
        }
    },
    removeEmptyExpr(expr) {
        // Assumes isSimpleExpr is true!
        if (typeof expr[0] === 'string') {
            if (expr[2] === "" || expr[2] === "%" || expr[2] === "%%") {
                // Empty search expression, remove it
                return null;
            }
            return expr;
        } else {
            const filtered = expr
                .map(
                    (entry, idx) => (idx % 2) === 0 ? this.removeEmptyExpr(entry) : null // don't care about the operators, we know they're all AND
                )
                .filter(
                    (entry) => entry !== null
                )
                .reduce(
                    (acc, entry, index) => {
                        // Add back operators
                        if (index > 0) acc.push("AND");
                        acc.push(entry);
                        return acc;
                    }, []
                );
            return filtered;
        }
    },
    buildFilter(filters) {
        return filters.map(expr => Array.isArray(expr) ? DataServiceExprUtils.formatFilterExpr(expr) : "AND").join(" ");
    }
};
export default DataServiceExprUtils;
