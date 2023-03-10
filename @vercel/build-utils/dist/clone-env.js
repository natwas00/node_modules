"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloneEnv = void 0;
const { hasOwnProperty } = Object.prototype;
/**
 * Clones zero or more objects into a single new object while ensuring that the
 * `PATH` environment variable is defined when the `PATH` or `Path` environment
 * variables are defined.
 *
 * @param {Object} [...envs] Objects and/or `process.env` to clone and merge
 * @returns {Object} The new object
 */
function cloneEnv(...envs) {
    return envs.reduce((obj, env) => {
        if (env === undefined || env === null) {
            return obj;
        }
        // mixin the env first
        obj = Object.assign(obj, env);
        if (hasOwnProperty.call(env, 'Path')) {
            // the system path is called `Path` on Windows and Node.js will
            // automatically return the system path when accessing `PATH`,
            // however we lose this proxied value when we destructure and
            // thus we must explicitly copy it, but we must also remove the
            // `Path` property since we can't have both a `PATH` and `Path`
            obj.PATH = obj.Path;
            delete obj.Path;
        }
        return obj;
    }, {});
}
exports.cloneEnv = cloneEnv;
