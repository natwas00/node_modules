'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeWildcardRequire = exports.normalizeDefaultRequire = void 0;
function normalizeDefaultRequire(obj) {
    if (obj && obj.__esModule)
        return obj;
    return { default: obj };
}
exports.normalizeDefaultRequire = normalizeDefaultRequire;
const hasOwnProperty = Object.prototype.hasOwnProperty;
function normalizeWildcardRequire(obj) {
    if (obj && obj.__esModule)
        return obj;
    // Note: This implements only value properties and doesn't preserve getters.
    // This follows the simpler helpers generated by TypeScript.
    const out = {};
    for (const key in obj) {
        if (!hasOwnProperty.call(obj, key))
            continue;
        out[key] = obj[key];
    }
    out['default'] = obj;
    return out;
}
exports.normalizeWildcardRequire = normalizeWildcardRequire;
