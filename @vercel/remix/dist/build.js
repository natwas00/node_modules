"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.build = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const build_utils_1 = require("@vercel/build-utils");
const nft_1 = require("@vercel/nft");
// Name of the Remix runtime adapter npm package for Vercel
const REMIX_RUNTIME_ADAPTER_NAME = '@remix-run/vercel';
// Pinned version of the last verified working version of the adapter
const REMIX_RUNTIME_ADAPTER_VERSION = '1.6.1';
const build = async ({ entrypoint, files, workPath, repoRootPath, config, meta = {}, }) => {
    const { installCommand, buildCommand } = config;
    await (0, build_utils_1.download)(files, workPath, meta);
    const mountpoint = (0, path_1.dirname)(entrypoint);
    const entrypointFsDirname = (0, path_1.join)(workPath, mountpoint);
    // Run "Install Command"
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
    // Ensure `@remix-run/vercel` is in the project's `package.json`
    const packageJsonPath = await (0, build_utils_1.walkParentDirs)({
        base: repoRootPath,
        start: workPath,
        filename: 'package.json',
    });
    if (packageJsonPath) {
        const packageJson = JSON.parse(await fs_1.promises.readFile(packageJsonPath, 'utf8'));
        const { dependencies = {}, devDependencies = {} } = packageJson;
        let modified = false;
        if (REMIX_RUNTIME_ADAPTER_NAME in devDependencies) {
            dependencies[REMIX_RUNTIME_ADAPTER_NAME] =
                devDependencies[REMIX_RUNTIME_ADAPTER_NAME];
            delete devDependencies[REMIX_RUNTIME_ADAPTER_NAME];
            console.log(`Warning: Moving "${REMIX_RUNTIME_ADAPTER_NAME}" from \`devDependencies\` to \`dependencies\`. You should commit this change.`);
            modified = true;
        }
        else if (!(REMIX_RUNTIME_ADAPTER_NAME in dependencies)) {
            dependencies[REMIX_RUNTIME_ADAPTER_NAME] = REMIX_RUNTIME_ADAPTER_VERSION;
            console.log(`Warning: Adding "${REMIX_RUNTIME_ADAPTER_NAME}" v${REMIX_RUNTIME_ADAPTER_VERSION} to \`dependencies\`. You should commit this change.`);
            modified = true;
        }
        if (modified) {
            const packageJsonString = JSON.stringify({
                ...packageJson,
                dependencies,
                devDependencies,
            }, null, 2);
            await fs_1.promises.writeFile(packageJsonPath, `${packageJsonString}\n`);
        }
    }
    else {
        (0, build_utils_1.debug)(`Failed to find "package.json" file in project`);
    }
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
    // Make `remix build` output production mode
    spawnOpts.env.NODE_ENV = 'production';
    // Run "Build Command"
    if (buildCommand) {
        (0, build_utils_1.debug)(`Executing build command "${buildCommand}"`);
        await (0, build_utils_1.execCommand)(buildCommand, {
            ...spawnOpts,
            cwd: entrypointFsDirname,
        });
    }
    else {
        const pkg = await (0, build_utils_1.readConfigFile)((0, path_1.join)(entrypointFsDirname, 'package.json'));
        if (hasScript('vercel-build', pkg)) {
            (0, build_utils_1.debug)(`Executing "yarn vercel-build"`);
            await (0, build_utils_1.runPackageJsonScript)(entrypointFsDirname, 'vercel-build', spawnOpts);
        }
        else if (hasScript('build', pkg)) {
            (0, build_utils_1.debug)(`Executing "yarn build"`);
            await (0, build_utils_1.runPackageJsonScript)(entrypointFsDirname, 'build', spawnOpts);
        }
        else {
            await (0, build_utils_1.execCommand)('remix build', {
                ...spawnOpts,
                cwd: entrypointFsDirname,
            });
        }
    }
    let serverBuildPath = 'build/index.js';
    let needsHandler = true;
    try {
        const remixConfig = require((0, path_1.join)(entrypointFsDirname, 'remix.config'));
        // If `serverBuildTarget === 'vercel'` then Remix will output a handler
        // that is already in Vercel (req, res) format, so don't inject the handler
        if (remixConfig.serverBuildTarget) {
            if (remixConfig.serverBuildTarget !== 'vercel') {
                throw new Error(`\`serverBuildTarget\` in Remix config must be "vercel" (got "${remixConfig.serverBuildTarget}")`);
            }
            serverBuildPath = 'api/index.js';
            needsHandler = false;
        }
        if (remixConfig.serverBuildPath) {
            // Explicit file path where the server output file will be
            serverBuildPath = remixConfig.serverBuildPath;
        }
        else if (remixConfig.serverBuildDirectory) {
            // Explicit directory path the server output will be
            serverBuildPath = (0, path_1.join)(remixConfig.serverBuildDirectory, 'index.js');
        }
        // Also check for whether were in a monorepo.
        // If we are, prepend the app root directory from config onto the build path.
        // e.g. `/apps/my-remix-app/api/index.js`
        const isMonorepo = repoRootPath && repoRootPath !== workPath;
        if (isMonorepo) {
            const rootDirectory = (0, path_1.relative)(repoRootPath, workPath);
            serverBuildPath = (0, path_1.join)(rootDirectory, serverBuildPath);
        }
    }
    catch (err) {
        // Ignore error if `remix.config.js` does not exist
        if (err.code !== 'MODULE_NOT_FOUND')
            throw err;
    }
    const [staticFiles, renderFunction] = await Promise.all([
        (0, build_utils_1.glob)('**', (0, path_1.join)(entrypointFsDirname, 'public')),
        createRenderFunction(entrypointFsDirname, repoRootPath, serverBuildPath, needsHandler, nodeVersion),
    ]);
    return {
        routes: [
            {
                src: '^/build/(.*)$',
                headers: { 'cache-control': 'public, max-age=31536000, immutable' },
                continue: true,
            },
            {
                handle: 'filesystem',
            },
            {
                src: '/(.*)',
                dest: '/render',
            },
        ],
        output: {
            render: renderFunction,
            ...staticFiles,
        },
    };
};
exports.build = build;
function hasScript(scriptName, pkg) {
    const scripts = (pkg && pkg.scripts) || {};
    return typeof scripts[scriptName] === 'string';
}
async function createRenderFunction(entrypointDir, rootDir, serverBuildPath, needsHandler, nodeVersion) {
    const files = {};
    const handler = needsHandler
        ? (0, path_1.join)((0, path_1.dirname)(serverBuildPath), '__vc_handler.js')
        : serverBuildPath;
    const handlerPath = (0, path_1.join)(rootDir, handler);
    if (needsHandler) {
        // Copy the `default-server.js` file into the "build" directory
        const sourceHandlerPath = (0, path_1.join)(__dirname, '../default-server.js');
        await fs_1.promises.copyFile(sourceHandlerPath, handlerPath);
    }
    // Trace the handler with `@vercel/nft`
    const trace = await (0, nft_1.nodeFileTrace)([handlerPath], {
        base: rootDir,
        processCwd: entrypointDir,
    });
    for (const warning of trace.warnings) {
        (0, build_utils_1.debug)(`Warning from trace: ${warning.message}`);
    }
    for (const file of trace.fileList) {
        files[file] = await build_utils_1.FileFsRef.fromFsPath({ fsPath: (0, path_1.join)(rootDir, file) });
    }
    const lambda = new build_utils_1.NodejsLambda({
        files,
        handler,
        runtime: nodeVersion.runtime,
        shouldAddHelpers: false,
        shouldAddSourcemapSupport: false,
        operationType: 'SSR',
    });
    return lambda;
}
//# sourceMappingURL=build.js.map