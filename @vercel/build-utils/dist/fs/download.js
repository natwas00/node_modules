"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadFile = exports.isDirectory = exports.isSymbolicLink = void 0;
const path_1 = __importDefault(require("path"));
const debug_1 = __importDefault(require("../debug"));
const file_fs_ref_1 = __importDefault(require("../file-fs-ref"));
const fs_extra_1 = require("fs-extra");
const stream_to_buffer_1 = __importDefault(require("./stream-to-buffer"));
const STAT = new fs_extra_1.Stats();
function isSymbolicLink(mode) {
    STAT.mode = mode;
    return STAT.isSymbolicLink();
}
exports.isSymbolicLink = isSymbolicLink;
function isDirectory(mode) {
    STAT.mode = mode;
    return STAT.isDirectory();
}
exports.isDirectory = isDirectory;
async function prepareSymlinkTarget(file, fsPath) {
    const mkdirPromise = fs_extra_1.mkdirp(path_1.default.dirname(fsPath));
    if (file.type === 'FileFsRef') {
        const [target] = await Promise.all([fs_extra_1.readlink(file.fsPath), mkdirPromise]);
        return target;
    }
    if (file.type === 'FileRef' || file.type === 'FileBlob') {
        const targetPathBufferPromise = stream_to_buffer_1.default(await file.toStreamAsync());
        const [targetPathBuffer] = await Promise.all([
            targetPathBufferPromise,
            mkdirPromise,
        ]);
        return targetPathBuffer.toString('utf8');
    }
    throw new Error(`file.type "${file.type}" not supported for symlink`);
}
async function downloadFile(file, fsPath) {
    const { mode } = file;
    if (isDirectory(mode)) {
        await fs_extra_1.mkdirp(fsPath);
        return file_fs_ref_1.default.fromFsPath({ mode, fsPath });
    }
    // If the source is a symlink, try to create it instead of copying the file.
    // Note: creating symlinks on Windows requires admin priviliges or symlinks
    // enabled in the group policy. We may want to improve the error message.
    if (isSymbolicLink(mode)) {
        const target = await prepareSymlinkTarget(file, fsPath);
        await fs_extra_1.symlink(target, fsPath);
        return file_fs_ref_1.default.fromFsPath({ mode, fsPath });
    }
    const stream = file.toStream();
    return file_fs_ref_1.default.fromStream({ mode, stream, fsPath });
}
exports.downloadFile = downloadFile;
async function removeFile(basePath, fileMatched) {
    const file = path_1.default.join(basePath, fileMatched);
    await fs_extra_1.remove(file);
}
async function download(files, basePath, meta) {
    const { isDev = false, skipDownload = false, filesChanged = null, filesRemoved = null, } = meta || {};
    if (isDev || skipDownload) {
        // In `vercel dev`, the `download()` function is a no-op because
        // the `basePath` matches the `cwd` of the dev server, so the
        // source files are already available.
        return files;
    }
    debug_1.default('Downloading deployment source files...');
    const start = Date.now();
    const files2 = {};
    const filenames = Object.keys(files);
    await Promise.all(filenames.map(async (name) => {
        // If the file does not exist anymore, remove it.
        if (Array.isArray(filesRemoved) && filesRemoved.includes(name)) {
            await removeFile(basePath, name);
            return;
        }
        // If a file didn't change, do not re-download it.
        if (Array.isArray(filesChanged) && !filesChanged.includes(name)) {
            return;
        }
        // Some builders resolve symlinks and return both
        // a file, node_modules/<symlink>/package.json, and
        // node_modules/<symlink>, a symlink.
        // Removing the file matches how the yazl lambda zip
        // behaves so we can use download() with `vercel build`.
        const parts = name.split('/');
        for (let i = 1; i < parts.length; i++) {
            const dir = parts.slice(0, i).join('/');
            const parent = files[dir];
            if (parent && isSymbolicLink(parent.mode)) {
                console.warn(`Warning: file "${name}" is within a symlinked directory "${dir}" and will be ignored`);
                return;
            }
        }
        const file = files[name];
        const fsPath = path_1.default.join(basePath, name);
        files2[name] = await downloadFile(file, fsPath);
    }));
    const duration = Date.now() - start;
    debug_1.default(`Downloaded ${filenames.length} source files: ${duration}ms`);
    return files2;
}
exports.default = download;
