/* This is just a scratch file for testing the expression grammar */

const nearley = require('nearley');
const grammar = require('./grammar.js');
const isEqual = require('lodash.isequal');
// import {formatDate} from '../MiscUtils.js';

global.qwc2ExpressionParserContext = {
    feature: {
        "type": "Feature",
        "properties": {
            "listnr": 1,
            "grpcode": 2,
            "numcode": 3,
            "label": "My fancy feature",
            "BerechneteGruenflaeche": 10,
            "EffektiveGruenflaeche": 8,
            // "BerechneteBebauungsflaeche" - "EffektiveBebauungsflaeche" - "Abtretung" + "Zuteilung"
            "BerechneteBebauungsflaeche": 10,
            "EffektiveBebauungsflaeche": 9,
            "Abtretung": 8.1,
            "Zuteilung": 7.3
            // 10 - 9 - 8 + 7 = 0
        }
    },
    getFeature: (layerName, attr, value) => {
        return {"type":"Feature","id":210000,"geometry":null,"properties":{"id":2,"label":"ABLAGERUNGEN","code":"DBC","listnr":21,"grpcode":0,"numcode":0,"q1":null,"q1suff":null,"q2":null,"q2suff":null,"qsr":null,"z1":null,"z2":null,"l1":2,"l2":null,"lastlevel":null,"level":1,"tooltip":"Ablagerungen an der Schachtsohle oder an Auftritten.","id2":210000},"__version__":1711648978811};
    },
    representValue: (attr) => {
        console.log(attr);
        const value = global.qwc2ExpressionParserContext.feature.properties[attr];
        console.log(value);
        return {1: 'One', 2: 'Two', 3: 'Three', 4: 'Four'}[value] ?? value;
    },
    formatDate: () => "",//formatDate,
    asFilter: false,
    username: "testuser",
    layer: "layername"
};

function evaluate(expr) {
    const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
    parser.feed(expr);
    return parser.results[0];
}
function checkExpr(expr, expected) {
    console.log(`Checking ${expr} === ${expected}`);
    const result = evaluate(expr);
    if (!isEqual(result, expected)) {
        console.log([result, expected])
        throw `Unexpected expression result: ${expr} !== ${expected} (result: ${result})`;
    }
}
// Create a Parser object from our grammar.

