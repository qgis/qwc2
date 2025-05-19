/* This is just a scratch file for testing the expression grammar */

const nearley = require("nearley");
const grammar = require("./grammar.js");

global.qwc2ExpressionParserContext = {
    feature: {
        "type": "Feature",
        "properties": {
            "listnr": 1,
            "grpcode": 2,
            "numcode": 3

        }
    },
    getFeature: (layerName, attr, value) => {
        return {"type":"Feature","id":210000,"geometry":null,"properties":{"id":2,"label":"ABLAGERUNGEN","code":"DBC","listnr":21,"grpcode":0,"numcode":0,"q1":null,"q1suff":null,"q2":null,"q2suff":null,"qsr":null,"z1":null,"z2":null,"l1":2,"l2":null,"lastlevel":null,"level":1,"tooltip":"Ablagerungen an der Schachtsohle oder an Auftritten.","id2":210000},"__version__":1711648978811};
    },
    asFilter: false,
    username: "testuser",
    layer: "layername"
};

// Create a Parser object from our grammar.
const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));

// Parse something!
// parser.feed("attribute('txt') is not null and attribute('txt') <> ''")
// parser.feed("attribute(get_feature('foo', 'asd', 3), 'asd')");
// parser.feed("attribute('listnr') is not null and attribute(get_feature('chnnodedam_map','id2',attribute('listnr')*10000),'lastlevel')is null")
// parser.feed("attribute(get_feature('chnnodedam_map','id2',(coalesce(attribute('listnr')*10000,0) + coalesce(attribute('grpcode')*100,0) + coalesce(attribute('numcode'),0))),'l1')")
// parser.feed('"listnrx"')
// parser.feed('"listnr"*10000 + "grpcode"*100 + "numcode"')
// parser.feed('"listnr" = 1 AND ("grpcode" = 2 OR "numcode" = 3)')
// parser.feed('"listnr" =current_value(\'listnr\') and  "grpcode" >0 and "numcode" = 0')
// parser.feed(' "listnr" =current_value(\'listnr\') and "grpcode" =  current_value(\'grpcode\') and "numcode" >0 and "foo" = ((1<2) = true)')
// parser.feed("if(3>2, 3, 4)")
// parser.feed("nullif('a', 'b')")
parser.feed("@user_account_name")

console.log(JSON.stringify(parser.results));
