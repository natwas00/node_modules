"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareCache = exports.build = exports.version = void 0;
const path_1 = require("path");
const fs_1 = require("fs");
const semver_1 = require("semver");
const build_utils_1 = require("@vercel/build-utils");
const nft_1 = require("@vercel/nft");
const routing_utils_1 = require("@vercel/routing-utils");
// Do not change this version for RW specific config,
// it refers to Vercels builder version
exports.version = 2;
const build = async ({ workPath, files, entrypoint, meta = {}, config = {}, }) => {
    await (0, build_utils_1.download)(files, workPath, meta);
    const prefixedEnvs = (0, build_utils_1.getPrefixedEnvVars)({
        envPrefix: 'REDWOOD_ENV_',
        envs: process.env,
    });
    for (const [key, value] of Object.entries(prefixedEnvs)) {
        process.env[key] = value;
    }
    const { installCommand, buildCommand } = config;
    const mountpoint = (0, path_1.dirname)(entrypoint);
    const entrypointFsDirname = (0, path_1.join)(workPath, mountpoint);
    const nodeVersion = await (0, build_utils_1.getNodeVersion)(entrypointFsDirname, undefined, config, meta);
    const spawnOpts = (0, build_utils_1.getSpawnOptions)(meta, nodeVersion);
    if (!spawnOpts.env) {
        spawnOpts.env = {};
    }
    const { cliType, lockfileVersion } = await (0, build_utils_1.scanParentDirs)(entrypointFsDirname);
    spawnOpts.env = (0, build_utils_1.getEnvForPackageManager)({
        cliType,
        lockfileVersion,
        nodeVersion,
        env: spawnOpts.env || {},
    });
    if (typeof installCommand === 'string') {
        if (installCommand.trim()) {
            console.log(`Running "install" command: \`${installCommand}\`...`);
            await (0, build_utils_1.execCommand)(installCommand, {
                ...spawnOpts,
                cwd: entrypointFsDirname,
            });
        }
        else {
            console.log(`Skipping "install" command...`);
        }
    }
    else {
        await (0, build_utils_1.runNpmInstall)(entrypointFsDirname, [], spawnOpts, meta, nodeVersion);
    }
    if (meta.isDev) {
        throw new Error('Detected `@vercel/redwood` dev but this is not supported');
    }
    const pkg = await (0, build_utils_1.readConfigFile)((0, path_1.join)(workPath, 'package.json'));
    const toml = await (0, build_utils_1.readConfigFile)((0, path_1.join)(workPath, 'redwood.toml'));
    if (buildCommand) {
        (0, build_utils_1.debug)(`Executing build command "${buildCommand}"`);
        await (0, build_utils_1.execCommand)(buildCommand, {
            ...spawnOpts,
            cwd: workPath,
        });
    }
    else if (hasScript('vercel-build', pkg)) {
        (0, build_utils_1.debug)(`Executing "yarn vercel-build"`);
        await (0, build_utils_1.runPackageJsonScript)(workPath, 'vercel-build', spawnOpts);
    }
    else if (hasScript('build', pkg)) {
        (0, build_utils_1.debug)(`Executing "yarn build"`);
        await (0, build_utils_1.runPackageJsonScript)(workPath, 'build', spawnOpts);
    }
    else {
        const { devDependencies = {} } = pkg || {};
        const versionRange = devDependencies['@redwoodjs/core'];
        let cmd;
        if (!versionRange || !(0, semver_1.validRange)(versionRange)) {
            console.log('WARNING: Unable to detect RedwoodJS version in package.json devDependencies');
            cmd = 'yarn rw deploy vercel'; // Assume 0.25.0 and newer
        }
        else if ((0, semver_1.intersects)(versionRange, '<0.25.0')) {
            // older than 0.25.0
            cmd =
                'yarn rw build && yarn rw db up --no-db-client --auto-approve && yarn rw dataMigrate up';
        }
        else {
            // 0.25.0 and newer
            cmd = 'yarn rw deploy vercel';
        }
        await (0, build_utils_1.execCommand)(cmd, {
            ...spawnOpts,
            cwd: workPath,
        });
    }
    const apiDir = toml?.web?.apiProxyPath?.replace(/^\//, '') ?? 'api';
    const apiDistPath = (0, path_1.join)(workPath, 'api', 'dist', 'functions');
    const webDistPath = (0, path_1.join)(workPath, 'web', 'dist');
    const lambdaOutputs = {};
    // Strip out the .html extensions
    // And populate staticOutputs map with updated paths and contentType
    const webDistFiles = await (0, build_utils_1.glob)('**', webDistPath);
    const staticOutputs = {};
    for (const [fileName, fileFsRef] of Object.entries(webDistFiles)) {
        const parsedPath = (0, path_1.parse)(fileFsRef.fsPath);
        if (parsedPath.ext !== '.html') {
            // No need to transform non-html files
            staticOutputs[fileName] = fileFsRef;
        }
        else {
            const fileNameWithoutExtension = (0, path_1.basename)(fileName, '.html');
            const pathWithoutHtmlExtension = (0, path_1.join)(parsedPath.dir, fileNameWithoutExtension);
            fileFsRef.contentType = 'text/html; charset=utf-8';
            // @NOTE: Filename is relative to webDistPath
            // e.g. {'./200': fsRef}
            staticOutputs[(0, path_1.relative)(webDistPath, pathWithoutHtmlExtension)] =
                fileFsRef;
        }
    }
    // Each file in the `functions` dir will become a lambda
    // Also supports nested functions like:
    // ????????? functions
    // ???   ????????? bazinga
    // ???   ???   ????????? bazinga.js
    // ???   ????????? graphql.js
    const functionFiles = {
        ...(await (0, build_utils_1.glob)('*.js', apiDistPath)),
        ...(await (0, build_utils_1.glob)('*/*.js', apiDistPath)), // one-level deep
    };
    const sourceCache = new Map();
    const fsCache = new Map();
    for (const [funcName, fileFsRef] of Object.entries(functionFiles)) {
        const outputName = (0, path_1.join)(apiDir, (0, path_1.parse)(funcName).name); // remove `.js` extension
        const absEntrypoint = fileFsRef.fsPath;
        const relativeEntrypoint = (0, path_1.relative)(workPath, absEntrypoint);
        const awsLambdaHandler = getAWSLambdaHandler(relativeEntrypoint, 'handler');
        const sourceFile = relativeEntrypoint.replace('/dist/', '/src/');
        const { fileList, esmFileList, warnings } = await (0, nft_1.nodeFileTrace)([absEntrypoint], {
            base: workPath,
            processCwd: workPath,
            ts: true,
            mixedModules: true,
            ignore: config.excludeFiles,
            async readFile(fsPath) {
                const relPath = (0, path_1.relative)(workPath, fsPath);
                const cached = sourceCache.get(relPath);
                if (cached)
                    return cached.toString();
                // null represents a not found
                if (cached === null)
                    return null;
                try {
                    const source = (0, fs_1.readFileSync)(fsPath);
                    const { mode } = (0, fs_1.lstatSync)(fsPath);
                    let entry;
                    if ((0, build_utils_1.isSymbolicLink)(mode)) {
                        entry = new build_utils_1.FileFsRef({ fsPath, mode });
                    }
                    else {
                        entry = new build_utils_1.FileBlob({ data: source, mode });
                    }
                    fsCache.set(relPath, entry);
                    sourceCache.set(relPath, source);
                    return source.toString();
                }
                catch (e) {
                    if (e.code === 'ENOENT' || e.code === 'EISDIR') {
                        sourceCache.set(relPath, null);
                        return null;
                    }
                    throw e;
                }
            },
        });
        for (const warning of warnings) {
            (0, build_utils_1.debug)(`Warning from trace: ${warning.message}`);
        }
        const lambdaFiles = {};
        const allFiles = [...fileList, ...esmFileList];
        for (const filePath of allFiles) {
            lambdaFiles[filePath] = await build_utils_1.FileFsRef.fromFsPath({
                fsPath: (0, path_1.join)(workPath, filePath),
            });
        }
        lambdaFiles[(0, path_1.relative)(workPath, fileFsRef.fsPath)] = fileFsRef;
        const { memory, maxDuration } = await (0, build_utils_1.getLambdaOptionsFromFunction)({
            sourceFile,
            config,
        });
        const lambda = new build_utils_1.NodejsLambda({
            files: lambdaFiles,
            handler: relativeEntrypoint,
            runtime: nodeVersion.runtime,
            memory,
            maxDuration,
            shouldAddHelpers: false,
            shouldAddSourcemapSupport: false,
            awsLambdaHandler,
        });
        lambdaOutputs[outputName] = lambda;
    }
    // Older versions of redwood did not create 200.html automatically
    // From v0.50.0+ 200.html is always generated as part of web build
    // Note that in builder post-processing, we remove the .html extension
    const fallbackHtmlPage = (0, fs_1.existsSync)((0, path_1.join)(webDistPath, '200.html'))
        ? '/200'
        : '/index';
    const defaultRoutesConfig = (0, routing_utils_1.getTransformedRoutes)({
        // this makes sure we send back 200.html for unprerendered pages
        rewrites: [{ source: '/(.*)', destination: fallbackHtmlPage }],
        cleanUrls: true,
        trailingSlash: false,
    });
    if (defaultRoutesConfig.error) {
        throw new Error(defaultRoutesConfig.error.message);
    }
    return {
        output: { ...staticOutputs, ...lambdaOutputs },
        routes: defaultRoutesConfig.routes,
    };
};
exports.build = build;
function getAWSLambdaHandler(filePath, handlerName) {
    const { dir, name } = (0, path_1.parse)(filePath);
    return `${dir}${dir ? path_1.sep : ''}${name}.${handlerName}`;
}
function hasScript(scriptName, pkg) {
    const scripts = (pkg && pkg.scripts) || {};
    return typeof scripts[scriptName] === 'string';
}
const prepareCache = ({ repoRootPath, workPath }) => {
    return (0, build_utils_1.glob)('**/node_modules/**', repoRootPath || workPath);
};
exports.prepareCache = prepareCache;
