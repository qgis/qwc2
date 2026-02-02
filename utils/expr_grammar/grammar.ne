@builtin "string.ne"

@{%

if (typeof window === 'undefined') {
    window = global;
}
function asFilter(d) {
    return window.qwc2ExpressionParserContext.asFilter && ["string", "object"].includes(typeof(d[0]));
}
function generateUUID() {
    let d = new Date().getTime();
    let d2 = ((typeof performance !== 'undefined') && performance.now && (performance.now()*1000)) || 0;
    const result = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        let r = Math.random() * 16;
        if(d > 0){
            r = (d + r)%16 | 0;
            d = Math.floor(d/16);
        } else {
            r = (d2 + r)%16 | 0;
            d2 = Math.floor(d2/16);
        }
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    return '{' + result + '}';
}
function replaceWildcards(str) {
    return "^" + str.replace(/(?<!\\)%/g, '.*').replace(/(?<!\\)_/g, '.{1}') + "$";
}
%}

main -> _ P0 _                     {% function(d) {return d[1]; } %}

# Priority-0 operators (OR)
P0 -> P0 _ "OR"i _ P1              {% function(d) { return asFilter(d) ? [d[0], d[2], d[4]] : (d[0] || d[4]); } %}
    | P1                           {% id %}

# Priority-1 operators (AND)
P1 -> P1 _ "AND"i _ P2             {% function(d) { return asFilter(d) ? [d[0], d[2], d[4]] : (d[0] && d[4]); } %}
    | P2                           {% id %}

# Priority-2 operators (comparison operators)
P2 -> P2 _ "<" _ P3                {% function(d) { return asFilter(d) ? [d[0], d[2], d[4]] : (d[0] < d[4]); } %}
    | P2 _ ">" _ P3                {% function(d) { return asFilter(d) ? [d[0], d[2], d[4]] : (d[0] > d[4]); } %}
    | P2 _ ">=" _ P3               {% function(d) { return asFilter(d) ? [d[0], d[2], d[4]] : (d[0] >= d[4]); } %}
    | P2 _ "<=" _ P3               {% function(d) { return asFilter(d) ? [d[0], d[2], d[4]] : (d[0] <= d[4]); } %}
    | P2 _ "=" _ P3                {% function(d) { return asFilter(d) ? [d[0], d[2], d[4]] : (d[0] == d[4]); } %}
    | P2 _ "<>" _ P3               {% function(d) { return asFilter(d) ? [d[0], "!=", d[4]] : (d[0] != d[4]); } %}
    | P2 _ "IS"i _ P3              {% function(d) { return asFilter(d) ? [d[0], "=", d[4]] : d[0] === d[4]; } %}
    | P2 _ "IS"i _ "NOT"i _ P3     {% function(d) { return asFilter(d) ? [d[0], "!=", d[6]] : d[0] !== d[6]; } %}
    | P2 _ "~" _ P3                {% function(d) { return asFilter(d) ? [d[0], "~", d[4]] : new RegExp(d[4]).exec(d[0]) !== null; } %}
    | P2 _ "LIKE"i _ P3             {% function(d) { return asFilter(d) ? [d[0], "LIKE", d[4]] : new RegExp(replaceWildcards(d[4])).exec(d[0]) !== null; } %}
    | P2 _ "ILIKE"i _ P3            {% function(d) { return asFilter(d) ? [d[0], "ILIKE", d[4]] : new RegExp(replaceWildcards(d[4]), 'i').exec(d[0]) !== null; } %}
    | P3                           {% id %}

# Priority-3 operators (addition, subtraction, concatenation)
P3 -> P3 _ "+" _ P4                {% function(d) { return d[0] + d[4]; } %}
    | P3 _ "-" _ P4                {% function(d) { return d[0] - d[4]; } %}
    | P3 _ "||" _ P4               {% function(d) { return d[0].concat(d[4]); } %}
    | P4                           {% id %}

# Priority-4 operators (multiplication, division)
P4 -> P4 _ "*" _ P5                {% function(d) { return d[0] * d[4]; } %}
    | P4 _ "/" _ P5                {% function(d) { return d[0] / d[4]; } %}
    | P4 _ "//" _ P5               {% function(d) { return Math.floor(d[0] / d[4]); } %}
    | P4 _ "%" _ P5                {% function(d) { return d[0] % d[4]; } %}
    | P5                           {% id %}

