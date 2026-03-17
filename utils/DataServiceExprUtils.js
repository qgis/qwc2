/**
 * @typedef {('and' | 'or')} JoinOperator Data Service Join Operator
 * @typedef {string} SubExpressionLefthand Data Service left-hand filter
 * @typedef {string} SubExpressionOperator Data Service operator (e.g. ilike, =, etc.)
 * @typedef {string | number | string[]} SubExpressionValue Data Service right-hand expression (ie. value)
 * @typedef {[SubExpressionLefthand, SubExpressionOperator, SubExpressionValue]} SubExpression Service subexpression
 * @typedef {(DataServiceExpression | JoinOperator)[]} ExpressionArray Expressions joined by operators - Expressions can be SubExpression (e.g. `["<name>", "<op>", <value>]`) or an array of complex expressions (e.g. `[["<name>", "<op>", <value>],"and|or",["<name>","<op>",<value>],...]`)
 * @typedef {SubExpression | ExpressionArray} DataServiceExpression Data Service Expression - Can be a SubExpression (e.g. `["<name>", "<op>", <value>]`) or an array of complex expressions (e.g. `[["<name>", "<op>", <value>],"and|or",["<name>","<op>",<value>],...]`)
 */

const DataServiceExprUtils = {
    isSubExpression(expr) {
        return Array.isArray(expr) && expr.length === 3 && typeof expr[0] === "string";
    },
    isJoinOperator(expr) {
        return typeof(expr) === "string" && ["and", "or"].includes(expr.toLowerCase());
    },

    /**
     * Returns whether a DataServiceExpression is valid or not
     * @param {DataServiceExpression} expr Expression
     * @returns {boolean}
     */
    isValid(expr) {
        if (!Array.isArray(expr)) {
            return false;
        }

        if (this.isSubExpression(expr)) {
            return true;
        } else {
            if ((expr.length % 2) === 0) {
                // Invalid expression: array must have odd number of entries (can be 1)
                return null;
            }

            // Even indices must be DataServiceExpression, odd must be and|or strings
            return expr.every((entry, idx) => (idx % 2) === 0 ? this.isValid(entry) : this.isJoinOperator(entry));
        }
    },

    /**
     * Replaces variable placeholders in a Data Service Expression
     * @param {DataServiceExpression} expr Expression
     * @param {Object<string, any>} values Key-values dictionary
     * @param {Object<string, any>} defaultValues Key-values dictionary of default values
     * @returns {DataServiceExpression | null} Expression with placeholders replaced, or `null` if invalid
     */
    replaceExpressionVariables(expr, values, defaultValues) {
        if (!this.isValid(expr)) return null;

        if (this.isSubExpression(expr)) {
            const op = expr[1].toLowerCase();
            if (typeof expr[2] === 'string') {
                const right = Object.entries(values).reduce((res, [key, value]) => res.replace(`$${key}$`, (value || defaultValues[key]) ?? value), expr[2]);
                return [expr[0], op, right];
            } else {
                return [expr[0], op, expr[2]];
            }
        } else {
            return expr.map((entry, idx) => (idx % 2) === 0 ? this.replaceExpressionVariables(entry, values, defaultValues) : entry);
        }
    },

    /**
     * Formats a valid expression array into a string
     * @param {DataServiceExpression} expr Expression
     * @returns {string} Formatted expression
     */
    formatFilterExpr(expr) {
        if (this.isSubExpression(expr)) {
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
            return "( " + expr.map((entry, idx) => (idx % 2) === 0 ? this.formatFilterExpr(entry) : entry.toUpperCase()).join(" ") + " )";
        }
    },

    /**
     * Builds the query filter for a DataServiceExpression
     * @param {DataServiceExpression} filters Filters
     * @returns {string} Formatted query
     */
    buildFilter(filters) {
        if (this.isSubExpression(filters)) {
            return this.formatFilterExpr(filters);
        } else {
            return filters.map((entry, idx) => (idx % 2) === 0 ? this.formatFilterExpr(entry) : entry.toUpperCase()).join(" ");
        }
    },

    /**
     * Computes whether a DataServiceExpression is valid and simple: use simple operators (ILIKE, =, etc.), joined via AND
     * @param {DataServiceExpression} expr Expression
     * @returns {boolean} `true` if the expression is simple
     */
    isSimpleExpr(expr) {
        if (this.isSubExpression(expr)) {
            const op = expr[1].toLowerCase();
            const simpleOperators = ['ilike', '=', '<', '=<', '>=', '!='];
            return simpleOperators.includes(op) && typeof expr[2] === 'string';
        } else {
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
        if (this.isSubExpression(expr)) {
            if (expr[2] === "" || expr[2] === "%" || expr[2] === "%%") {
                // Empty search expression, remove it
                return null;
            }
            return expr;
        } else {
            const filtered = expr
                .map(
                    // don't care about the operators, we know they're all AND
                    // we'll add them back before returning
                    (entry, idx) => (idx % 2) === 0 ? this.removeEmptySubexpressions(entry) : null
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
