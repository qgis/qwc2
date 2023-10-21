// The module property should point to a script that utilizes ES2015 module
// syntax but no other syntax features that aren't yet supported by browsers or
// node. This enables webpack to parse the module syntax itself, allowing for
// lighter bundles via tree shaking if users are only consuming certain parts of
// the library.

export * from './actions';
export * from './utils';