// Basic test
checkExpr("-1", -1);
checkExpr("+1", 1);
checkExpr("--1", 1);
checkExpr("-(2 + 3)", -5);
checkExpr("(2)", 2);
checkExpr("((2 + 3))", 5);
checkExpr("2 ^ 3", 8);
checkExpr("2 ^ 3 ^ 2", 512);
checkExpr("(2 ^ 3) ^ 2", 64);
checkExpr("-2 ^ 2", -4);
checkExpr("2 * 3", 6);
checkExpr("6 / 3", 2);
checkExpr("7 % 4", 3);
checkExpr("7 // 2", 3);
checkExpr("2 + 3 * 4", 14);
checkExpr("(2 + 3) * 4", 20);
checkExpr("2 + 3", 5);
checkExpr("5 - 3", 2);
checkExpr("10 - 3 - 2", 5);
checkExpr("'1' || '2'", '12');
checkExpr("'1' || '2' || '3'", '123');
checkExpr("2 < 3", true);
checkExpr("3 > 2", true);
checkExpr("3 >= 3", true);
checkExpr("2 <= 1", false);
checkExpr("2 = 2", true);
checkExpr("2 <> 3", true);
checkExpr("2 <> 2", false);
checkExpr("2 IS 2", true);
checkExpr("2 IS NOT 3", true);
checkExpr("2 IS NOT 2", false);
checkExpr("'abc' ~ 'a.*'", true);
checkExpr("'abc' ~ '^b'", false);
checkExpr("'hello' LIKE 'h%'", true);
checkExpr("'hello' LIKE '%lo'", true);
checkExpr("'hello' LIKE 'H%'", false);
checkExpr("'hello' ILIKE 'H%'", true);
checkExpr("true AND true", true);
checkExpr("true AND false", false);
checkExpr("2 = 2 AND 3 = 3", true);
checkExpr("2 = 2 AND 3 = 4", false);
checkExpr("false OR true", true);
checkExpr("false OR false", false);
checkExpr("2 = 3 OR 3 = 3", true);
checkExpr("2 = 3 OR 3 = 4", false);
checkExpr("2 + 2 * 2 = 6", true);
checkExpr("2 + 2 * 2 = 8 OR 1 = 1", true);
checkExpr("2 + 2 * 2 = 8 AND 1 = 1", false);
checkExpr("(2 + 2) * 2 = 8 AND 3 > 1", true);
checkExpr("2 ^ 2 * 3 = 12", true);
checkExpr("1 < 2 < 3", true);     // evaluates (1 < 2) < 3 → true < 3 → true
checkExpr("1 = 1 = 1", true);
checkExpr("1 = 1 AND 2 = 3 OR 4 = 4", true);
checkExpr("PI", Math.PI);
checkExpr("pi()", Math.PI);
checkExpr("E", Math.E);
checkExpr("TRUE", true);
checkExpr("FALSE", false);
checkExpr("NULL", null);
checkExpr("abs(-5)", 5);
checkExpr("acos(1)", 0);
checkExpr("asin(0)", 0);
checkExpr("atan(1)", Math.atan(1));
checkExpr("atan2(1, 1)", Math.atan2(1, 1));
checkExpr("ceil(1.2)", 2);
checkExpr("clamp(5, 0, 10)", 5);
checkExpr("clamp(-5, 0, 10)", 0);
checkExpr("clamp(15, 0, 10)", 10);
checkExpr("cos(0)", 1);
checkExpr("degrees(PI)", 180);
checkExpr("exp(1)", Math.exp(1));
checkExpr("floor(1.9)", 1);
checkExpr("ln(1)", 0);
checkExpr("log(2, 8)", 3);
checkExpr("log10(100)", 2);
checkExpr("max(1,2,3)", 3);
checkExpr("min(1,2,3)", 1);
checkExpr("pow(2,3)", 8);
checkExpr("radians(180)", Math.PI);
checkExpr("round(3.5)", 4);
checkExpr("round(3.14159,2)", 3.14);
checkExpr("sin(0)", 0);
checkExpr("sqrt(4)", 2);
checkExpr("tan(0)", 0);
checkExpr("coalesce(NULL, 5, 10)", 5);
checkExpr("if(TRUE, 1, 2)", 1);
checkExpr("if(FALSE, 1, 2)", 2);
checkExpr("nullif(5,5)", null);
checkExpr("nullif(5,2)", 5);
checkExpr("array(2,1,5,3)[2]", 5);
checkExpr("array(1,2,array(3,4))[2][1]", 4);
checkExpr("abs(-pow(2,3))", 8);
checkExpr("round(sqrt(10))", Math.round(Math.sqrt(10)));
checkExpr("clamp(pow(2,3),0,5)", 5);
checkExpr("sin(radians(180))", Math.sin(Math.PI));
checkExpr("array_all(array(1,2,3),array(2,3))", true);
checkExpr("array_all(array(1,2,3),array(1,2,4))", false);
checkExpr("array_append(array(1,2,3),4)", [1, 2, 3, 4]);
checkExpr("array_cat(array(1,2),array(2,3))", [1, 2, 2, 3]);
checkExpr("array_contains(array(1,2,3),2)", true);
checkExpr("array_count(array('a', 'b', 'c', 'b'), 'b')", 2);
checkExpr("array_distinct(array(1,2,3,2,1))", [1,2,3]);
checkExpr("array_find(array('a', 'b', 'c'), 'b')", 1);
checkExpr("array_first(array('a', 'b', 'c'))", "a");
checkExpr("array_get(array('a', 'b', 'c'), 2)", "c");
checkExpr("array_insert(array(1,2,3),1,100)", [1, 100, 2, 3]);
checkExpr("array_intersect(array(1,2,3,4),array(4,0,2,5))", true);
checkExpr("array_last(array('a','b','c'))", "c");
checkExpr("array_length(array(1,2,3))", 3);
checkExpr("array_max(array(0,42,4,2))", 42);
checkExpr("array_mean(array(0,1,7,66.6,135.4))", 42);
checkExpr("array_mean(array(0,84,'a','b','c'))", 42);
checkExpr("array_median(array(0,1,42,42,43))", 42);
checkExpr("array_median(array(0,1,2,42,'a','b'))", 1.5);
checkExpr("array_min(array(43,42,54))", 42);
checkExpr("array_prepend(array(1,2,3),0)", [0, 1, 2, 3]);
checkExpr("array_prioritize(array(1, 8, 2, 5), array(5, 4, 2, 1, 3, 8))", [5, 2, 1, 8]);
checkExpr("array_prioritize(array(5, 4, 2, 1, 3, 8), array(1, 8, 6, 5))", [1, 8, 5, 4, 2, 3]);
checkExpr("array_remove_all(array('a','b','c','b'),'b')", ['a', 'c']);
checkExpr("array_remove_at(array(1, 2, 3), 1)", [1, 3]);
checkExpr("array_remove_at(array(1, 2, 3), -1)", [1, 2]);
checkExpr("array_replace(array('QGIS','SHOULD','ROCK'),'SHOULD','DOES')", ['QGIS', 'DOES', 'ROCK']);
checkExpr("array_replace(array(3,2,1),array(1,2,3),array(7,8,9))", [9, 8, 7]);
checkExpr("array_replace(array('Q','G','I','S'),array('Q','S'),'-')", ['-','G', 'I', '-']);
checkExpr("array_reverse(array(2,4,0,10))", [10, 0, 4, 2]);
checkExpr("array_slice(array(1,2,3,4,5),0,3)", [1, 2, 3, 4]);
checkExpr("array_slice(array(1,2,3,4,5),0,-1)", [1, 2, 3, 4, 5]);
checkExpr("array_slice(array(1,2,3,4,5),-5,-1)", [1, 2, 3, 4, 5]);
checkExpr("array_slice(array(1,2,3,4,5),0,0)", [1]);
checkExpr("array_slice(array(1,2,3,4,5),-2,-1)", [4, 5]);
checkExpr("array_slice(array(1,2,3,4,5),-1,-1)", [5]);
checkExpr("array_slice(array('Dufour','Valmiera','Chugiak','Brighton'),1,2)", ['Valmiera', 'Chugiak']);
checkExpr("array_slice(array('Dufour','Valmiera','Chugiak','Brighton'),-2,-1)", ['Chugiak', 'Brighton']);
checkExpr("array_sort(array(3,2,1))", [1, 2, 3]);
checkExpr("array_sort(array(3,2,1), true)", [1, 2, 3]);
checkExpr("array_sort(array(3,2,1), false)", [3, 2, 1]);
checkExpr("array_sum(array(0,1,39.4,1.6,'a'))", 42.0);
checkExpr("array_to_string(array('1','2','3'))", '1,2,3');
checkExpr("array_to_string(array(1,2,3),'-')", '1-2-3');
checkExpr("array_to_string(array('1','','3'),',','0')", '1,0,3');
checkExpr("generate_series(1,5)", [1, 2, 3, 4, 5]);
checkExpr("generate_series(5,1,-1)", [5, 4, 3, 2, 1]);
checkExpr("regexp_matches('QGIS=>rocks','(.*)=>(.*)')", ['QGIS', 'rocks']);
checkExpr("regexp_matches('key=>','(.*)=>(.*)','empty value')", ['key', 'empty value']);
checkExpr("string_to_array('1,2,3',',')", ['1', '2', '3']);
checkExpr("string_to_array('1,,3',',','0')", ['1', '0', '3']);
console.log("Tests ok!");


