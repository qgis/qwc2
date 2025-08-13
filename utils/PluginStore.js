const BuiltInPlugins = {};
const CustomPlugins = {};

export default {
    setBuiltinPlugins(plugins) {
        Object.assign(BuiltInPlugins, plugins);
    },
    addCustomPlugin(name, plugin) {
        if (name in BuiltInPlugins) {
            /* eslint-disable-next-line */
            console.warn("Cannot overwrite builtin plugin " + name);
        } else {
            CustomPlugins[name] = plugin;
        }
    },
    removeCustomPlugin(name) {
        delete CustomPlugins[name];
    },
    getPlugins() {
        return {
            ...BuiltInPlugins,
            ...CustomPlugins
        };
    }
};
