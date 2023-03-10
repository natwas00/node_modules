"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.serverBuild = void 0;
const path_1 = __importDefault(require("path"));
const semver_1 = __importDefault(require("semver"));
const async_sema_1 = require("async-sema");
const build_utils_1 = require("@vercel/build-utils");
const _1 = require(".");
const utils_1 = require("./utils");
const nft_1 = require("@vercel/nft");
const resolve_from_1 = __importDefault(require("resolve-from"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const escape_string_regexp_1 = __importDefault(require("escape-string-regexp"));
const pretty_bytes_1 = __importDefault(require("pretty-bytes"));
// related PR: https://github.com/vercel/next.js/pull/30046
const CORRECT_NOT_FOUND_ROUTES_VERSION = 'v12.0.1';
const CORRECT_MIDDLEWARE_ORDER_VERSION = 'v12.1.7-canary.29';
const NEXT_DATA_MIDDLEWARE_RESOLVING_VERSION = 'v12.1.7-canary.33';
const EMPTY_ALLOW_QUERY_FOR_PRERENDERED_VERSION = 'v12.2.0';
const CORRECTED_MANIFESTS_VERSION = 'v12.2.0';
async function serverBuild({ dynamicPages, pagesDir, config = {}, privateOutputs, baseDir, workPath, entryPath, nodeVersion, buildId, escapedBuildId, dynamicPrefix, entryDirectory, outputDirectory, redirects, beforeFilesRewrites, afterFilesRewrites, fallbackRewrites, headers, dataRoutes, hasIsr404Page, hasIsr500Page, imagesManifest, wildcardConfig, routesManifest, staticPages, lambdaPages, nextVersion, lambdaAppPaths, canUsePreviewMode, trailingSlash, prerenderManifest, appPathRoutesManifest, omittedPrerenderRoutes, trailingSlashRedirects, isCorrectLocaleAPIRoutes, lambdaCompressedByteLimit, requiredServerFilesManifest, }) {
    lambdaPages = Object.assign({}, lambdaPages, lambdaAppPaths);
    const lambdas = {};
    const prerenders = {};
    const lambdaPageKeys = Object.keys(lambdaPages);
    const internalPages = ['_app.js', '_error.js', '_document.js'];
    const pageBuildTraces = await (0, build_utils_1.glob)('**/*.js.nft.json', pagesDir);
    const isEmptyAllowQueryForPrendered = semver_1.default.gte(nextVersion, EMPTY_ALLOW_QUERY_FOR_PRERENDERED_VERSION);
    let appBuildTraces = {};
    let appDir = null;
    if (appPathRoutesManifest) {
        appDir = path_1.default.join(pagesDir, '../app');
        appBuildTraces = await (0, build_utils_1.glob)('**/*.js.nft.json', appDir);
    }
    const isCorrectNotFoundRoutes = semver_1.default.gte(nextVersion, CORRECT_NOT_FOUND_ROUTES_VERSION);
    const isCorrectMiddlewareOrder = semver_1.default.gte(nextVersion, CORRECT_MIDDLEWARE_ORDER_VERSION);
    const isCorrectManifests = semver_1.default.gte(nextVersion, CORRECTED_MANIFESTS_VERSION);
    let hasStatic500 = !!staticPages[path_1.default.posix.join(entryDirectory, '500')];
    if (lambdaPageKeys.length === 0) {
        throw new build_utils_1.NowBuildError({
            code: 'NEXT_NO_SERVER_PAGES',
            message: 'No server pages were built',
            link: 'https://err.sh/vercel/vercel/now-next-no-serverless-pages-built',
        });
    }
    const pageMatchesApi = (page) => {
        return page.startsWith('api/') || page === 'api.js';
    };
    const { i18n } = routesManifest;
    const hasPages404 = routesManifest.pages404;
    let static404Page = staticPages[path_1.default.posix.join(entryDirectory, '404')] && hasPages404
        ? path_1.default.posix.join(entryDirectory, '404')
        : staticPages[path_1.default.posix.join(entryDirectory, '_errors/404')]
            ? path_1.default.posix.join(entryDirectory, '_errors/404')
            : undefined;
    if (!static404Page && i18n) {
        static404Page = staticPages[path_1.default.posix.join(entryDirectory, i18n.defaultLocale, '404')]
            ? path_1.default.posix.join(entryDirectory, i18n.defaultLocale, '404')
            : undefined;
    }
    if (!hasStatic500 && i18n) {
        hasStatic500 =
            !!staticPages[path_1.default.posix.join(entryDirectory, i18n.defaultLocale, '500')];
    }
    const lstatSema = new async_sema_1.Sema(25);
    const lstatResults = {};
    const nonLambdaSsgPages = new Set();
    Object.keys(prerenderManifest.staticRoutes).forEach(route => {
        const result = (0, utils_1.onPrerenderRouteInitial)(prerenderManifest, canUsePreviewMode, entryDirectory, nonLambdaSsgPages, route, routesManifest.pages404, routesManifest, appDir);
        if (result && result.static404Page) {
            static404Page = result.static404Page;
        }
        if (result && result.static500Page) {
            hasStatic500 = true;
        }
    });
    const hasLambdas = !static404Page ||
        lambdaPageKeys.some(page => !internalPages.includes(page) &&
            !nonLambdaSsgPages.has('/' + page.replace(/\.js$/, '')));
    if (lambdaPages['404.js']) {
        internalPages.push('404.js');
    }
    const prerenderRoutes = new Set([
        ...(canUsePreviewMode ? omittedPrerenderRoutes : []),
        ...Object.keys(prerenderManifest.blockingFallbackRoutes),
        ...Object.keys(prerenderManifest.fallbackRoutes),
        ...Object.keys(prerenderManifest.staticRoutes).map(route => {
            const staticRoute = prerenderManifest.staticRoutes[route];
            return staticRoute.srcRoute || route;
        }),
    ]);
    if (hasLambdas) {
        const initialTracingLabel = 'Traced Next.js server files in';
        console.time(initialTracingLabel);
        const initialTracedFiles = {};
        let initialFileList;
        let initialFileReasons;
        let nextServerBuildTrace;
        const nextServerFile = (0, resolve_from_1.default)(requiredServerFilesManifest.appDir || entryPath, `${(0, utils_1.getNextServerPath)(nextVersion)}/next-server.js`);
        try {
            // leverage next-server trace from build if available
            nextServerBuildTrace = JSON.parse(await fs_extra_1.default.readFile(path_1.default.join(entryPath, outputDirectory, 'next-server.js.nft.json'), 'utf8'));
        }
        catch (_) {
            // if the trace is unavailable we trace inside the runtime
        }
        if (nextServerBuildTrace) {
            initialFileList = nextServerBuildTrace.files.map((file) => {
                return path_1.default.relative(baseDir, path_1.default.join(entryPath, outputDirectory, file));
            });
            initialFileReasons = new Map();
            (0, build_utils_1.debug)('Using next-server.js.nft.json trace from build');
        }
        else {
            (0, build_utils_1.debug)('tracing initial Next.js server files');
            const result = await (0, nft_1.nodeFileTrace)([nextServerFile], {
                base: baseDir,
                cache: {},
                processCwd: entryPath,
                ignore: [
                    ...requiredServerFilesManifest.ignore.map(file => path_1.default.join(entryPath, file)),
                    'node_modules/next/dist/pages/**/*',
                    `node_modules/${(0, utils_1.getNextServerPath)(nextVersion)}/lib/squoosh/**/*.wasm`,
                    'node_modules/next/dist/compiled/webpack/(bundle4|bundle5).js',
                    'node_modules/react/**/*.development.js',
                    'node_modules/react-dom/**/*.development.js',
                    'node_modules/use-subscription/**/*.development.js',
                    'node_modules/sharp/**/*',
                ],
            });
            initialFileList = Array.from(result.fileList);
            initialFileReasons = result.reasons;
        }
        (0, build_utils_1.debug)('collecting initial Next.js server files');
        await Promise.all(initialFileList.map((0, utils_1.collectTracedFiles)(baseDir, lstatResults, lstatSema, initialFileReasons, initialTracedFiles)));
        (0, build_utils_1.debug)('creating initial pseudo layer');
        const initialPseudoLayer = await (0, utils_1.createPseudoLayer)(initialTracedFiles);
        console.timeEnd(initialTracingLabel);
        const lambdaCreationLabel = 'Created all serverless functions in';
        console.time(lambdaCreationLabel);
        const apiPages = [];
        const nonApiPages = [];
        const streamingPages = [];
        lambdaPageKeys.forEach(page => {
            if (internalPages.includes(page) &&
                page !== '404.js' &&
                !(page === '_error.js' && !(static404Page || lambdaPages['404.js']))) {
                return;
            }
            const pathname = page.replace(/\.js$/, '');
            if (nonLambdaSsgPages.has(pathname)) {
                return;
            }
            if ((0, utils_1.isDynamicRoute)(pathname)) {
                dynamicPages.push((0, utils_1.normalizePage)(pathname));
            }
            if (pageMatchesApi(page)) {
                apiPages.push(page);
            }
            else if (appDir && lambdaAppPaths[page]) {
                streamingPages.push(page);
            }
            else {
                nonApiPages.push(page);
            }
        });
        const requiredFiles = {};
        requiredFiles[path_1.default.relative(baseDir, nextServerFile)] = new build_utils_1.FileFsRef({
            mode: (await fs_extra_1.default.lstat(nextServerFile)).mode,
            fsPath: nextServerFile,
        });
        if (static404Page) {
            // ensure static 404 page file is included in all lambdas
            // for notFound GS(S)P support
            if (i18n) {
                for (const locale of i18n.locales) {
                    const static404File = staticPages[path_1.default.posix.join(entryDirectory, locale, '/404')] ||
                        new build_utils_1.FileFsRef({
                            fsPath: path_1.default.join(pagesDir, locale, '/404.html'),
                        });
                    requiredFiles[path_1.default.relative(baseDir, static404File.fsPath)] =
                        static404File;
                }
            }
            else {
                const static404File = staticPages[static404Page] ||
                    new build_utils_1.FileFsRef({
                        fsPath: path_1.default.join(pagesDir, '/404.html'),
                    });
                requiredFiles[path_1.default.relative(baseDir, static404File.fsPath)] =
                    static404File;
            }
        }
        // TODO: move this into Next.js' required server files manifest
        const envFiles = [];
        for (const file of await fs_extra_1.default.readdir(workPath)) {
            const isEnv = file === '.env' || file.startsWith('.env.');
            if (isEnv) {
                const statResult = await fs_extra_1.default.lstat(path_1.default.join(workPath, file));
                if (statResult.isFile()) {
                    envFiles.push(file);
                }
            }
        }
        for (const envFile of envFiles) {
            requiredFiles[path_1.default.join(path_1.default.relative(baseDir, entryPath), envFile)] =
                new build_utils_1.FileFsRef({
                    fsPath: path_1.default.join(workPath, envFile),
                });
        }
        await Promise.all(requiredServerFilesManifest.files.map(async (file) => {
            await lstatSema.acquire();
            let fsPath = path_1.default.join(entryPath, 
            // remove last part of outputDirectory `.next` since this is already
            // included in the file path
            path_1.default.join(outputDirectory, '..'), file);
            if (requiredServerFilesManifest.appDir) {
                fsPath = path_1.default.join(requiredServerFilesManifest.appDir, file);
            }
            const relativePath = path_1.default.relative(baseDir, fsPath);
            const { mode } = await fs_extra_1.default.lstat(fsPath);
            lstatSema.release();
            requiredFiles[relativePath] = new build_utils_1.FileFsRef({
                mode,
                fsPath,
            });
        }));
        // add required files and internal pages to initial pseudo layer
        // so that we account for these in the size of each page group
        const requiredFilesLayer = await (0, utils_1.createPseudoLayer)(requiredFiles);
        Object.assign(initialPseudoLayer.pseudoLayer, requiredFilesLayer.pseudoLayer);
        initialPseudoLayer.pseudoLayerBytes += requiredFilesLayer.pseudoLayerBytes;
        const uncompressedInitialSize = Object.keys(initialPseudoLayer.pseudoLayer).reduce((prev, cur) => {
            const file = initialPseudoLayer.pseudoLayer[cur];
            return prev + file.uncompressedSize || 0;
        }, 0);
        (0, build_utils_1.debug)(JSON.stringify({
            uncompressedInitialSize,
            compressedInitialSize: initialPseudoLayer.pseudoLayerBytes,
        }, null, 2));
        if (initialPseudoLayer.pseudoLayerBytes > lambdaCompressedByteLimit ||
            uncompressedInitialSize > utils_1.MAX_UNCOMPRESSED_LAMBDA_SIZE) {
            console.log(`Warning: Max serverless function size of ${(0, pretty_bytes_1.default)(lambdaCompressedByteLimit)} compressed or ${(0, pretty_bytes_1.default)(utils_1.MAX_UNCOMPRESSED_LAMBDA_SIZE)} uncompressed reached`);
            (0, utils_1.outputFunctionFileSizeInfo)([], initialPseudoLayer.pseudoLayer, initialPseudoLayer.pseudoLayerBytes, uncompressedInitialSize, {});
            throw new build_utils_1.NowBuildError({
                message: `Required files read using Node.js fs library and node_modules exceed max lambda size of ${lambdaCompressedByteLimit} bytes`,
                code: 'NEXT_REQUIRED_FILES_LIMIT',
                link: 'https://vercel.com/docs/platform/limits#serverless-function-size',
            });
        }
        const launcherData = await fs_extra_1.default.readFile(path_1.default.join(__dirname, 'server-launcher.js'), 'utf8');
        let launcher = launcherData
            .replace('conf: __NEXT_CONFIG__', `conf: ${JSON.stringify({
            ...requiredServerFilesManifest.config,
            distDir: path_1.default.relative(requiredServerFilesManifest.appDir || entryPath, path_1.default.join(entryPath, outputDirectory)),
            compress: false,
        })}`)
            .replace('__NEXT_SERVER_PATH__', `${(0, utils_1.getNextServerPath)(nextVersion)}/next-server.js`);
        if (entryDirectory !== '.' &&
            path_1.default.posix.join('/', entryDirectory) !== routesManifest.basePath) {
            // we normalize the entryDirectory in the request URL since
            // Next.js isn't aware of it and it isn't included in the
            // x-matched-path header
            launcher = launcher.replace('// entryDirectory handler', `req.url = req.url.replace(/^${path_1.default.posix
                .join('/', entryDirectory)
                .replace(/\//g, '\\/')}/, '')`);
        }
        const launcherFiles = {
            [path_1.default.join(path_1.default.relative(baseDir, requiredServerFilesManifest.appDir || entryPath), '___next_launcher.cjs')]: new build_utils_1.FileBlob({ data: launcher }),
        };
        const pageTraces = {};
        const compressedPages = {};
        const mergedPageKeys = [
            ...nonApiPages,
            ...streamingPages,
            ...apiPages,
            ...internalPages,
        ];
        const traceCache = {};
        const getOriginalPagePath = (page) => {
            let originalPagePath = page;
            if (appDir && lambdaAppPaths[page]) {
                const { fsPath } = lambdaAppPaths[page];
                originalPagePath = path_1.default.relative(appDir, fsPath);
            }
            return originalPagePath;
        };
        const getBuildTraceFile = (page) => {
            return (pageBuildTraces[page + '.nft.json'] ||
                appBuildTraces[page + '.nft.json']);
        };
        const pathsToTrace = mergedPageKeys
            .map(page => {
            if (!getBuildTraceFile(page)) {
                return lambdaPages[page].fsPath;
            }
        })
            .filter(Boolean);
        let traceResult;
        let parentFilesMap;
        if (pathsToTrace.length > 0) {
            traceResult = await (0, nft_1.nodeFileTrace)(pathsToTrace, {
                base: baseDir,
                cache: traceCache,
                processCwd: requiredServerFilesManifest.appDir || entryPath,
            });
            traceResult.esmFileList.forEach(file => traceResult?.fileList.add(file));
            parentFilesMap = (0, utils_1.getFilesMapFromReasons)(traceResult.fileList, traceResult.reasons);
        }
        for (const page of mergedPageKeys) {
            const tracedFiles = {};
            const originalPagePath = getOriginalPagePath(page);
            const pageBuildTrace = getBuildTraceFile(originalPagePath);
            let fileList;
            let reasons;
            if (pageBuildTrace) {
                const { files } = JSON.parse(await fs_extra_1.default.readFile(pageBuildTrace.fsPath, 'utf8'));
                // TODO: this will be moved to a separate worker in the future
                // although currently this is needed in the lambda
                const isAppPath = appDir && lambdaAppPaths[page];
                const serverComponentFile = isAppPath
                    ? pageBuildTrace.fsPath.replace(/\.js\.nft\.json$/, '.__sc_client__.js')
                    : null;
                if (serverComponentFile && (await fs_extra_1.default.pathExists(serverComponentFile))) {
                    files.push(path_1.default.relative(path_1.default.dirname(pageBuildTrace.fsPath), serverComponentFile));
                    try {
                        const scTrace = JSON.parse(await fs_extra_1.default.readFile(`${serverComponentFile}.nft.json`, 'utf8'));
                        scTrace.files.forEach((file) => files.push(file));
                    }
                    catch (err) {
                        /* non-fatal for now */
                    }
                }
                fileList = [];
                const curPagesDir = isAppPath && appDir ? appDir : pagesDir;
                const pageDir = path_1.default.dirname(path_1.default.join(curPagesDir, originalPagePath));
                const normalizedBaseDir = `${baseDir}${baseDir.endsWith(path_1.default.sep) ? '' : path_1.default.sep}`;
                files.forEach((file) => {
                    const absolutePath = path_1.default.join(pageDir, file);
                    // ensure we don't attempt including files outside
                    // of the base dir e.g. `/bin/sh`
                    if (absolutePath.startsWith(normalizedBaseDir)) {
                        fileList.push(path_1.default.relative(baseDir, absolutePath));
                    }
                });
                reasons = new Map();
            }
            else {
                fileList = Array.from(parentFilesMap?.get(path_1.default.relative(baseDir, lambdaPages[page].fsPath)) || []);
                if (!fileList) {
                    throw new Error(`Invariant: Failed to trace ${page}, missing fileList`);
                }
                reasons = traceResult?.reasons || new Map();
            }
            await Promise.all(fileList.map((0, utils_1.collectTracedFiles)(baseDir, lstatResults, lstatSema, reasons, tracedFiles)));
            pageTraces[page] = tracedFiles;
            compressedPages[page] = (await (0, utils_1.createPseudoLayer)({
                [page]: lambdaPages[page],
            })).pseudoLayer[page];
        }
        const tracedPseudoLayer = await (0, utils_1.createPseudoLayer)(mergedPageKeys.reduce((prev, page) => {
            Object.assign(prev, pageTraces[page]);
            return prev;
        }, {}));
        const pageExtensions = requiredServerFilesManifest.config?.pageExtensions;
        const pageLambdaGroups = await (0, utils_1.getPageLambdaGroups)({
            entryPath: requiredServerFilesManifest.appDir || entryPath,
            config,
            pages: nonApiPages,
            prerenderRoutes,
            pageTraces,
            compressedPages,
            tracedPseudoLayer: tracedPseudoLayer.pseudoLayer,
            initialPseudoLayer,
            lambdaCompressedByteLimit,
            initialPseudoLayerUncompressed: uncompressedInitialSize,
            internalPages,
            pageExtensions,
        });
        const streamingPageLambdaGroups = await (0, utils_1.getPageLambdaGroups)({
            entryPath: requiredServerFilesManifest.appDir || entryPath,
            config,
            pages: streamingPages,
            prerenderRoutes,
            pageTraces,
            compressedPages,
            tracedPseudoLayer: tracedPseudoLayer.pseudoLayer,
            initialPseudoLayer,
            lambdaCompressedByteLimit,
            initialPseudoLayerUncompressed: uncompressedInitialSize,
            internalPages,
            pageExtensions,
        });
        for (const group of streamingPageLambdaGroups) {
            if (!group.isPrerenders) {
                group.isStreaming = true;
            }
        }
        const apiLambdaGroups = await (0, utils_1.getPageLambdaGroups)({
            entryPath: requiredServerFilesManifest.appDir || entryPath,
            config,
            pages: apiPages,
            prerenderRoutes,
            pageTraces,
            compressedPages,
            tracedPseudoLayer: tracedPseudoLayer.pseudoLayer,
            initialPseudoLayer,
            initialPseudoLayerUncompressed: uncompressedInitialSize,
            lambdaCompressedByteLimit,
            internalPages,
        });
        (0, build_utils_1.debug)(JSON.stringify({
            apiLambdaGroups: apiLambdaGroups.map(group => ({
                pages: group.pages,
                isPrerender: group.isPrerenders,
                pseudoLayerBytes: group.pseudoLayerBytes,
                uncompressedLayerBytes: group.pseudoLayerUncompressedBytes,
            })),
            pageLambdaGroups: pageLambdaGroups.map(group => ({
                pages: group.pages,
                isPrerender: group.isPrerenders,
                pseudoLayerBytes: group.pseudoLayerBytes,
                uncompressedLayerBytes: group.pseudoLayerUncompressedBytes,
            })),
            streamingPageLambdaGroups: streamingPageLambdaGroups.map(group => ({
                pages: group.pages,
                isPrerender: group.isPrerenders,
                pseudoLayerBytes: group.pseudoLayerBytes,
                uncompressedLayerBytes: group.pseudoLayerUncompressedBytes,
            })),
            nextServerLayerSize: initialPseudoLayer.pseudoLayerBytes,
        }, null, 2));
        const combinedGroups = [
            ...pageLambdaGroups,
            ...streamingPageLambdaGroups,
            ...apiLambdaGroups,
        ];
        await (0, utils_1.detectLambdaLimitExceeding)(combinedGroups, lambdaCompressedByteLimit, compressedPages);
        for (const group of combinedGroups) {
            const groupPageFiles = {};
            for (const page of [...group.pages, ...internalPages]) {
                const pageFileName = path_1.default.normalize(path_1.default.relative(baseDir, lambdaPages[page].fsPath));
                groupPageFiles[pageFileName] = compressedPages[page];
            }
            const updatedManifestFiles = {};
            if (isCorrectManifests) {
                // filter dynamic routes to only the included dynamic routes
                // in this specific serverless function so that we don't
                // accidentally match a dynamic route while resolving that
                // is not actually in this specific serverless function
                for (const manifest of [
                    'routes-manifest.json',
                    'server/pages-manifest.json',
                ]) {
                    const fsPath = path_1.default.join(entryPath, outputDirectory, manifest);
                    const relativePath = path_1.default.relative(baseDir, fsPath);
                    delete group.pseudoLayer[relativePath];
                    const manifestData = await fs_extra_1.default.readJSON(fsPath);
                    const normalizedPages = new Set(group.pages.map(page => {
                        page = `/${page.replace(/\.js$/, '')}`;
                        if (page === '/index')
                            page = '/';
                        return page;
                    }));
                    switch (manifest) {
                        case 'routes-manifest.json': {
                            const filterItem = (item) => normalizedPages.has(item.page);
                            manifestData.dynamicRoutes =
                                manifestData.dynamicRoutes?.filter(filterItem);
                            manifestData.staticRoutes =
                                manifestData.staticRoutes?.filter(filterItem);
                            break;
                        }
                        case 'server/pages-manifest.json': {
                            for (const key of Object.keys(manifestData)) {
                                if ((0, utils_1.isDynamicRoute)(key) && !normalizedPages.has(key)) {
                                    delete manifestData[key];
                                }
                            }
                            break;
                        }
                        default: {
                            throw new build_utils_1.NowBuildError({
                                message: `Unexpected manifest value ${manifest}, please contact support if this continues`,
                                code: 'NEXT_MANIFEST_INVARIANT',
                            });
                        }
                    }
                    updatedManifestFiles[relativePath] = new build_utils_1.FileBlob({
                        contentType: 'application/json',
                        data: JSON.stringify(manifestData),
                    });
                }
            }
            const lambda = await (0, utils_1.createLambdaFromPseudoLayers)({
                files: {
                    ...launcherFiles,
                    ...updatedManifestFiles,
                },
                layers: [group.pseudoLayer, groupPageFiles],
                handler: path_1.default.join(path_1.default.relative(baseDir, requiredServerFilesManifest.appDir || entryPath), '___next_launcher.cjs'),
                memory: group.memory,
                runtime: nodeVersion.runtime,
                maxDuration: group.maxDuration,
                isStreaming: group.isStreaming,
            });
            for (const page of group.pages) {
                const pageNoExt = page.replace(/\.js$/, '');
                let isPrerender = prerenderRoutes.has(path_1.default.join('/', pageNoExt === 'index' ? '' : pageNoExt));
                if (!isPrerender && routesManifest?.i18n) {
                    isPrerender = routesManifest.i18n.locales.some(locale => {
                        return prerenderRoutes.has(path_1.default.join('/', locale, pageNoExt === 'index' ? '' : pageNoExt));
                    });
                }
                const outputName = (0, utils_1.normalizeIndexOutput)(path_1.default.posix.join(entryDirectory, pageNoExt), true);
                // we add locale prefixed outputs for SSR pages,
                // this is handled in onPrerenderRoute for SSG pages
                if (i18n &&
                    !isPrerender &&
                    (!isCorrectLocaleAPIRoutes ||
                        !(pageNoExt === 'api' || pageNoExt.startsWith('api/')))) {
                    for (const locale of i18n.locales) {
                        lambdas[(0, utils_1.normalizeIndexOutput)(path_1.default.posix.join(entryDirectory, locale, pageNoExt === 'index' ? '' : pageNoExt), true)] = lambda;
                    }
                }
                else {
                    lambdas[outputName] = lambda;
                }
            }
        }
        console.timeEnd(lambdaCreationLabel);
    }
    const prerenderRoute = (0, utils_1.onPrerenderRoute)({
        appDir,
        pagesDir,
        pageLambdaMap: {},
        lambdas,
        prerenders,
        entryDirectory,
        routesManifest,
        prerenderManifest,
        appPathRoutesManifest,
        isServerMode: true,
        isSharedLambdas: false,
        canUsePreviewMode,
        static404Page,
        hasPages404: routesManifest.pages404,
        isCorrectNotFoundRoutes,
        isEmptyAllowQueryForPrendered,
    });
    Object.keys(prerenderManifest.staticRoutes).forEach(route => prerenderRoute(route, {}));
    Object.keys(prerenderManifest.fallbackRoutes).forEach(route => prerenderRoute(route, { isFallback: true }));
    Object.keys(prerenderManifest.blockingFallbackRoutes).forEach(route => prerenderRoute(route, { isBlocking: true }));
    if (static404Page && canUsePreviewMode) {
        omittedPrerenderRoutes.forEach(route => {
            prerenderRoute(route, { isOmitted: true });
        });
    }
    prerenderRoutes.forEach(route => {
        if (routesManifest?.i18n) {
            route = (0, utils_1.normalizeLocalePath)(route, routesManifest.i18n.locales).pathname;
        }
        delete lambdas[path_1.default.posix.join('.', entryDirectory, route === '/' ? 'index' : route)];
    });
    const middleware = await (0, utils_1.getMiddlewareBundle)({
        entryPath,
        outputDirectory,
        routesManifest,
        isCorrectMiddlewareOrder,
        prerenderBypassToken: prerenderManifest.bypassToken || '',
    });
    const isNextDataServerResolving = middleware.staticRoutes.length > 0 &&
        semver_1.default.gte(nextVersion, NEXT_DATA_MIDDLEWARE_RESOLVING_VERSION);
    const dynamicRoutes = await (0, utils_1.getDynamicRoutes)(entryPath, entryDirectory, dynamicPages, false, routesManifest, omittedPrerenderRoutes, canUsePreviewMode, prerenderManifest.bypassToken || '', true, middleware.dynamicRouteMap).then(arr => (0, utils_1.localizeDynamicRoutes)(arr, dynamicPrefix, entryDirectory, staticPages, prerenderManifest, routesManifest, true, isCorrectLocaleAPIRoutes));
    const { staticFiles, publicDirectoryFiles, staticDirectoryFiles } = await (0, utils_1.getStaticFiles)(entryPath, entryDirectory, outputDirectory);
    const normalizeNextDataRoute = (isOverride = false) => {
        return isNextDataServerResolving
            ? [
                // strip _next/data prefix for resolving
                {
                    src: `^${path_1.default.posix.join('/', entryDirectory, '/_next/data/', escapedBuildId, '/(.*).json')}`,
                    dest: `${path_1.default.posix.join('/', entryDirectory, '/$1', trailingSlash ? '/' : '')}`,
                    ...(isOverride ? { override: true } : {}),
                    continue: true,
                    has: [
                        {
                            type: 'header',
                            key: 'x-nextjs-data',
                        },
                    ],
                },
                // normalize "/index" from "/_next/data/index.json" to -> just "/"
                // as matches a rewrite sources will expect just "/"
                {
                    src: path_1.default.posix.join('^/', entryDirectory, '/index(?:/)?'),
                    has: [
                        {
                            type: 'header',
                            key: 'x-nextjs-data',
                        },
                    ],
                    dest: path_1.default.posix.join('/', entryDirectory, trailingSlash ? '/' : ''),
                    ...(isOverride ? { override: true } : {}),
                    continue: true,
                },
            ]
            : [];
    };
    const denormalizeNextDataRoute = (isOverride = false) => {
        return isNextDataServerResolving
            ? [
                {
                    src: path_1.default.posix.join('^/', entryDirectory, trailingSlash ? '/' : '', '$'),
                    has: [
                        {
                            type: 'header',
                            key: 'x-nextjs-data',
                        },
                    ],
                    dest: `${path_1.default.posix.join('/', entryDirectory, '/_next/data/', buildId, '/index.json')}`,
                    continue: true,
                    ...(isOverride ? { override: true } : {}),
                },
                {
                    src: path_1.default.posix.join('^/', entryDirectory, '((?!_next/)(?:.*[^/]|.*))/?$'),
                    has: [
                        {
                            type: 'header',
                            key: 'x-nextjs-data',
                        },
                    ],
                    dest: `${path_1.default.posix.join('/', entryDirectory, '/_next/data/', buildId, '/$1.json')}`,
                    continue: true,
                    ...(isOverride ? { override: true } : {}),
                },
            ]
            : [];
    };
    let nextDataCatchallOutput = undefined;
    if (isNextDataServerResolving) {
        const catchallFsPath = path_1.default.join(entryPath, outputDirectory, '__next_data_catchall.json');
        await fs_extra_1.default.writeFile(catchallFsPath, '{}');
        nextDataCatchallOutput = new build_utils_1.FileFsRef({
            contentType: 'application/json',
            fsPath: catchallFsPath,
        });
    }
    if (appPathRoutesManifest) {
        // create .rsc variant for app lambdas and edge functions
        // to match prerenders so we can route the same when the
        // __rsc__ header is present
        const edgeFunctions = middleware.edgeFunctions;
        for (let route of Object.values(appPathRoutesManifest)) {
            route = path_1.default.posix.join('./', route === '/' ? '/index' : route);
            if (lambdas[route]) {
                lambdas[`${route}.rsc`] = lambdas[route];
            }
            if (edgeFunctions[route]) {
                edgeFunctions[`${route}.rsc`] = edgeFunctions[route];
            }
        }
    }
    const rscHeader = routesManifest.rsc?.header?.toLowerCase() || '__rsc__';
    const completeDynamicRoutes = [];
    if (appDir) {
        for (const route of dynamicRoutes) {
            completeDynamicRoutes.push(route);
            completeDynamicRoutes.push({
                ...route,
                src: route.src.replace(new RegExp((0, escape_string_regexp_1.default)('(?:/)?$')), '(?:\\.rsc)?(?:/)?$'),
                dest: route.dest?.replace(/($|\?)/, '.rsc$1'),
            });
        }
    }
    else {
        completeDynamicRoutes.push(...dynamicRoutes);
    }
    return {
        wildcard: wildcardConfig,
        images: (0, utils_1.getImagesConfig)(imagesManifest),
        output: {
            ...publicDirectoryFiles,
            ...lambdas,
            // Prerenders may override Lambdas -- this is an intentional behavior.
            ...prerenders,
            ...staticPages,
            ...staticFiles,
            ...staticDirectoryFiles,
            ...privateOutputs.files,
            ...middleware.edgeFunctions,
            ...(isNextDataServerResolving
                ? {
                    __next_data_catchall: nextDataCatchallOutput,
                }
                : {}),
        },
        routes: [
            /*
              Desired routes order
              - Runtime headers
              - User headers and redirects
              - Runtime redirects
              - Runtime routes
              - Check filesystem, if nothing found continue
              - User rewrites
              - Builder rewrites
            */
            // force trailingSlashRedirect to the very top so it doesn't
            // conflict with i18n routes that don't have or don't have the
            // trailing slash
            ...trailingSlashRedirects,
            ...privateOutputs.routes,
            // normalize _next/data URL before processing redirects
            ...normalizeNextDataRoute(true),
            ...(i18n
                ? [
                    // Handle auto-adding current default locale to path based on
                    // $wildcard
                    {
                        src: `^${path_1.default.posix.join('/', entryDirectory, '/')}(?!(?:_next/.*|${i18n.locales
                            .map(locale => (0, escape_string_regexp_1.default)(locale))
                            .join('|')})(?:/.*|$))(.*)$`,
                        // we aren't able to ensure trailing slash mode here
                        // so ensure this comes after the trailing slash redirect
                        dest: `${entryDirectory !== '.'
                            ? path_1.default.posix.join('/', entryDirectory)
                            : ''}$wildcard/$1`,
                        continue: true,
                    },
                    // Handle redirecting to locale specific domains
                    ...(i18n.domains &&
                        i18n.domains.length > 0 &&
                        i18n.localeDetection !== false
                        ? [
                            {
                                src: `^${path_1.default.posix.join('/', entryDirectory)}/?(?:${i18n.locales
                                    .map(locale => (0, escape_string_regexp_1.default)(locale))
                                    .join('|')})?/?$`,
                                locale: {
                                    redirect: i18n.domains.reduce((prev, item) => {
                                        prev[item.defaultLocale] = `http${item.http ? '' : 's'}://${item.domain}/`;
                                        if (item.locales) {
                                            item.locales.map(locale => {
                                                prev[locale] = `http${item.http ? '' : 's'}://${item.domain}/${locale}`;
                                            });
                                        }
                                        return prev;
                                    }, {}),
                                    cookie: 'NEXT_LOCALE',
                                },
                                continue: true,
                            },
                        ]
                        : []),
                    // Handle redirecting to locale paths
                    ...(i18n.localeDetection !== false
                        ? [
                            {
                                // TODO: if default locale is included in this src it won't
                                // be visitable by users who prefer another language since a
                                // cookie isn't set signaling the default locale is
                                // preferred on redirect currently, investigate adding this
                                src: '/',
                                locale: {
                                    redirect: i18n.locales.reduce((prev, locale) => {
                                        prev[locale] =
                                            locale === i18n.defaultLocale ? `/` : `/${locale}`;
                                        return prev;
                                    }, {}),
                                    cookie: 'NEXT_LOCALE',
                                },
                                continue: true,
                            },
                        ]
                        : []),
                    {
                        src: `^${path_1.default.posix.join('/', entryDirectory)}$`,
                        dest: `${path_1.default.posix.join('/', entryDirectory, i18n.defaultLocale)}`,
                        continue: true,
                    },
                    // Auto-prefix non-locale path with default locale
                    // note for prerendered pages this will cause
                    // x-now-route-matches to contain the path minus the locale
                    // e.g. for /de/posts/[slug] x-now-route-matches would have
                    // 1=posts%2Fpost-1
                    {
                        src: `^${path_1.default.posix.join('/', entryDirectory, '/')}(?!(?:_next/.*|${i18n.locales
                            .map(locale => (0, escape_string_regexp_1.default)(locale))
                            .join('|')})(?:/.*|$))(.*)$`,
                        dest: `${path_1.default.posix.join('/', entryDirectory, i18n.defaultLocale)}/$1`,
                        continue: true,
                    },
                ]
                : []),
            ...headers,
            ...redirects,
            // middleware comes directly after redirects but before
            // beforeFiles rewrites as middleware is not a "file" route
            ...(routesManifest?.skipMiddlewareUrlNormalize
                ? denormalizeNextDataRoute(true)
                : []),
            ...(isCorrectMiddlewareOrder ? middleware.staticRoutes : []),
            ...(routesManifest?.skipMiddlewareUrlNormalize
                ? normalizeNextDataRoute(true)
                : []),
            ...beforeFilesRewrites,
            // Make sure to 404 for the /404 path itself
            ...(i18n
                ? [
                    {
                        src: `${path_1.default.posix.join('/', entryDirectory, '/')}(?:${i18n.locales
                            .map(locale => (0, escape_string_regexp_1.default)(locale))
                            .join('|')})?[/]?404/?`,
                        status: 404,
                        continue: true,
                        missing: [
                            {
                                type: 'header',
                                key: 'x-prerender-revalidate',
                            },
                        ],
                    },
                ]
                : [
                    {
                        src: path_1.default.posix.join('/', entryDirectory, '404/?'),
                        status: 404,
                        continue: true,
                        missing: [
                            {
                                type: 'header',
                                key: 'x-prerender-revalidate',
                            },
                        ],
                    },
                ]),
            // Make sure to 500 when visiting /500 directly for static 500
            ...(!hasStatic500
                ? []
                : i18n
                    ? [
                        {
                            src: `${path_1.default.posix.join('/', entryDirectory, '/')}(?:${i18n.locales
                                .map(locale => (0, escape_string_regexp_1.default)(locale))
                                .join('|')})?[/]?500`,
                            status: 500,
                            continue: true,
                        },
                    ]
                    : [
                        {
                            src: path_1.default.posix.join('/', entryDirectory, '500'),
                            status: 500,
                            continue: true,
                        },
                    ]),
            // we need to undo _next/data normalize before checking filesystem
            ...denormalizeNextDataRoute(true),
            // while middleware was in beta the order came right before
            // handle: 'filesystem' we maintain this for older versions
            // to prevent a local/deploy mismatch
            ...(!isCorrectMiddlewareOrder ? middleware.staticRoutes : []),
            ...(appDir
                ? [
                    {
                        src: `^${path_1.default.posix.join('/', entryDirectory, '/')}`,
                        has: [
                            {
                                type: 'header',
                                key: rscHeader,
                            },
                        ],
                        dest: path_1.default.posix.join('/', entryDirectory, '/index.rsc'),
                        continue: true,
                    },
                    {
                        src: `^${path_1.default.posix.join('/', entryDirectory, '/((?!.+\\.rsc).+)$')}`,
                        has: [
                            {
                                type: 'header',
                                key: rscHeader,
                            },
                        ],
                        dest: path_1.default.posix.join('/', entryDirectory, '/$1.rsc'),
                        continue: true,
                    },
                ]
                : []),
            // Next.js page lambdas, `static/` folder, reserved assets, and `public/`
            // folder
            { handle: 'filesystem' },
            // ensure the basePath prefixed _next/image is rewritten to the root
            // _next/image path
            ...(routesManifest?.basePath
                ? [
                    {
                        src: path_1.default.posix.join('/', entryDirectory, '_next/image/?'),
                        dest: '/_next/image',
                        check: true,
                    },
                ]
                : []),
            // normalize _next/data URL before processing rewrites
            ...normalizeNextDataRoute(),
            ...(!isNextDataServerResolving
                ? [
                    // No-op _next/data rewrite to trigger handle: 'rewrites' and then 404
                    // if no match to prevent rewriting _next/data unexpectedly
                    {
                        src: path_1.default.posix.join('/', entryDirectory, '_next/data/(.*)'),
                        dest: path_1.default.posix.join('/', entryDirectory, '_next/data/$1'),
                        check: true,
                    },
                ]
                : []),
            // These need to come before handle: miss or else they are grouped
            // with that routing section
            ...afterFilesRewrites,
            // make sure 404 page is used when a directory is matched without
            // an index page
            { handle: 'resource' },
            ...fallbackRewrites,
            { src: path_1.default.posix.join('/', entryDirectory, '.*'), status: 404 },
            // We need to make sure to 404 for /_next after handle: miss since
            // handle: miss is called before rewrites and to prevent rewriting /_next
            { handle: 'miss' },
            {
                src: path_1.default.posix.join('/', entryDirectory, '_next/static/(?:[^/]+/pages|pages|chunks|runtime|css|image|media)/.+'),
                status: 404,
                check: true,
                dest: '$0',
            },
            // remove locale prefixes to check public files and
            // to allow checking non-prefixed lambda outputs
            ...(i18n
                ? [
                    {
                        src: `^${path_1.default.posix.join('/', entryDirectory)}/?(?:${i18n.locales
                            .map(locale => (0, escape_string_regexp_1.default)(locale))
                            .join('|')})/(.*)`,
                        dest: `${path_1.default.posix.join('/', entryDirectory, '/')}$1`,
                        check: true,
                    },
                ]
                : []),
            // routes that are called after each rewrite or after routes
            // if there no rewrites
            { handle: 'rewrite' },
            // re-build /_next/data URL after resolving
            ...denormalizeNextDataRoute(),
            ...(isNextDataServerResolving
                ? dataRoutes.filter(route => {
                    // filter to only static data routes as dynamic routes will be handled
                    // below
                    const { pathname } = new URL(route.dest || '/', 'http://n');
                    return !(0, utils_1.isDynamicRoute)(pathname.replace(/\.json$/, ''));
                })
                : []),
            // /_next/data routes for getServerProps/getStaticProps pages
            ...(isNextDataServerResolving
                ? // when resolving data routes for middleware we need to include
                    // all dynamic routes including non-SSG/SSP so that the priority
                    // is correct
                    completeDynamicRoutes
                        .map(route => {
                        route = Object.assign({}, route);
                        let normalizedSrc = route.src;
                        if (routesManifest.basePath) {
                            normalizedSrc = normalizedSrc.replace(new RegExp(`\\^${(0, escape_string_regexp_1.default)(routesManifest.basePath)}`), '^');
                        }
                        route.src = path_1.default.posix.join('^/', entryDirectory, '_next/data/', escapedBuildId, normalizedSrc
                            .replace(/\^\(\?:\/\(\?</, '(?:(?<')
                            .replace(/(^\^|\$$)/g, '') + '.json$');
                        const parsedDestination = new URL(route.dest || '/', 'http://n');
                        let pathname = parsedDestination.pathname;
                        const search = parsedDestination.search;
                        let isPrerender = !!prerenders[path_1.default.join('./', pathname)];
                        if (routesManifest.i18n) {
                            for (const locale of routesManifest.i18n?.locales || []) {
                                const prerenderPathname = pathname.replace(/^\/\$nextLocale/, `/${locale}`);
                                if (prerenders[path_1.default.join('./', prerenderPathname)]) {
                                    isPrerender = true;
                                    break;
                                }
                            }
                        }
                        if (isPrerender) {
                            if (routesManifest.basePath) {
                                pathname = pathname.replace(new RegExp(`^${(0, escape_string_regexp_1.default)(routesManifest.basePath)}`), '');
                            }
                            route.dest = `${routesManifest.basePath || ''}/_next/data/${buildId}${pathname}.json${search || ''}`;
                        }
                        return route;
                    })
                        .filter(Boolean)
                : dataRoutes),
            ...(!isNextDataServerResolving
                ? [
                    // ensure we 404 for non-existent _next/data routes before
                    // trying page dynamic routes
                    {
                        src: path_1.default.posix.join('/', entryDirectory, '_next/data/(.*)'),
                        dest: path_1.default.posix.join('/', entryDirectory, '404'),
                        status: 404,
                    },
                ]
                : []),
            // Dynamic routes (must come after dataRoutes as dataRoutes are more
            // specific)
            ...completeDynamicRoutes,
            ...(isNextDataServerResolving
                ? [
                    {
                        src: `^${path_1.default.posix.join('/', entryDirectory, '/_next/data/', escapedBuildId, '/(.*).json')}`,
                        headers: {
                            'x-nextjs-matched-path': '/$1',
                        },
                        continue: true,
                        override: true,
                    },
                    // add a catch-all data route so we don't 404 when getting
                    // middleware effects
                    {
                        src: `^${path_1.default.posix.join('/', entryDirectory, '/_next/data/', escapedBuildId, '/(.*).json')}`,
                        dest: '__next_data_catchall',
                    },
                ]
                : []),
            // routes to call after a file has been matched
            { handle: 'hit' },
            // Before we handle static files we need to set proper caching headers
            {
                // This ensures we only match known emitted-by-Next.js files and not
                // user-emitted files which may be missing a hash in their filename.
                src: path_1.default.posix.join('/', entryDirectory, `_next/static/(?:[^/]+/pages|pages|chunks|runtime|css|image|media|${escapedBuildId})/.+`),
                // Next.js assets contain a hash or entropy in their filenames, so they
                // are guaranteed to be unique and cacheable indefinitely.
                headers: {
                    'cache-control': `public,max-age=${_1.MAX_AGE_ONE_YEAR},immutable`,
                },
                continue: true,
                important: true,
            },
            // TODO: remove below workaround when `/` is allowed to be output
            // different than `/index`
            {
                src: path_1.default.posix.join('/', entryDirectory, '/index'),
                headers: {
                    'x-matched-path': '/',
                },
                continue: true,
                important: true,
            },
            {
                src: path_1.default.posix.join('/', entryDirectory, `/((?!index$).*)`),
                headers: {
                    'x-matched-path': '/$1',
                },
                continue: true,
                important: true,
            },
            // error handling
            { handle: 'error' },
            // Custom Next.js 404 page
            ...(i18n && (static404Page || hasIsr404Page || lambdaPages['404.js'])
                ? [
                    {
                        src: `${path_1.default.posix.join('/', entryDirectory, '/')}(?<nextLocale>${i18n.locales
                            .map(locale => (0, escape_string_regexp_1.default)(locale))
                            .join('|')})(/.*|$)`,
                        dest: path_1.default.posix.join('/', entryDirectory, '/$nextLocale/404'),
                        status: 404,
                        caseSensitive: true,
                    },
                    {
                        src: path_1.default.posix.join('/', entryDirectory, '.*'),
                        dest: path_1.default.posix.join('/', entryDirectory, `/${i18n.defaultLocale}/404`),
                        status: 404,
                    },
                ]
                : [
                    {
                        src: path_1.default.posix.join('/', entryDirectory, '.*'),
                        dest: path_1.default.posix.join('/', entryDirectory, static404Page ||
                            hasIsr404Page ||
                            lambdas[path_1.default.posix.join(entryDirectory, '404')]
                            ? '/404'
                            : '/_error'),
                        status: 404,
                    },
                ]),
            // custom 500 page if present
            ...(i18n && (hasStatic500 || hasIsr500Page || lambdaPages['500.js'])
                ? [
                    {
                        src: `${path_1.default.posix.join('/', entryDirectory, '/')}(?<nextLocale>${i18n.locales
                            .map(locale => (0, escape_string_regexp_1.default)(locale))
                            .join('|')})(/.*|$)`,
                        dest: path_1.default.posix.join('/', entryDirectory, '/$nextLocale/500'),
                        status: 500,
                        caseSensitive: true,
                    },
                    {
                        src: path_1.default.posix.join('/', entryDirectory, '.*'),
                        dest: path_1.default.posix.join('/', entryDirectory, `/${i18n.defaultLocale}/500`),
                        status: 500,
                    },
                ]
                : [
                    {
                        src: path_1.default.posix.join('/', entryDirectory, '.*'),
                        dest: path_1.default.posix.join('/', entryDirectory, hasStatic500 ||
                            hasIsr500Page ||
                            lambdas[path_1.default.posix.join(entryDirectory, '500')]
                            ? '/500'
                            : '/_error'),
                        status: 500,
                    },
                ]),
        ],
    };
}
exports.serverBuild = serverBuild;