// Parse something!
function printResult(expr) {
    console.log(evaluate(expr));
}
// printResult("attribute('txt') is not null and attribute('txt') <> ''")
// printResult("attribute(get_feature('foo', 'asd', 3), 'asd')");
// printResult("attribute('listnr') is not null and attribute(get_feature('chnnodedam_map','id2',attribute('listnr')*10000),'lastlevel')is null")
// printResult("attribute(get_feature('chnnodedam_map','id2',(coalesce(attribute('listnr')*10000,0) + coalesce(attribute('grpcode')*100,0) + coalesce(attribute('numcode'),0))),'l1')")
// printResult('"listnrx"')
// printResult('"listnr"*10000 + "grpcode"*100 + "numcode"')
// printResult('"listnr" = 1 AND ("grpcode" = 2 OR "numcode" = 3)')
// printResult('"listnr" =current_value(\'listnr\') and  "grpcode" >0 and "numcode" = 0')
// printResult(' "listnr" =current_value(\'listnr\') and "grpcode" =  current_value(\'grpcode\') and "numcode" >0 and "foo" = ((1<2) = true)')
// printResult("if(3>2, 3, 4)")
// printResult("nullif('a', 'b')")
// printResult("@user_account_name")
// printResult("'Hello' || ' ' || 'World'");
// printResult('represent_value("numcode")');
// printResult('"BerechneteGruenflaeche" - "EffektiveGruenflaeche"');
// printResult('"BerechneteBebauungsflaeche" - "EffektiveBebauungsflaeche" - "Abtretung" + "Zuteilung"');
// printResult('randf(0.5,0.6)');
// printResult('round(\r "Abtretung" \r+ "Zuteilung")')
// printResult("format_date('2012-05-15','d MMMM yyyy','fr')")
printResult("array(1,2,3,5,1)[2]")