# Priority-5 operators (unary operators)
P5 -> "-" _ P5                     {% function(d) { return -d[2]; } %}
    | "+" _ P5                     {% function(d) { return d[2]; } %}
    | P6                           {% id %}

# Priority-6 operators (exponent)
P6 -> P7 _ "^" _ P6                {% function(d) { return Math.pow(d[0], d[4]); } %}
    | P7                           {% id %}

# Priority-7 operators (array index)
P7 -> P7 _ "[" _ P8 _ "]"          {% function(d) { return d[0][d[4]]; } %}
    | P8                           {% id %}

# Priority-8 operators (parenthesis)
P8 -> "(" _ P0 _ ")"               {% function(d) { return d[2]; } %}
    | N                            {% id %}


# A number or a function of a number, a variable or a constant
N -> float                         {% id %}
    | sqstring                     {% id %}
    | dqstring                     {% function(d) { return asFilter(d) ? d[0] : window.qwc2ExpressionParserContext.feature.properties?.[d[0]] ?? null; } %}
    | "uuid" _ "(" _ ")"           {% function(d) { return generateUUID(); } %}
    | "now" _ "(" _ ")"            {% function(d) { return (new Date()).toISOString(); } %}
    | "abs" _ "(" _ P0 _ ")"       {% function(d) { return Math.abs(d[4]); } %}
    | "acos" _ "(" _ P0 _ ")"      {% function(d) { return Math.acos(d[4]); } %}
    | "asin" _ "(" _ P0 _ ")"      {% function(d) { return Math.asin(d[4]); } %}
    | "atan" _ "(" _ P0 _ ")"      {% function(d) { return Math.atan(d[4]); } %}
    | "atan2" _ "(" _ P0 _ "," _ P0 _ ")"            {% function(d) { return Math.atan2(d[4], d[8]); } %}
    | "ceil" _ "(" _ P0 _ ")"       {% function(d) { return Math.ceil(d[4]); } %}
    | "clamp" _ "(" _ P0 _ "," _ P0 _ "," _ P0 _ ")" {% function(d) { return Math.min(Math.max(d[4], d[8]), d[12]); } %}
    | "cos" _ "(" _ P0 _ ")"       {% function(d) { return Math.cos(d[4]); } %}
    | "degrees" _ "(" _ P0 _ ")"   {% function(d) { return d[4] / Math.PI * 180; } %}
    | "exp" _ "(" _ P0 _ ")"       {% function(d) { return Math.exp(d[4]); } %}
    | "floor" _ "(" _ P0 _ ")"     {% function(d) { return Math.floor(d[4]); } %}
    | "ln" _ "(" _ P0 _ ")"        {% function(d) { return Math.log(d[4]); }  %}
    | "log" _ "(" _ P0 _ "," _ P0 _ ")"              {% function(d) { return Math.log(d[8]) / Math.log(d[4]); } %}
    | "log10" _ "(" _ P0 _ ")"     {% function(d) { return Math.log10(d[4]); }  %}
    | "max" _ "(" _ var_args _ ")"                   {% function(d) { return Math.max(...d[4].filter(x => x !== null)); } %}
    | "min" _ "(" _ var_args _ ")"                   {% function(d) { return Math.min(...d[4].filter(x => x !== null)); } %}
    | "pi" _ "(" _ ")"             {% function(d) { return Math.PI; } %}
    | "pow" _ "(" _ P0 _ "," _ P0 _ ")"                    {% function(d) { return Math.pow(d[4], d[8]); } %}
    | "radians" _ "(" _ P0 _ ")"   {% function(d) { return d[4] * Math.PI / 180; } %}
    | "rand" _ "(" _ P0 _ "," _ P0 _ ")"             {% function(d) { return d[4] + Math.round(Math.random() * (d[8] - d[4])); } %}
    | "randf" _ "(" _ ")"          {% function(d) { return Math.random(); } %}
    | "randf" _ "(" _ P0 _ ")"     {% function(d) { return d[4] + Math.random() * (1 - d[4]); } %}
    | "randf" _ "(" _ P0 _ "," _ P0 _ ")"            {% function(d) { return d[4] + Math.random() * (d[8] - d[4]); } %}
    | "round" _ "(" _ P0 _ ")"     {% function(d) { return Math.round(d[4]); } %}
    | "round" _ "(" _ P0 _ "," _ P0 _ ")"            {% function(d) { return Number(Math.round(d[4] + 'e' + d[8]) + 'e-' + d[8]); } %}
    | "sin" _ "(" _ P0 _ ")"       {% function(d) { return Math.sin(d[4]); } %}
    | "sqrt" _ "(" _ P0 _ ")"      {% function(d) { return Math.sqrt(d[4]); } %}
    | "tan" _ "(" _ P0 _ ")"       {% function(d) { return Math.tan(d[4]); } %}
    | "CASE" _ when_args _ "ELSE" _ P0 _ "END"             {% function(d) { return d[2] !== undefined ? d[2] : d[6]; } %}
    | "coalesce" _ "(" _ var_args _ ")"                    {% function(d) { return d[4].find(x => x !== null) ?? null; } %}
    | "if" _ "(" _ P0 _ "," _ P0 _ "," _ P0 _ ")"          {% function(d) { return d[4] ? d[8] : d[12]; } %}
    | "nullif" _ "(" _ P0 _ "," _ P0 _ ")"                 {% function(d) { return d[4] === d[8] ? null : d[4]; } %}
    | "regexp_match" _ "(" _ P0 _ "," _ P0 _ ")"           {% function(d) { return d[4].search(new RegExp(d[8])) + 1; } %}
    | "attribute" _ "(" _ P0 _ ")"                         {% function(d) { const ctx = window.qwc2ExpressionParserContext; return ctx.getFeature(ctx.layer, "id", ctx.feature.id)?.properties?.[d[4]] ?? null; } %}
    | "current_value" _ "(" _ P0 _ ")"                     {% function(d) { return window.qwc2ExpressionParserContext.feature.properties?.[d[4]] ?? null; } %}
    | "attribute" _ "(" _ P0 _ "," _ P0 _ ")"              {% function(d) { return d[4]?.properties?.[d[8]] ?? null; } %}
    | "get_feature" _ "(" _ P0 _ "," _ P0 _ "," _ P0 _ ")" {% function(d) { return window.qwc2ExpressionParserContext.getFeature(d[4], d[8], d[12]); } %}
    | "get_feature_by_id" _ "(" _ P0 _ "," _ P0 _ ")"      {% function(d) { return window.qwc2ExpressionParserContext.getFeature(d[4], "id", d[8]); } %}
    | "represent_value" _ "(" _ dqstring _ ")"             {% function(d) { return window.qwc2ExpressionParserContext.representValue(d[4]); } %}
    | "format_date" _ "(" _ sqstring _ "," _ sqstring _ ")" {% function(d) { return window.qwc2ExpressionParserContext.formatDate(d[4], d[8]); } %}
    | "format_date" _ "(" _ sqstring _ "," _ sqstring _ "," _ sqstring _ ")" {% function(d) { return window.qwc2ExpressionParserContext.formatDate(d[4], d[8], d[12]); } %}
    | "array" _ "(" _ var_args _ ")"                       {% function(d) { return [...d[4]]; } %}
    | "array_all" _ "(" _ P0 _ "," _ P0 _ ")"              {% function(d) { return d[8].every(val => d[4].includes(val)); } %}
    | "array_append" _ "(" _ P0 _ "," _ P0 _ ")"           {% function(d) { return [...d[4], d[8]]; } %}
    | "array_cat" _ "(" _ P0 _ "," _ P0 _ ")"              {% function(d) { return [...d[4], ...d[8]]; } %}
    | "array_contains" _ "(" _ P0 _ "," _ P0 _ ")"         {% function(d) { return asFilter(d) ? [d[4], "HAS", d[8]] : d[4].includes(d[8]); } %}
    | "array_count" _ "(" _ P0 _ "," _ P0 _ ")"            {% function(d) { return d[4].filter(val => val === d[8]).length; } %}
    | "array_distinct" _ "(" _ P0 _ ")"                    {% function(d) { return [...new Set(d[4])].sort((a,b) => a-b); } %}
    # "array_filter" _ "(" _ P0 _ "," _ P1 _ ")"           TODO
    | "array_find" _ "(" _ P0 _ "," _ P0 _ ")"             {% function(d) { return d[4].indexOf(d[8]); } %}
    | "array_first" _ "(" _ P0 _ ")"                       {% function(d) { return d[4][0]; } %}
    # "array_foreach" _ "(" _ P0 _ "," _ P1 _ ")"          TODO
    | "array_get" _ "(" _ P0 _ "," _ P1 _ ")"              {% function(d) { return d[4][d[8]]; } %}
    | "array_insert" _ "(" _ P0 _ "," _ P1 _ "," _ P2 _ ")"{% function(d) { const a = [...d[4]]; a.splice(d[8], 0, d[12]); return a; } %}
    | "array_intersect" _ "(" _ P0 _ "," _ P0 _ ")"        {% function(d) { return d[8].find(val => d[4].includes(val)) !== undefined; } %}
    | "array_last" _ "(" _ P0 _ ")"                        {% function(d) { return d[4][d[4].length - 1]; } %}
    | "array_length" _ "(" _ P0 _ ")"                      {% function(d) { return d[4].length; } %}
    # "array_majority" _ "(" _ P0 _ "," _ P1 _ ")"         TODO
    | "array_max" _ "(" _ P0 _ ")"                         {% function(d) { return Math.max(...d[4]); } %}
    | "array_mean" _ "(" _ P0 _ ")"                        {% function(d) { const n = d[4].filter(x => typeof x === "number"); return n.reduce((sum, el) => sum + el, 0) / n.length; } %}
    | "array_median" _ "(" _ P0 _ ")"                      {% function(d) { const n = d[4].filter(x => typeof x === "number").sort((a, b) => a - b); const mid = Math.floor(n.length / 2); return n.length % 2 === 0 ? (n[mid - 1] + n[mid]) / 2 : n[mid]; } %}
    | "array_min" _ "(" _ P0 _ ")"                         {% function(d) { return Math.min(...d[4]); } %}
    # "array_minority" _ "(" _ P0 _ "," _ P1 _ ")"         TODO
    | "array_prepend" _ "(" _ P0 _ "," _ P0 _ ")"          {% function(d) { return [d[8], ...d[4]]; } %}
    | "array_prioritize" _ "(" _ P0 _ "," _ P1 _ ")"       {% function(d) { return d[8].filter(x => d[4].includes(x)).concat(d[4].filter(x => !d[8].includes(x))); } %}
    | "array_remove_all" _ "(" _ P0 _ "," _ P1 _ ")"       {% function(d) { return d[4].filter(x => x !== d[8]); } %}
    | "array_remove_at" _ "(" _ P0 _ "," _ P1 _ ")"        {% function(d) { const a = [...d[4]]; a.splice(d[8], 1); return a; } %}
    | "array_replace" _ "(" _ P0 _ "," _ P1 _ "," _ P2 _ ")"{% function(d) { const h = [d[8]].flat(); return Array.isArray(d[12]) ? d[4].map(x => d[12][d[8].indexOf(x)] ?? x) : d[4].map(x => h.includes(x) ? d[12] : x); } %}
    | "array_replace" _ "(" _ P0 _ "," _ P1 _ ")"          {% function(d) { return d[4].map(x => d[8][x] ?? x); } %}
    | "array_reverse" _ "(" _ P0 _ ")"                     {% function(d) { return d[4].reverse(); } %}
    | "array_slice" _ "(" _ P0 _ "," _ P1 _ "," _ P2 _ ")" {% function(d) { const offset = d[12] < 0 ? d[4].length : 0; return d[4].slice(d[8], offset + d[12] + 1); } %}
    | "array_sort" _ "(" _ P0 _ ")"                        {% function(d) { return d[4].sort((a,b) => a - b); } %}
    | "array_sort" _ "(" _ P0 _ "," _ P1 _ ")"             {% function(d) { return d[4].sort(d[8] === false ? (a, b) => b - a : (a,b) => a - b); } %}
    | "array_sum" _ "(" _ P0 _ ")"                         {% function(d) { return d[4].filter(x => typeof x === "number").reduce((sum, x) => sum + x, 0); } %}
    | "array_to_string" _ "(" _ P0 _ ")"                   {% function(d) { return d[4].join(","); } %}
    | "array_to_string" _ "(" _ P0 _ "," _ P1 _ ")"        {% function(d) { return d[4].join(d[8]); } %}
    | "array_to_string" _ "(" _ P0 _ "," _ P1 _ "," _ P2 _ ")" {% function(d) { return d[4].map(x => String(x).length === 0 ? d[12] : x).join(d[8]); } %}
    | "generate_series" _ "(" _ P0 _ "," _ P1 _ ")"        {% function(d) { return Array.from({length: Math.floor((d[8] - d[4])) + 1}, (_, i) => d[4] + i); } %}
    | "generate_series" _ "(" _ P0 _ "," _ P1 _ "," _ P2 _ ")" {% function(d) { return Array.from({length: Math.floor((d[8] - d[4]) / d[12]) + 1}, (_, i) => d[4] + i * d[12]); } %}
    | "regexp_matches" _ "(" _ P0 _ "," _ P1 _ ")"         {% function(d) { return (new RegExp(d[8]).exec(d[4]) || []).slice(1); } %}
    | "regexp_matches" _ "(" _ P0 _ "," _ P1 _ "," _ P2 _ ")" {% function(d) { return (new RegExp(d[8]).exec(d[4]) || []).slice(1).map(x => (x === '' ? d[12] : x)); } %}
    | "string_to_array" _ "(" _ P0 _ ")"                   {% function(d) { return d[4].split(","); } %}
    | "string_to_array" _ "(" _ P0 _ "," _ P1 _ ")"        {% function(d) { return d[4].split(d[8]); } %}
    | "string_to_array" _ "(" _ P0 _ "," _ P1 _ "," _ P2 _ ")" {% function(d) { return d[4].split(d[8]).map(x => String(x).length === 0 ? d[12] : x); } %}
    | "map" _ "(" _ var_args _ ")"                         {% function(d) { return Object.fromValues(Array.from({length: d[4].length / 2 }, (_, i) => [d[4][2 * i], d[4][2 * i + 1]])); } %}
    | "PI"i                        {% function(d) { return Math.PI; } %}
    | "E"i                         {% function(d) { return Math.E; } %}
    | "NULL"i                      {% function(d) { return null; } %}
    | "FALSE"i                     {% function(d) { return false; } %}
    | "TRUE"i                      {% function(d) { return true; } %}
    | "@feature"                   {% function(d) { return window.qwc2ExpressionParserContext.feature; } %}
    | "@geometry"                  {% function(d) { return window.qwc2ExpressionParserContext.feature?.geometry; } %}
    | "@id"                        {% function(d) { return window.qwc2ExpressionParserContext.feature?.id; } %}
    | "@layer"                     {% function(d) { return window.qwc2ExpressionParserContext.layer; } %}
    | "@layer_name"                {% function(d) { return window.qwc2ExpressionParserContext.layer; } %}
    | "@layer_crs"                 {% function(d) { return window.qwc2ExpressionParserContext.projection; } %}
    | "@project_basename"          {% function(d) { return window.qwc2ExpressionParserContext.mapPrefix; } %}
    | "@project_crs"               {% function(d) { return window.qwc2ExpressionParserContext.projection; } %}
    | "@qgis_locale"               {% function(d) { return window.qwc2ExpressionParserContext.lang; } %}
    | "@user_account_name"         {% function(d) { return window.qwc2ExpressionParserContext.username; } %}
    | "@cloud_username"            {% function(d) { return window.qwc2ExpressionParserContext.username; } %}

var_args -> P0                     {% function(d) { return [d[0]]; } %}
var_args -> var_args _ "," _ P0    {% function(d) { return [...d[0], d[4]]; } %}

when_args -> "WHEN" _ P0 _ "THEN" _ P0             {% function(d) { return d[2] ? d[6] : undefined; } %}
when_args -> when_args _ "WHEN" _ P0 _ "THEN" _ P0 {% function(d) { return d[0] !== undefined ? d[0] : (d[4] ? d[8] : undefined); } %}

# I use `float` to basically mean a number with a decimal point in it
float ->
      int "." int                  {% function(d) { return parseFloat(d[0] + d[1] + d[2])} %}
    | int                          {% function(d) { return parseInt(d[0])} %}

int -> [0-9]:+                     {% function(d) { return d[0].join(""); } %}

# Whitespace. The important thing here is that the postprocessor
# is a null-returning function. This is a memory efficiency trick.
_ -> [\s]:*                        {% function(d) { return null; } %}
__ -> [\s]:+                       {% function(d) { return null; } %}
