/**
 * @typedef {('and' | 'or')} JoinOperator Data Service Join Operator
 * @typedef {string} SubExpressionLefthand Data Service left-hand filter
 * @typedef {string} SubExpressionOperator Data Service operator (e.g. ilike, =, etc.)
 * @typedef {string | number | string[] | null} SubExpressionValue Data Service right-hand expression (ie. value)
 * @typedef {[SubExpressionLefthand, SubExpressionOperator, SubExpressionValue]} SubExpression Service subexpression
 * @typedef {(DataServiceExpression | JoinOperator)[]} ExpressionArray Expressions joined by operators
 * @typedef {SubExpression | ExpressionArray} DataServiceExpression Data Service Expression
 */

const DataServiceExprUtils = {
    /**
     * Replaces variable placeholders in a Data Service Expression
     * @param {DataServiceExpression} expr Expression
     * @param {Object<string, any>} values Key-values dictionary
     * @param {Object<string, any>} defaultValues Key-values dictionary of default values
     * @returns {DataServiceExpression | null} Expression with placeholders replaced, or `null` if invalid
     */
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

    /**
     * Formats a valid Data Service Expression into a string
     * @param {DataServiceExpression} expr Expression
     * @returns {string} Formatted expression
     */
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

    /**
     * Builds the query filter for a Data Service Expression
     * @param {DataServiceExpression} filters Filters
     * @returns {string} Formatted query
     */
    buildFilter(filters) {
        return filters.map(expr => Array.isArray(expr) ? DataServiceExprUtils.formatFilterExpr(expr) : "AND").join(" ");
    },

    /**
     * Computes whether a Data Service Expression is valid and simple: use simple operators (ILIKE, =, etc.), joined via AND
     * @param {DataServiceExpression} expr Expression
     * @returns {boolean} `true` if the expression is simple
     */
    isSimpleExpr(expr) {
        if (expr.length < 3 || (expr.length % 2) === 0 || typeof expr[1] !== 'string') {
            // Invalid expression: array must have at least three and odd number of entries,
            // mid entry must be a string (operator)
            return false;
        }
        if (typeof expr[0] === 'string') {
            const op = expr[1].toLowerCase();
            const simpleOperators = ['ilike', '=', '<', '=<', '>=', '!='];
            return simpleOperators.includes(op) && typeof expr[2] === 'string';
        } else {
            const isAnd = (entry) => String(entry).toLowerCase() === "and";
            const invalid = expr.any((entry, idx) => (idx % 2) === 0 ? !Array.isArray(entry) : !isAnd(entry));
            if (invalid) {
                return false;
            }
            return expr.every((entry, idx) => (idx % 2) === 0 ? this.isSimpleExpr(entry) : String(entry).toLowerCase() === 'and');
        }
    },

    /**
     * Removes empty subexpressions from a valid simple Data Service Expression.
     * This is useful when the expression searches among multiple fields but the user
     * selected only a subset of those fields.
     * @param {DataServiceExpression} expr Expression
     * @returns {DataServiceExpression} Filtered expression
     */
    removeEmptySubexpressions(expr) {
        if (typeof expr[0] === 'string') {
            if (expr[2] === "" || expr[2] === "%" || expr[2] === "%%") {
                // Empty search expression, remove it
                return null;
            }
            return expr;
        } else {
            const filtered = expr
                .map(
                    (entry, idx) => (idx % 2) === 0 ? this.removeEmptySubexpressions(entry) : null // don't care about the operators, we know they're all AND
                )
                .filter((entry) => entry !== null)
                .reduce(
                    (acc, entry, index) => {
                        // Add back AND operators
                        if (index > 0) acc.push("AND");
                        acc.push(entry);
                        return acc;
                    }, []
                );
            return filtered;
        }
    }
};
export default DataServiceExprUtils;
