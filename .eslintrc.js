module.exports = {
    parser: "@babel/eslint-parser",  // https://github.com/babel/babel/tree/main/eslint/babel-eslint-parser
    parserOptions: {
        babelOptions: {
            configFile: "./.babelrc.json"
        },
        ecmaFeatures: {
            arrowFunctions: true,
            blockBindings: true,
            classes: true,
            defaultParams: true,
            destructuring: true,
            forOf: true,
            generators: false,
            modules: true,
            objectLiteralComputedProperties: true,
            objectLiteralDuplicateProperties: false,
            objectLiteralShorthandMethods: true,
            objectLiteralShorthandProperties: true,
            spread: true,
            superInFunctions: true,
            templateStrings: true,
            jsx: true
        }
    },
    plugins: [
        "perfectionist",                 // https://github.com/azat-io/eslint-plugin-perfectionist
        "react"                          // https://github.com/yannickcr/eslint-plugin-react
    ],
    extends: [
        "eslint:recommended",
        "plugin:react/recommended"
    ],
    env: {                           // http://eslint.org/docs/user-guide/configuring.html#specifying-environments
        es6: true,
        browser: true,                 // browser global variables
        node: true                     // Node.js global variables and Node.js-specific rules
    },
    settings: {
        react: {
            version: "detect"
        }
    },
    globals: {
    /* MOCHA */
        describe: false,
        it: false,
        before: false,
        beforeEach: false,
        after: false,
        afterEach: false,
        __DEVTOOLS__: false
    },
    rules: {
        /**
         * Strict mode
         */
        // babel inserts "use strict"; for us
        "strict": [2, "never"],          // http://eslint.org/docs/rules/strict

        /**
         * ES6
         */
        "no-var": 2,                     // http://eslint.org/docs/rules/no-var
        "prefer-const": 2,               // http://eslint.org/docs/rules/prefer-const

        /**
         * Variables
         */
        "no-shadow": 2,                  // http://eslint.org/docs/rules/no-shadow
        "no-shadow-restricted-names": 2, // http://eslint.org/docs/rules/no-shadow-restricted-names
        "no-unused-vars": [2, {          // http://eslint.org/docs/rules/no-unused-vars
            vars: "local",
            args: "after-used"
        }],
        "no-use-before-define": 2,       // http://eslint.org/docs/rules/no-use-before-define

        /**
         * Possible errors
         */
        "comma-dangle": [2, "never"],    // http://eslint.org/docs/rules/comma-dangle
        "no-console": 1,                 // http://eslint.org/docs/rules/no-console
        "no-alert": 1,                   // http://eslint.org/docs/rules/no-alert
        "quote-props": [2, "consistent-as-needed"], // https://eslint.org/docs/rules/quote-props
        "block-scoped-var": 2,           // http://eslint.org/docs/rules/block-scoped-var


        /**
         * Best practices
         */
        "consistent-return": 2,          // http://eslint.org/docs/rules/consistent-return
        "curly": [2, "multi-line"],      // http://eslint.org/docs/rules/curly
        "default-case": 2,               // http://eslint.org/docs/rules/default-case
        "dot-notation": [2, {            // http://eslint.org/docs/rules/dot-notation
            allowKeywords: true
        }],
        "eqeqeq": 2,                     // http://eslint.org/docs/rules/eqeqeq
        "guard-for-in": 2,               // http://eslint.org/docs/rules/guard-for-in
        "no-caller": 2,                  // http://eslint.org/docs/rules/no-caller
        "no-eq-null": 2,                 // http://eslint.org/docs/rules/no-eq-null
        "no-eval": 2,                    // http://eslint.org/docs/rules/no-eval
        "no-extend-native": 2,           // http://eslint.org/docs/rules/no-extend-native
        "no-extra-bind": 2,              // http://eslint.org/docs/rules/no-extra-bind
        "no-extra-semi": "warn",
        "no-floating-decimal": 2,        // http://eslint.org/docs/rules/no-floating-decimal
        "no-implied-eval": 2,            // http://eslint.org/docs/rules/no-implied-eval
        "no-lone-blocks": 2,             // http://eslint.org/docs/rules/no-lone-blocks
        "no-loop-func": 2,               // http://eslint.org/docs/rules/no-loop-func
        "no-multi-str": 2,               // http://eslint.org/docs/rules/no-multi-str
        "no-global-assign": 2,           // http://eslint.org/docs/rules/no-global-assign
        "no-new": 2,                     // http://eslint.org/docs/rules/no-new
        "no-new-func": 2,                // http://eslint.org/docs/rules/no-new-func
        "no-new-wrappers": 2,            // http://eslint.org/docs/rules/no-new-wrappers
        "no-octal-escape": 2,            // http://eslint.org/docs/rules/no-octal-escape
        "no-proto": 2,                   // http://eslint.org/docs/rules/no-proto
        "no-return-assign": 2,           // http://eslint.org/docs/rules/no-return-assign
        "no-script-url": 2,              // http://eslint.org/docs/rules/no-script-url
        "no-self-compare": 2,            // http://eslint.org/docs/rules/no-self-compare
        "no-sequences": 2,               // http://eslint.org/docs/rules/no-sequences
        "no-throw-literal": 2,           // http://eslint.org/docs/rules/no-throw-literal
        "radix": 2,                      // http://eslint.org/docs/rules/radix
        "vars-on-top": 2,                // http://eslint.org/docs/rules/vars-on-top
        "wrap-iife": [2, "any"],         // http://eslint.org/docs/rules/wrap-iife
        "yoda": 2,                       // http://eslint.org/docs/rules/yoda

        /**
         * Style
         */
        "indent": [2, 4],                // http://eslint.org/docs/rules/indent
        "brace-style": [2,               // http://eslint.org/docs/rules/brace-style
            "1tbs", {
                allowSingleLine: true
            }],
        "quotes": [
            0, "single", "avoid-escape"    // http://eslint.org/docs/rules/quotes
        ],
        "camelcase": [2, {               // http://eslint.org/docs/rules/camelcase
            properties: "never"
        }],
        "comma-spacing": [2, {           // http://eslint.org/docs/rules/comma-spacing
            before: false,
            after: true
        }],
        "comma-style": [2, "last"],      // http://eslint.org/docs/rules/comma-style
        "eol-last": 2,                   // http://eslint.org/docs/rules/eol-last
        "func-names": 0,                 // http://eslint.org/docs/rules/func-names
        "key-spacing": [2, {             // http://eslint.org/docs/rules/key-spacing
            beforeColon: false,
            afterColon: true
        }],
        "new-cap": [2, {                 // http://eslint.org/docs/rules/new-cap
            newIsCap: true
        }],
        "no-multiple-empty-lines": [2, { // http://eslint.org/docs/rules/no-multiple-empty-lines
            max: 2
        }],
        "no-nested-ternary": 2,          // http://eslint.org/docs/rules/no-nested-ternary
        "no-new-object": 2,              // http://eslint.org/docs/rules/no-new-object
        "no-spaced-func": 2,             // http://eslint.org/docs/rules/no-spaced-func
        "no-trailing-spaces": 2,         // http://eslint.org/docs/rules/no-trailing-spaces
        "no-undef": 2,                   // https://eslint.org/docs/rules/no-undef
        "no-underscore-dangle": 0,       // http://eslint.org/docs/rules/no-underscore-dangle
        "one-var": [2, "never"],         // http://eslint.org/docs/rules/one-var
        "padded-blocks": [0, "never"],   // http://eslint.org/docs/rules/padded-blocks
        "semi": [2, "always"],           // http://eslint.org/docs/rules/semi
        "semi-spacing": [2, {            // http://eslint.org/docs/rules/semi-spacing
            before: false,
            after: true
        }],
        "keyword-spacing": 2,            // http://eslint.org/docs/rules/keyword-spacing
        "space-before-blocks": 2,        // http://eslint.org/docs/rules/space-before-blocks
        "space-before-function-paren": [2, "never"], // http://eslint.org/docs/rules/space-before-function-paren
        "space-infix-ops": 2,            // http://eslint.org/docs/rules/space-infix-ops
        "spaced-comment": 2,             // http://eslint.org/docs/rules/spaced-comment

        /**
         * JSX style
         */
        "react/jsx-boolean-value": 2,    // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/jsx-boolean-value.md
        "react/jsx-sort-props": 2,       // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/jsx-sort-props.md
        "react/sort-prop-types": 2,      // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/sort-prop-types.md
        "react/no-did-mount-set-state": [2, "disallow-in-func"], // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/no-did-mount-set-state.md
        "react/self-closing-comp": 2,    // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/self-closing-comp.md
        "react/jsx-wrap-multilines": 2,  // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/jsx-wrap-multilines.md
        "react/no-access-state-in-setstate": "error",

        /**
         * Perfectionist                     // https://github.com/azat-io/eslint-plugin-perfectionist
         */
        "perfectionist/sort-imports": [  // https://eslint-plugin-perfectionist.azat.io/rules/sort-imports
            "error",
            {
                "type": "natural",
                "order": "asc",
                "groups": [
                    "type",
                    "react",
                    ["builtin", "external"],
                    "internal-type",
                    "internal",
                    ["parent-type", "sibling-type", "index-type"],
                    ["parent", "sibling", "index"],
                    "side-effect",
                    "style",
                    "object",
                    "unknown"
                ],
                "custom-groups": {
                    value: {
                        react: ["react", "react-*"]
                    }
                },
                "newlines-between": "always"
            }
        ]
    }
};
