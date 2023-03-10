"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isObjectEmpty = exports.writePackageJson = exports.readPackageJson = exports.fileExists = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
async function fileExists(path) {
    return fs_1.promises.access(path, fs_1.constants.F_OK).then(() => true, () => false);
}
exports.fileExists = fileExists;
/**
 * Read package.json from files
 */
async function readPackageJson(entryPath) {
    const packagePath = path_1.default.join(entryPath, 'package.json');
    try {
        return JSON.parse(await fs_1.promises.readFile(packagePath, 'utf8'));
    }
    catch (err) {
        return {};
    }
}
exports.readPackageJson = readPackageJson;
/**
 * Write package.json
 */
async function writePackageJson(workPath, packageJson) {
    await fs_1.promises.writeFile(path_1.default.join(workPath, 'package.json'), JSON.stringify(packageJson, null, 2));
}
exports.writePackageJson = writePackageJson;
function isObjectEmpty(object) {
    for (const _prop in object) {
        return false;
    }
    return true;
}
exports.isObjectEmpty = isObjectEmpty;
