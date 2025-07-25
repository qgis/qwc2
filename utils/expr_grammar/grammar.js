// Generated automatically by nearley, version 2.20.1
// http://github.com/Hardmath123/nearley
(function () {
function id(x) { return x[0]; }


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
var grammar = {
    Lexer: undefined,
    ParserRules: [
    {"name": "dqstring$ebnf$1", "symbols": []},
    {"name": "dqstring$ebnf$1", "symbols": ["dqstring$ebnf$1", "dstrchar"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "dqstring", "symbols": [{"literal":"\""}, "dqstring$ebnf$1", {"literal":"\""}], "postprocess": function(d) {return d[1].join(""); }},
    {"name": "sqstring$ebnf$1", "symbols": []},
    {"name": "sqstring$ebnf$1", "symbols": ["sqstring$ebnf$1", "sstrchar"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "sqstring", "symbols": [{"literal":"'"}, "sqstring$ebnf$1", {"literal":"'"}], "postprocess": function(d) {return d[1].join(""); }},
    {"name": "btstring$ebnf$1", "symbols": []},
    {"name": "btstring$ebnf$1", "symbols": ["btstring$ebnf$1", /[^`]/], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "btstring", "symbols": [{"literal":"`"}, "btstring$ebnf$1", {"literal":"`"}], "postprocess": function(d) {return d[1].join(""); }},
    {"name": "dstrchar", "symbols": [/[^\\"\n]/], "postprocess": id},
    {"name": "dstrchar", "symbols": [{"literal":"\\"}, "strescape"], "postprocess": 
        function(d) {
            return JSON.parse("\""+d.join("")+"\"");
        }
        },
    {"name": "sstrchar", "symbols": [/[^\\'\n]/], "postprocess": id},
    {"name": "sstrchar", "symbols": [{"literal":"\\"}, "strescape"], "postprocess": function(d) { return JSON.parse("\""+d.join("")+"\""); }},
    {"name": "sstrchar$string$1", "symbols": [{"literal":"\\"}, {"literal":"'"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "sstrchar", "symbols": ["sstrchar$string$1"], "postprocess": function(d) {return "'"; }},
    {"name": "strescape", "symbols": [/["\\/bfnrt]/], "postprocess": id},
    {"name": "strescape", "symbols": [{"literal":"u"}, /[a-fA-F0-9]/, /[a-fA-F0-9]/, /[a-fA-F0-9]/, /[a-fA-F0-9]/], "postprocess": 
        function(d) {
            return d.join("");
        }
        },
    {"name": "main", "symbols": ["_", "P0", "_"], "postprocess": function(d) {return d[1]; }},
    {"name": "P0$subexpression$1", "symbols": [/[oO]/, /[rR]/], "postprocess": function(d) {return d.join(""); }},
    {"name": "P0", "symbols": ["P0", "_", "P0$subexpression$1", "_", "P1"], "postprocess": function(d) { return asFilter(d) ? [d[0], d[2], d[4]] : (d[0] || d[4]); }},
    {"name": "P0", "symbols": ["P1"], "postprocess": id},
    {"name": "P1$subexpression$1", "symbols": [/[aA]/, /[nN]/, /[dD]/], "postprocess": function(d) {return d.join(""); }},
    {"name": "P1", "symbols": ["P1", "_", "P1$subexpression$1", "_", "P2"], "postprocess": function(d) { return asFilter(d) ? [d[0], d[2], d[4]] : (d[0] && d[4]); }},
    {"name": "P1", "symbols": ["P2"], "postprocess": id},
    {"name": "P2", "symbols": ["P2", "_", {"literal":"<"}, "_", "P3"], "postprocess": function(d) { return asFilter(d) ? [d[0], d[2], d[4]] : (d[0] < d[4]); }},
    {"name": "P2", "symbols": ["P2", "_", {"literal":">"}, "_", "P3"], "postprocess": function(d) { return asFilter(d) ? [d[0], d[2], d[4]] : (d[0] > d[4]); }},
    {"name": "P2$string$1", "symbols": [{"literal":">"}, {"literal":"="}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "P2", "symbols": ["P2", "_", "P2$string$1", "_", "P3"], "postprocess": function(d) { return asFilter(d) ? [d[0], d[2], d[4]] : (d[0] >= d[4]); }},
    {"name": "P2$string$2", "symbols": [{"literal":"<"}, {"literal":"="}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "P2", "symbols": ["P2", "_", "P2$string$2", "_", "P3"], "postprocess": function(d) { return asFilter(d) ? [d[0], d[2], d[4]] : (d[0] <= d[4]); }},
    {"name": "P2", "symbols": ["P2", "_", {"literal":"="}, "_", "P3"], "postprocess": function(d) { return asFilter(d) ? [d[0], d[2], d[4]] : (d[0] == d[4]); }},
    {"name": "P2$string$3", "symbols": [{"literal":"<"}, {"literal":">"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "P2", "symbols": ["P2", "_", "P2$string$3", "_", "P3"], "postprocess": function(d) { return asFilter(d) ? [d[0], "!=", d[4]] : (d[0] != d[4]); }},
    {"name": "P2$subexpression$1", "symbols": [/[iI]/, /[sS]/], "postprocess": function(d) {return d.join(""); }},
    {"name": "P2", "symbols": ["P2", "_", "P2$subexpression$1", "_", "P3"], "postprocess": function(d) { return asFilter(d) ? [d[0], "=", d[4]] : d[0] === d[4]; }},
    {"name": "P2$subexpression$2", "symbols": [/[iI]/, /[sS]/], "postprocess": function(d) {return d.join(""); }},
    {"name": "P2$subexpression$3", "symbols": [/[nN]/, /[oO]/, /[tT]/], "postprocess": function(d) {return d.join(""); }},
    {"name": "P2", "symbols": ["P2", "_", "P2$subexpression$2", "_", "P2$subexpression$3", "_", "P3"], "postprocess": function(d) { return asFilter(d) ? [d[0], "!=", d[6]] : d[0] !== d[6]; }},
    {"name": "P2", "symbols": ["P2", "_", {"literal":"~"}, "_", "P3"], "postprocess": function(d) { return asFilter(d) ? [d[0], "~", d[4]] : new RegExp(d[4]).exec(d[0]) !== null; }},
    {"name": "P2$string$4", "symbols": [{"literal":"L"}, {"literal":"I"}, {"literal":"K"}, {"literal":"E"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "P2", "symbols": ["P2", "_", "P2$string$4", "_", "P3"], "postprocess": function(d) { return asFilter(d) ? [d[0], "LIKE", d[4]] : new RegExp(replaceWildcards(d[4])).exec(d[0]) !== null; }},
    {"name": "P2$string$5", "symbols": [{"literal":"I"}, {"literal":"L"}, {"literal":"I"}, {"literal":"K"}, {"literal":"E"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "P2", "symbols": ["P2", "_", "P2$string$5", "_", "P3"], "postprocess": function(d) { return asFilter(d) ? [d[0], "ILIKE", d[4]] : new RegExp(replaceWildcards(d[4]), 'i').exec(d[0]) !== null; }},
    {"name": "P2", "symbols": ["P3"], "postprocess": id},
    {"name": "P3", "symbols": ["P3", "_", {"literal":"+"}, "_", "P4"], "postprocess": function(d) { return d[0] + d[4]; }},
    {"name": "P3", "symbols": ["P3", "_", {"literal":"-"}, "_", "P4"], "postprocess": function(d) { return d[0] - d[4]; }},
    {"name": "P3$string$1", "symbols": [{"literal":"|"}, {"literal":"|"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "P3", "symbols": ["P3", "_", "P3$string$1", "_", "P4"], "postprocess": function(d) { return d[0] + d[4]; }},
    {"name": "P3", "symbols": ["P4"], "postprocess": id},
    {"name": "P4", "symbols": ["P4", "_", {"literal":"*"}, "_", "P5"], "postprocess": function(d) { return d[0] * d[4]; }},
    {"name": "P4", "symbols": ["P4", "_", {"literal":"/"}, "_", "P5"], "postprocess": function(d) { return d[0] / d[4]; }},
    {"name": "P4$string$1", "symbols": [{"literal":"/"}, {"literal":"/"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "P4", "symbols": ["P4", "_", "P4$string$1", "_", "P5"], "postprocess": function(d) { return Maht.floor(d[0] / d[4]); }},
    {"name": "P4", "symbols": ["P4", "_", {"literal":"%"}, "_", "P5"], "postprocess": function(d) { return d[0] % d[4]; }},
    {"name": "P4", "symbols": ["P5"], "postprocess": id},
    {"name": "P5", "symbols": ["P6", "_", {"literal":"^"}, "_", "P5"], "postprocess": function(d) { return Math.pow(d[0], d[4]); }},
    {"name": "P5", "symbols": ["P6"], "postprocess": id},
    {"name": "P6", "symbols": [{"literal":"-"}, "_", "P6"], "postprocess": function(d) { return -d[2]; }},
    {"name": "P6", "symbols": [{"literal":"+"}, "_", "P6"], "postprocess": function(d) { return d[2]; }},
    {"name": "P6", "symbols": [{"literal":"("}, "_", "P0", "_", {"literal":")"}], "postprocess": function(d) { return d[2]; }},
    {"name": "P6", "symbols": ["N"], "postprocess": id},
    {"name": "N", "symbols": ["float"], "postprocess": id},
    {"name": "N", "symbols": ["sqstring"], "postprocess": id},
    {"name": "N", "symbols": ["dqstring"], "postprocess": function(d) { return asFilter(d) ? d[0] : window.qwc2ExpressionParserContext.feature.properties?.[d[0]] ?? null; }},
    {"name": "N$string$1", "symbols": [{"literal":"u"}, {"literal":"u"}, {"literal":"i"}, {"literal":"d"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$1", "_", {"literal":"("}, "_", {"literal":")"}], "postprocess": function(d) { return generateUUID(); }},
    {"name": "N$string$2", "symbols": [{"literal":"n"}, {"literal":"o"}, {"literal":"w"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$2", "_", {"literal":"("}, "_", {"literal":")"}], "postprocess": function(d) { return (new Date()).toISOString(); }},
    {"name": "N$string$3", "symbols": [{"literal":"a"}, {"literal":"b"}, {"literal":"s"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$3", "_", {"literal":"("}, "_", "P0", "_", {"literal":")"}], "postprocess": function(d) { return Math.abs(d[4]); }},
    {"name": "N$string$4", "symbols": [{"literal":"a"}, {"literal":"c"}, {"literal":"o"}, {"literal":"s"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$4", "_", {"literal":"("}, "_", "P0", "_", {"literal":")"}], "postprocess": function(d) { return Math.acos(d[4]); }},
    {"name": "N$string$5", "symbols": [{"literal":"a"}, {"literal":"s"}, {"literal":"i"}, {"literal":"n"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$5", "_", {"literal":"("}, "_", "P0", "_", {"literal":")"}], "postprocess": function(d) { return Math.asin(d[4]); }},
    {"name": "N$string$6", "symbols": [{"literal":"a"}, {"literal":"t"}, {"literal":"a"}, {"literal":"n"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$6", "_", {"literal":"("}, "_", "P0", "_", {"literal":")"}], "postprocess": function(d) { return Math.atan(d[4]); }},
    {"name": "N$string$7", "symbols": [{"literal":"a"}, {"literal":"t"}, {"literal":"a"}, {"literal":"n"}, {"literal":"2"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$7", "_", {"literal":"("}, "_", "P0", "_", {"literal":","}, "_", "P0", "_", {"literal":")"}], "postprocess": function(d) { return Math.atan2(d[4], d[8]); }},
    {"name": "N$string$8", "symbols": [{"literal":"c"}, {"literal":"e"}, {"literal":"i"}, {"literal":"l"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$8", "_", {"literal":"("}, "_", "P0", "_", {"literal":")"}], "postprocess": function(d) { return Math.ceil(d[4]); }},
    {"name": "N$string$9", "symbols": [{"literal":"c"}, {"literal":"l"}, {"literal":"a"}, {"literal":"m"}, {"literal":"p"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$9", "_", {"literal":"("}, "_", "P0", "_", {"literal":","}, "_", "P0", "_", {"literal":","}, "_", "P0", "_", {"literal":")"}], "postprocess": function(d) { return Math.min(Math.max(d[4], d[8]), d[12]); }},
    {"name": "N$string$10", "symbols": [{"literal":"c"}, {"literal":"o"}, {"literal":"s"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$10", "_", {"literal":"("}, "_", "P0", "_", {"literal":")"}], "postprocess": function(d) { return Math.cos(d[4]); }},
    {"name": "N$string$11", "symbols": [{"literal":"d"}, {"literal":"e"}, {"literal":"g"}, {"literal":"r"}, {"literal":"e"}, {"literal":"e"}, {"literal":"s"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$11", "_", {"literal":"("}, "_", "P0", "_", {"literal":")"}], "postprocess": function(d) { return d[4] / Math.PI * 180; }},
    {"name": "N$string$12", "symbols": [{"literal":"e"}, {"literal":"x"}, {"literal":"p"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$12", "_", {"literal":"("}, "_", "P0", "_", {"literal":")"}], "postprocess": function(d) { return Math.exp(d[4]); }},
    {"name": "N$string$13", "symbols": [{"literal":"f"}, {"literal":"l"}, {"literal":"o"}, {"literal":"o"}, {"literal":"r"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$13", "_", {"literal":"("}, "_", "P0", "_", {"literal":")"}], "postprocess": function(d) { return Math.floor(d[4]); }},
    {"name": "N$string$14", "symbols": [{"literal":"l"}, {"literal":"n"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$14", "_", {"literal":"("}, "_", "P0", "_", {"literal":")"}], "postprocess": function(d) { return Math.log(d[4]); }},
    {"name": "N$string$15", "symbols": [{"literal":"l"}, {"literal":"o"}, {"literal":"g"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$15", "_", {"literal":"("}, "_", "P0", "_", {"literal":","}, "_", "P0", "_", {"literal":")"}], "postprocess": function(d) { return Math.log(d[8]) / Math.log(d[4]); }},
    {"name": "N$string$16", "symbols": [{"literal":"l"}, {"literal":"o"}, {"literal":"g"}, {"literal":"1"}, {"literal":"0"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$16", "_", {"literal":"("}, "_", "P0", "_", {"literal":")"}], "postprocess": function(d) { return Math.log10(d[4]); }},
    {"name": "N$string$17", "symbols": [{"literal":"m"}, {"literal":"a"}, {"literal":"x"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$17", "_", {"literal":"("}, "_", "var_args", "_", {"literal":")"}], "postprocess": function(d) { return Math.max(...d[4].filter(x => x !== null)); }},
    {"name": "N$string$18", "symbols": [{"literal":"m"}, {"literal":"i"}, {"literal":"n"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$18", "_", {"literal":"("}, "_", "var_args", "_", {"literal":")"}], "postprocess": function(d) { return Math.min(...d[4].filter(x => x !== null)); }},
    {"name": "N$string$19", "symbols": [{"literal":"p"}, {"literal":"i"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$19", "_", {"literal":"("}, "_", {"literal":")"}], "postprocess": function(d) { return Math.PI; }},
    {"name": "N$string$20", "symbols": [{"literal":"p"}, {"literal":"o"}, {"literal":"w"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$20", "_", {"literal":"("}, "_", "P0", "_", {"literal":","}, "_", "P0", "_", {"literal":")"}], "postprocess": function(d) { return Math.pow(d[4], d[8]); }},
    {"name": "N$string$21", "symbols": [{"literal":"r"}, {"literal":"a"}, {"literal":"d"}, {"literal":"i"}, {"literal":"a"}, {"literal":"n"}, {"literal":"s"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$21", "_", {"literal":"("}, "_", "P0", "_", {"literal":")"}], "postprocess": function(d) { return d[4] * Math.PI / 180; }},
    {"name": "N$string$22", "symbols": [{"literal":"r"}, {"literal":"a"}, {"literal":"n"}, {"literal":"d"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$22", "_", {"literal":"("}, "_", "P0", "_", {"literal":","}, "_", "P0", "_", {"literal":")"}], "postprocess": function(d) { return d[4] + Math.round(Math.random() * (d[8] - d[4])); }},
    {"name": "N$string$23", "symbols": [{"literal":"r"}, {"literal":"a"}, {"literal":"n"}, {"literal":"d"}, {"literal":"f"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$23", "_", {"literal":"("}, "_", {"literal":")"}], "postprocess": function(d) { return Math.random(); }},
    {"name": "N$string$24", "symbols": [{"literal":"r"}, {"literal":"a"}, {"literal":"n"}, {"literal":"d"}, {"literal":"f"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$24", "_", {"literal":"("}, "_", "P0", "_", {"literal":")"}], "postprocess": function(d) { return d[4] + Math.random() * (1 - d[4]); }},
    {"name": "N$string$25", "symbols": [{"literal":"r"}, {"literal":"a"}, {"literal":"n"}, {"literal":"d"}, {"literal":"f"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$25", "_", {"literal":"("}, "_", "P0", "_", {"literal":","}, "_", "P0", "_", {"literal":")"}], "postprocess": function(d) { return d[4] + Math.random() * (d[8] - d[4]); }},
    {"name": "N$string$26", "symbols": [{"literal":"r"}, {"literal":"o"}, {"literal":"u"}, {"literal":"n"}, {"literal":"d"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$26", "_", {"literal":"("}, "_", "P0", "_", {"literal":")"}], "postprocess": function(d) { return Math.round(d[4]); }},
    {"name": "N$string$27", "symbols": [{"literal":"r"}, {"literal":"o"}, {"literal":"u"}, {"literal":"n"}, {"literal":"d"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$27", "_", {"literal":"("}, "_", "P0", "_", {"literal":","}, "_", "P0", "_", {"literal":")"}], "postprocess": function(d) { return Number(Math.round(d[4] + 'e' + d[8]) + 'e-' + d[8]); }},
    {"name": "N$string$28", "symbols": [{"literal":"s"}, {"literal":"i"}, {"literal":"n"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$28", "_", {"literal":"("}, "_", "P0", "_", {"literal":")"}], "postprocess": function(d) { return Math.sin(d[4]); }},
    {"name": "N$string$29", "symbols": [{"literal":"s"}, {"literal":"q"}, {"literal":"r"}, {"literal":"t"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$29", "_", {"literal":"("}, "_", "P0", "_", {"literal":")"}], "postprocess": function(d) { return Math.sqrt(d[4]); }},
    {"name": "N$string$30", "symbols": [{"literal":"t"}, {"literal":"a"}, {"literal":"n"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$30", "_", {"literal":"("}, "_", "P0", "_", {"literal":")"}], "postprocess": function(d) { return Math.tan(d[4]); }},
    {"name": "N$string$31", "symbols": [{"literal":"C"}, {"literal":"A"}, {"literal":"S"}, {"literal":"E"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N$string$32", "symbols": [{"literal":"E"}, {"literal":"L"}, {"literal":"S"}, {"literal":"E"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N$string$33", "symbols": [{"literal":"E"}, {"literal":"N"}, {"literal":"D"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$31", "_", "when_args", "_", "N$string$32", "_", "P0", "_", "N$string$33"], "postprocess": function(d) { return d[2] !== undefined ? d[2] : d[6]; }},
    {"name": "N$string$34", "symbols": [{"literal":"c"}, {"literal":"o"}, {"literal":"a"}, {"literal":"l"}, {"literal":"e"}, {"literal":"s"}, {"literal":"c"}, {"literal":"e"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$34", "_", {"literal":"("}, "_", "var_args", "_", {"literal":")"}], "postprocess": function(d) { return d[4].find(x => x !== null) ?? null; }},
    {"name": "N$string$35", "symbols": [{"literal":"i"}, {"literal":"f"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$35", "_", {"literal":"("}, "_", "P0", "_", {"literal":","}, "_", "P0", "_", {"literal":","}, "_", "P0", "_", {"literal":")"}], "postprocess": function(d) { return d[4] ? d[8] : d[12]; }},
    {"name": "N$string$36", "symbols": [{"literal":"n"}, {"literal":"u"}, {"literal":"l"}, {"literal":"l"}, {"literal":"i"}, {"literal":"f"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$36", "_", {"literal":"("}, "_", "P0", "_", {"literal":","}, "_", "P0", "_", {"literal":")"}], "postprocess": function(d) { return d[4] === d[8] ? null : d[4]; }},
    {"name": "N$string$37", "symbols": [{"literal":"r"}, {"literal":"e"}, {"literal":"g"}, {"literal":"e"}, {"literal":"x"}, {"literal":"p"}, {"literal":"_"}, {"literal":"m"}, {"literal":"a"}, {"literal":"t"}, {"literal":"c"}, {"literal":"h"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$37", "_", {"literal":"("}, "_", "P0", "_", {"literal":","}, "_", "P0", "_", {"literal":")"}], "postprocess": function(d) { return d[4].search(new RegExp(d[8])) + 1; }},
    {"name": "N$string$38", "symbols": [{"literal":"a"}, {"literal":"t"}, {"literal":"t"}, {"literal":"r"}, {"literal":"i"}, {"literal":"b"}, {"literal":"u"}, {"literal":"t"}, {"literal":"e"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$38", "_", {"literal":"("}, "_", "P0", "_", {"literal":")"}], "postprocess": function(d) { return window.qwc2ExpressionParserContext.feature.properties?.[d[4]] ?? null; }},
    {"name": "N$string$39", "symbols": [{"literal":"c"}, {"literal":"u"}, {"literal":"r"}, {"literal":"r"}, {"literal":"e"}, {"literal":"n"}, {"literal":"t"}, {"literal":"_"}, {"literal":"v"}, {"literal":"a"}, {"literal":"l"}, {"literal":"u"}, {"literal":"e"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$39", "_", {"literal":"("}, "_", "P0", "_", {"literal":")"}], "postprocess": function(d) { return window.qwc2ExpressionParserContext.feature.properties?.[d[4]] ?? null; }},
    {"name": "N$string$40", "symbols": [{"literal":"a"}, {"literal":"t"}, {"literal":"t"}, {"literal":"r"}, {"literal":"i"}, {"literal":"b"}, {"literal":"u"}, {"literal":"t"}, {"literal":"e"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$40", "_", {"literal":"("}, "_", "P0", "_", {"literal":","}, "_", "P0", "_", {"literal":")"}], "postprocess": function(d) { return d[4]?.properties?.[d[8]] ?? null; }},
    {"name": "N$string$41", "symbols": [{"literal":"g"}, {"literal":"e"}, {"literal":"t"}, {"literal":"_"}, {"literal":"f"}, {"literal":"e"}, {"literal":"a"}, {"literal":"t"}, {"literal":"u"}, {"literal":"r"}, {"literal":"e"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$41", "_", {"literal":"("}, "_", "P0", "_", {"literal":","}, "_", "P0", "_", {"literal":","}, "_", "P0", "_", {"literal":")"}], "postprocess": function(d) { return window.qwc2ExpressionParserContext.getFeature(d[4], d[8], d[12]); }},
    {"name": "N$string$42", "symbols": [{"literal":"g"}, {"literal":"e"}, {"literal":"t"}, {"literal":"_"}, {"literal":"f"}, {"literal":"e"}, {"literal":"a"}, {"literal":"t"}, {"literal":"u"}, {"literal":"r"}, {"literal":"e"}, {"literal":"_"}, {"literal":"b"}, {"literal":"y"}, {"literal":"_"}, {"literal":"i"}, {"literal":"d"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$42", "_", {"literal":"("}, "_", "P0", "_", {"literal":","}, "_", "P0", "_", {"literal":")"}], "postprocess": function(d) { return window.qwc2ExpressionParserContext.getFeature(d[4], "id", d[8]); }},
    {"name": "N$string$43", "symbols": [{"literal":"r"}, {"literal":"e"}, {"literal":"p"}, {"literal":"r"}, {"literal":"e"}, {"literal":"s"}, {"literal":"e"}, {"literal":"n"}, {"literal":"t"}, {"literal":"_"}, {"literal":"v"}, {"literal":"a"}, {"literal":"l"}, {"literal":"u"}, {"literal":"e"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$43", "_", {"literal":"("}, "_", "dqstring", "_", {"literal":")"}], "postprocess": function(d) { return window.qwc2ExpressionParserContext.representValue(d[4]); }},
    {"name": "N$subexpression$1", "symbols": [/[pP]/, /[iI]/], "postprocess": function(d) {return d.join(""); }},
    {"name": "N", "symbols": ["N$subexpression$1"], "postprocess": function(d) { return Math.PI; }},
    {"name": "N$subexpression$2", "symbols": [/[eE]/], "postprocess": function(d) {return d.join(""); }},
    {"name": "N", "symbols": ["N$subexpression$2"], "postprocess": function(d) { return Math.E; }},
    {"name": "N$subexpression$3", "symbols": [/[nN]/, /[uU]/, /[lL]/, /[lL]/], "postprocess": function(d) {return d.join(""); }},
    {"name": "N", "symbols": ["N$subexpression$3"], "postprocess": function(d) { return null; }},
    {"name": "N$subexpression$4", "symbols": [/[fF]/, /[aA]/, /[lL]/, /[sS]/, /[eE]/], "postprocess": function(d) {return d.join(""); }},
    {"name": "N", "symbols": ["N$subexpression$4"], "postprocess": function(d) { return false; }},
    {"name": "N$subexpression$5", "symbols": [/[tT]/, /[rR]/, /[uU]/, /[eE]/], "postprocess": function(d) {return d.join(""); }},
    {"name": "N", "symbols": ["N$subexpression$5"], "postprocess": function(d) { return true; }},
    {"name": "N$string$44", "symbols": [{"literal":"@"}, {"literal":"f"}, {"literal":"e"}, {"literal":"a"}, {"literal":"t"}, {"literal":"u"}, {"literal":"r"}, {"literal":"e"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$44"], "postprocess": function(d) { return window.qwc2ExpressionParserContext.feature; }},
    {"name": "N$string$45", "symbols": [{"literal":"@"}, {"literal":"g"}, {"literal":"e"}, {"literal":"o"}, {"literal":"m"}, {"literal":"e"}, {"literal":"t"}, {"literal":"r"}, {"literal":"y"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$45"], "postprocess": function(d) { return window.qwc2ExpressionParserContext.feature?.geometry; }},
    {"name": "N$string$46", "symbols": [{"literal":"@"}, {"literal":"i"}, {"literal":"d"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$46"], "postprocess": function(d) { return window.qwc2ExpressionParserContext.feature?.id; }},
    {"name": "N$string$47", "symbols": [{"literal":"@"}, {"literal":"l"}, {"literal":"a"}, {"literal":"y"}, {"literal":"e"}, {"literal":"r"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$47"], "postprocess": function(d) { return window.qwc2ExpressionParserContext.layer; }},
    {"name": "N$string$48", "symbols": [{"literal":"@"}, {"literal":"l"}, {"literal":"a"}, {"literal":"y"}, {"literal":"e"}, {"literal":"r"}, {"literal":"_"}, {"literal":"n"}, {"literal":"a"}, {"literal":"m"}, {"literal":"e"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$48"], "postprocess": function(d) { return window.qwc2ExpressionParserContext.layer; }},
    {"name": "N$string$49", "symbols": [{"literal":"@"}, {"literal":"l"}, {"literal":"a"}, {"literal":"y"}, {"literal":"e"}, {"literal":"r"}, {"literal":"_"}, {"literal":"c"}, {"literal":"r"}, {"literal":"s"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$49"], "postprocess": function(d) { return window.qwc2ExpressionParserContext.projection; }},
    {"name": "N$string$50", "symbols": [{"literal":"@"}, {"literal":"p"}, {"literal":"r"}, {"literal":"o"}, {"literal":"j"}, {"literal":"e"}, {"literal":"c"}, {"literal":"t"}, {"literal":"_"}, {"literal":"b"}, {"literal":"a"}, {"literal":"s"}, {"literal":"e"}, {"literal":"n"}, {"literal":"a"}, {"literal":"m"}, {"literal":"e"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$50"], "postprocess": function(d) { return window.qwc2ExpressionParserContext.mapPrefix; }},
    {"name": "N$string$51", "symbols": [{"literal":"@"}, {"literal":"p"}, {"literal":"r"}, {"literal":"o"}, {"literal":"j"}, {"literal":"e"}, {"literal":"c"}, {"literal":"t"}, {"literal":"_"}, {"literal":"c"}, {"literal":"r"}, {"literal":"s"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$51"], "postprocess": function(d) { return window.qwc2ExpressionParserContext.projection; }},
    {"name": "N$string$52", "symbols": [{"literal":"@"}, {"literal":"q"}, {"literal":"g"}, {"literal":"i"}, {"literal":"s"}, {"literal":"_"}, {"literal":"l"}, {"literal":"o"}, {"literal":"c"}, {"literal":"a"}, {"literal":"l"}, {"literal":"e"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$52"], "postprocess": function(d) { return window.qwc2ExpressionParserContext.lang; }},
    {"name": "N$string$53", "symbols": [{"literal":"@"}, {"literal":"u"}, {"literal":"s"}, {"literal":"e"}, {"literal":"r"}, {"literal":"_"}, {"literal":"a"}, {"literal":"c"}, {"literal":"c"}, {"literal":"o"}, {"literal":"u"}, {"literal":"n"}, {"literal":"t"}, {"literal":"_"}, {"literal":"n"}, {"literal":"a"}, {"literal":"m"}, {"literal":"e"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$53"], "postprocess": function(d) { return window.qwc2ExpressionParserContext.username; }},
    {"name": "N$string$54", "symbols": [{"literal":"@"}, {"literal":"c"}, {"literal":"l"}, {"literal":"o"}, {"literal":"u"}, {"literal":"d"}, {"literal":"_"}, {"literal":"u"}, {"literal":"s"}, {"literal":"e"}, {"literal":"r"}, {"literal":"n"}, {"literal":"a"}, {"literal":"m"}, {"literal":"e"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "N", "symbols": ["N$string$54"], "postprocess": function(d) { return window.qwc2ExpressionParserContext.username; }},
    {"name": "var_args", "symbols": ["P0"], "postprocess": function(d) { return [d[0]]; }},
    {"name": "var_args", "symbols": ["var_args", "_", {"literal":","}, "_", "P0"], "postprocess": function(d) { return [...d[0], d[4]]; }},
    {"name": "when_args$string$1", "symbols": [{"literal":"W"}, {"literal":"H"}, {"literal":"E"}, {"literal":"N"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "when_args$string$2", "symbols": [{"literal":"T"}, {"literal":"H"}, {"literal":"E"}, {"literal":"N"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "when_args", "symbols": ["when_args$string$1", "_", "P0", "_", "when_args$string$2", "_", "P0"], "postprocess": function(d) { return d[2] ? d[6] : undefined; }},
    {"name": "when_args$string$3", "symbols": [{"literal":"W"}, {"literal":"H"}, {"literal":"E"}, {"literal":"N"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "when_args$string$4", "symbols": [{"literal":"T"}, {"literal":"H"}, {"literal":"E"}, {"literal":"N"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "when_args", "symbols": ["when_args", "_", "when_args$string$3", "_", "P0", "_", "when_args$string$4", "_", "P0"], "postprocess": function(d) { return d[0] !== undefined ? d[0] : (d[4] ? d[8] : undefined); }},
    {"name": "float", "symbols": ["int", {"literal":"."}, "int"], "postprocess": function(d) { return parseFloat(d[0] + d[1] + d[2])}},
    {"name": "float", "symbols": ["int"], "postprocess": function(d) { return parseInt(d[0])}},
    {"name": "int$ebnf$1", "symbols": [/[0-9]/]},
    {"name": "int$ebnf$1", "symbols": ["int$ebnf$1", /[0-9]/], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "int", "symbols": ["int$ebnf$1"], "postprocess": function(d) { return d[0].join(""); }},
    {"name": "_$ebnf$1", "symbols": []},
    {"name": "_$ebnf$1", "symbols": ["_$ebnf$1", /[\s]/], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "_", "symbols": ["_$ebnf$1"], "postprocess": function(d) { return null; }},
    {"name": "__$ebnf$1", "symbols": [/[\s]/]},
    {"name": "__$ebnf$1", "symbols": ["__$ebnf$1", /[\s]/], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "__", "symbols": ["__$ebnf$1"], "postprocess": function(d) { return null; }}
]
  , ParserStart: "main"
}
if (typeof module !== 'undefined'&& typeof module.exports !== 'undefined') {
   module.exports = grammar;
} else {
   window.grammar = grammar;
}
})();
