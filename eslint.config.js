import reactPlugin from "eslint-plugin-react";

import babelParser from "@babel/eslint-parser";
import js from "@eslint/js";
import perfectionistPlugin from "eslint-plugin-perfectionist";
import globals from "globals";

export default [
    {
        ignores: ["utils/expr_grammar/"]
    },
    // Base ESLint recommended rules
    js.configs.recommended,
    reactPlugin.configs.flat.recommended,
    {
        files: ["**/*.{js,jsx}"],
        languageOptions: {
            parser: babelParser,
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
            globals: {
                ...globals.browser,
                ...globals.node,
                // Mocha globals
                describe: false,
                it: false,
                before: false,
                beforeEach: false,
                after: false,
                afterEach: false,
                __DEVTOOLS__: false
            }
        },
        plugins: {
            react: reactPlugin,
            perfectionist: perfectionistPlugin
        },
        settings: {
            react: {
                version: "detect"
            }
        },
        rules: {
            /**
             * Strict mode
             */
            "strict": ["error", "never"],

            /**
             * ES6
             */
            "no-var": "error",
            "prefer-const": "error",

            /**
             * Variables
             */
            "no-shadow": "error",
            "no-shadow-restricted-names": "error",
            "no-unused-vars": ["error", { vars: "local", args: "none" }],
            "no-use-before-define": "error",

            /**
             * Possible errors
             */
            "comma-dangle": ["error", "never"],
            "no-console": "warn",
            "no-alert": "warn",
            "quote-props": ["error", "consistent-as-needed"],
            "block-scoped-var": "error",

            /**
             * Best practices
             */
            "consistent-return": "error",
            "curly": ["error", "multi-line"],
            "default-case": "error",
            "dot-notation": ["error", { allowKeywords: true }],
            "eqeqeq": "error",
            "guard-for-in": "error",
            "no-caller": "error",
            "no-eq-null": "error",
            "no-eval": "error",
            "no-extend-native": "error",
            "no-extra-bind": "error",
            "no-extra-semi": "warn",
            "no-floating-decimal": "error",
            "no-implied-eval": "error",
            "no-lone-blocks": "error",
            "no-loop-func": "error",
            "no-multi-str": "error",
            "no-global-assign": "error",
            "no-new": "error",
            "no-new-func": "error",
            "no-new-wrappers": "error",
            "no-octal-escape": "error",
            "no-proto": "error",
            "no-return-assign": "error",
            "no-script-url": "error",
            "no-self-compare": "error",
            "no-sequences": "error",
            "no-throw-literal": "error",
            "radix": "error",
            "vars-on-top": "error",
            "wrap-iife": ["error", "any"],
            "yoda": "error",

            /**
             * Style
             */
            "indent": ["error", 4],
            "brace-style": ["error", "1tbs", { allowSingleLine: true }],
            "quotes": ["off", "single", "avoid-escape"],
            "camelcase": ["error", { properties: "never" }],
            "comma-spacing": ["error", { before: false, after: true }],
            "comma-style": ["error", "last"],
            "eol-last": "error",
            "func-names": "off",
            "key-spacing": ["error", { beforeColon: false, afterColon: true }],
            "new-cap": ["error", { newIsCap: true }],
            "no-multiple-empty-lines": ["error", { max: 2 }],
            "no-nested-ternary": "error",
            "no-new-object": "error",
            "no-spaced-func": "error",
            "no-trailing-spaces": "error",
            "no-undef": "error",
            "no-underscore-dangle": "off",
            "one-var": ["error", "never"],
            "padded-blocks": ["off", "never"],
            "semi": ["error", "always"],
            "semi-spacing": ["error", { before: false, after: true }],
            "keyword-spacing": "error",
            "space-before-blocks": "error",
            "space-before-function-paren": ["error", "never"],
            "space-infix-ops": "error",
            "spaced-comment": "error",

            /**
             * JSX / React
             */
            "react/jsx-boolean-value": "error",
            "react/jsx-sort-props": "error",
            "react/sort-prop-types": "error",
            "react/no-did-mount-set-state": ["error", "disallow-in-func"],
            "react/self-closing-comp": "error",
            "react/jsx-wrap-multilines": "error",
            "react/no-access-state-in-setstate": "error",

            /**
             * Perfectionist
             */
            "perfectionist/sort-imports": [
                "error",
                {
                    type: "natural",
                    order: "asc",
                    groups: [
                        "type",
                        "react",
                        ["builtin", "external"],
                        "type-internal",
                        "internal",
                        ["type-parent", "type-sibling", "type-index"],
                        ["parent", "sibling", "index"],
                        "side-effect",
                        "style",
                        "unknown"
                    ],
                    customGroups: [
                        {
                            groupName: "react",
                            elementNamePattern: ["react", "react-*"]
                        }
                    ],
                    newlinesBetween: 1
                }
            ]
        }
    }
];
