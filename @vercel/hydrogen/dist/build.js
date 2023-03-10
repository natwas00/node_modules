"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.build = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const build_utils_1 = require("@vercel/build-utils");
const static_config_1 = require("@vercel/static-config");
const ts_morph_1 = require("ts-morph");
const build = async ({ entrypoint, files, workPath, config, meta = {}, }) => {
    const { installCommand, buildCommand } = config;
    await (0, build_utils_1.download)(files, workPath, meta);
    const mountpoint = (0, path_1.dirname)(entrypoint);
    const entrypointDir = (0, path_1.join)(workPath, mountpoint);
    // Run "Install Command"
    const nodeVersion = await (0, build_utils_1.getNodeVersion)(entrypointDir, undefined, config, meta);
    const spawnOpts = (0, build_utils_1.getSpawnOptions)(meta, nodeVersion);
    const { cliType, lockfileVersion } = await (0, build_utils_1.scanParentDirs)(entrypointDir);
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
                cwd: entrypointDir,
            });
        }
        else {
            console.log(`Skipping "install" command...`);
        }
    }
    else {
        await (0, build_utils_1.runNpmInstall)(entrypointDir, [], spawnOpts, meta, nodeVersion);
    }
    // Copy the edge entrypoint file into `.vercel/cache`
    const edgeEntryDir = (0, path_1.join)(workPath, '.vercel/cache/hydrogen');
    const edgeEntryRelative = (0, path_1.relative)(edgeEntryDir, workPath);
    const edgeEntryDest = (0, path_1.join)(edgeEntryDir, 'edge-entry.js');
    let edgeEntryContents = await fs_1.promises.readFile((0, path_1.join)(__dirname, '..', 'edge-entry.js'), 'utf8');
    edgeEntryContents = edgeEntryContents.replace(/__RELATIVE__/g, edgeEntryRelative);
    await fs_1.promises.mkdir(edgeEntryDir, { recursive: true });
    await fs_1.promises.writeFile(edgeEntryDest, edgeEntryContents);
    // Make `shopify hydrogen build` output a Edge Function compatible bundle
    spawnOpts.env.SHOPIFY_FLAG_BUILD_TARGET = 'worker';
    // Use this file as the entrypoint for the Edge Function bundle build
    spawnOpts.env.SHOPIFY_FLAG_BUILD_SSR_ENTRY = edgeEntryDest;
    // Run "Build Command"
    if (buildCommand) {
        (0, build_utils_1.debug)(`Executing build command "${buildCommand}"`);
        await (0, build_utils_1.execCommand)(buildCommand, {
            ...spawnOpts,
            cwd: entrypointDir,
        });
    }
    else {
        const pkg = await (0, build_utils_1.readConfigFile)((0, path_1.join)(entrypointDir, 'package.json'));
        if (hasScript('vercel-build', pkg)) {
            (0, build_utils_1.debug)(`Executing "yarn vercel-build"`);
            await (0, build_utils_1.runPackageJsonScript)(entrypointDir, 'vercel-build', spawnOpts);
        }
        else if (hasScript('build', pkg)) {
            (0, build_utils_1.debug)(`Executing "yarn build"`);
            await (0, build_utils_1.runPackageJsonScript)(entrypointDir, 'build', spawnOpts);
        }
        else {
            await (0, build_utils_1.execCommand)('shopify hydrogen build', {
                ...spawnOpts,
                cwd: entrypointDir,
            });
        }
    }
    const [staticFiles, edgeFunctionFiles] = await Promise.all([
        (0, build_utils_1.glob)('**', (0, path_1.join)(entrypointDir, 'dist/client')),
        (0, build_utils_1.glob)('**', (0, path_1.join)(entrypointDir, 'dist/worker')),
    ]);
    const edgeFunction = new build_utils_1.EdgeFunction({
        name: 'hydrogen',
        deploymentTarget: 'v8-worker',
        entrypoint: 'index.js',
        files: edgeFunctionFiles,
        regions: (() => {
            try {
                const project = new ts_morph_1.Project();
                const config = (0, static_config_1.getConfig)(project, edgeFunctionFiles['index.js'].fsPath);
                return config?.regions;
            }
            catch {
                return undefined;
            }
        })(),
    });
    // The `index.html` file is a template, but we want to serve the
    // SSR version instead, so omit this static file from the output
    delete staticFiles['index.html'];
    return {
        routes: [
            {
                handle: 'filesystem',
            },
            {
                src: '/(.*)',
                dest: '/hydrogen',
            },
        ],
        output: {
            hydrogen: edgeFunction,
            ...staticFiles,
        },
    };
};
exports.build = build;
function hasScript(scriptName, pkg) {
    const scripts = pkg?.scripts || {};
    return typeof scripts[scriptName] === 'string';
}
//# sourceMappingURL=build.js.map