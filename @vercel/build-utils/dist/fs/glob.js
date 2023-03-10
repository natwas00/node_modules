"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const assert_1 = __importDefault(require("assert"));
const glob_1 = __importDefault(require("glob"));
const util_1 = require("util");
const fs_extra_1 = require("fs-extra");
const normalize_path_1 = require("./normalize-path");
const file_fs_ref_1 = __importDefault(require("../file-fs-ref"));
const vanillaGlob = util_1.promisify(glob_1.default);
async function glob(pattern, opts, mountpoint) {
    const options = typeof opts === 'string' ? { cwd: opts } : opts;
    if (!options.cwd) {
        throw new Error('Second argument (basePath) must be specified for names of resulting files');
    }
    if (!path_1.default.isAbsolute(options.cwd)) {
        throw new Error(`basePath/cwd must be an absolute path (${options.cwd})`);
    }
    const results = {};
    const statCache = {};
    const symlinks = {};
    const files = await vanillaGlob(pattern, {
        ...options,
        symlinks,
        statCache,
        stat: true,
        dot: true,
    });
    const dirs = new Set();
    const dirsWithEntries = new Set();
    for (const relativePath of files) {
        const fsPath = normalize_path_1.normalizePath(path_1.default.join(options.cwd, relativePath));
        let stat = statCache[fsPath];
        assert_1.default(stat, `statCache does not contain value for ${relativePath} (resolved to ${fsPath})`);
        const isSymlink = symlinks[fsPath];
        if (isSymlink || stat.isFile() || stat.isDirectory()) {
            if (isSymlink) {
                stat = await fs_extra_1.lstat(fsPath);
            }
            // Some bookkeeping to track which directories already have entries within
            const dirname = path_1.default.dirname(relativePath);
            dirsWithEntries.add(dirname);
            if (stat.isDirectory()) {
                dirs.add(relativePath);
                continue;
            }
            let finalPath = relativePath;
            if (mountpoint) {
                finalPath = path_1.default.join(mountpoint, finalPath);
            }
            results[finalPath] = new file_fs_ref_1.default({ mode: stat.mode, fsPath });
        }
    }
    // Add empty directory entries
    for (const relativePath of dirs) {
        if (dirsWithEntries.has(relativePath))
            continue;
        let finalPath = relativePath;
        if (mountpoint) {
            finalPath = path_1.default.join(mountpoint, finalPath);
        }
        const fsPath = normalize_path_1.normalizePath(path_1.default.join(options.cwd, relativePath));
        const stat = statCache[fsPath];
        results[finalPath] = new file_fs_ref_1.default({ mode: stat.mode, fsPath });
    }
    return results;
}
exports.default = glob;
