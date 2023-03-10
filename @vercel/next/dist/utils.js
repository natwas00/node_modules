"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upgradeMiddlewareManifest = exports.getMiddlewareManifest = exports.getMiddlewareBundle = exports.getSourceFilePathFromPage = exports.isDynamicRoute = exports.normalizePage = exports.getImagesConfig = exports.getNextConfig = exports.normalizePackageJson = exports.validateEntrypoint = exports.excludeFiles = exports.getPrivateOutputs = exports.updateRouteSrc = exports.getNextServerPath = exports.normalizeIndexOutput = exports.getStaticFiles = exports.onPrerenderRoute = exports.onPrerenderRouteInitial = exports.detectLambdaLimitExceeding = exports.outputFunctionFileSizeInfo = exports.getPageLambdaGroups = exports.MAX_UNCOMPRESSED_LAMBDA_SIZE = exports.addLocaleOrDefault = exports.normalizeLocalePath = exports.getPrerenderManifest = exports.getRequiredServerFilesManifest = exports.getExportStatus = exports.getExportIntent = exports.createLambdaFromPseudoLayers = exports.createPseudoLayer = exports.ExperimentalTraceVersion = exports.collectTracedFiles = exports.getFilesMapFromReasons = exports.filterStaticPages = exports.getImagesManifest = exports.localizeDynamicRoutes = exports.getDynamicRoutes = exports.getRoutesManifest = exports.prettyBytes = exports.MIB = exports.KIB = void 0;
const build_utils_1 = require("@vercel/build-utils");
const async_sema_1 = require("async-sema");
const buffer_crc32_1 = __importDefault(require("buffer-crc32"));
const fs_extra_1 = __importStar(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const resolve_from_1 = __importDefault(require("resolve-from"));
const semver_1 = __importDefault(require("semver"));
const zlib_1 = __importDefault(require("zlib"));
const url_1 = __importDefault(require("url"));
const escape_string_regexp_1 = __importDefault(require("escape-string-regexp"));
const _1 = require(".");
const text_table_1 = __importDefault(require("text-table"));
const get_edge_function_source_1 = require("./edge-function-source/get-edge-function-source");
const sourcemapped_1 = require("./sourcemapped");
const bytes_1 = __importDefault(require("bytes"));
exports.KIB = 1024;
exports.MIB = 1024 * exports.KIB;
const prettyBytes = (n) => (0, bytes_1.default)(n, { unitSeparator: ' ' });
exports.prettyBytes = prettyBytes;
// Identify /[param]/ in route string
// eslint-disable-next-line no-useless-escape
const TEST_DYNAMIC_ROUTE = /\/\[[^\/]+?\](?=\/|$)/;
function isDynamicRoute(route) {
    route = route.startsWith('/') ? route : `/${route}`;
    return TEST_DYNAMIC_ROUTE.test(route);
}
exports.isDynamicRoute = isDynamicRoute;
/**
 * Validate if the entrypoint is allowed to be used
 */
function validateEntrypoint(entrypoint) {
    if (!/package\.json$/.exec(entrypoint) &&
        !/next\.config\.js$/.exec(entrypoint)) {
        throw new build_utils_1.NowBuildError({
            message: 'Specified "src" for "@vercel/next" has to be "package.json" or "next.config.js"',
            code: 'NEXT_INCORRECT_SRC',
        });
    }
}
exports.validateEntrypoint = validateEntrypoint;
/**
 * Exclude certain files from the files object
 */
function excludeFiles(files, matcher) {
    return Object.keys(files).reduce((newFiles, filePath) => {
        if (matcher(filePath)) {
            return newFiles;
        }
        return {
            ...newFiles,
            [filePath]: files[filePath],
        };
    }, {});
}
exports.excludeFiles = excludeFiles;
/**
 * Enforce specific package.json configuration for smallest possible lambda
 */
function normalizePackageJson(defaultPackageJson = {}) {
    const dependencies = {};
    const devDependencies = {
        ...defaultPackageJson.dependencies,
        ...defaultPackageJson.devDependencies,
    };
    if (devDependencies.react) {
        dependencies.react = devDependencies.react;
        delete devDependencies.react;
    }
    if (devDependencies['react-dom']) {
        dependencies['react-dom'] = devDependencies['react-dom'];
        delete devDependencies['react-dom'];
    }
    delete devDependencies['next-server'];
    return {
        ...defaultPackageJson,
        dependencies: {
            // react and react-dom can be overwritten
            react: 'latest',
            'react-dom': 'latest',
            ...dependencies,
            // next-server is forced to canary
            'next-server': 'v7.0.2-canary.49',
        },
        devDependencies: {
            ...devDependencies,
            // next is forced to canary
            next: 'v7.0.2-canary.49',
        },
        scripts: {
            ...defaultPackageJson.scripts,
            'now-build': 'NODE_OPTIONS=--max_old_space_size=3000 next build --lambdas',
        },
    };
}
exports.normalizePackageJson = normalizePackageJson;
async function getNextConfig(workPath, entryPath) {
    const entryConfig = path_1.default.join(entryPath, './next.config.js');
    if (await fs_extra_1.default.pathExists(entryConfig)) {
        return fs_extra_1.default.readFile(entryConfig, 'utf8');
    }
    const workConfig = path_1.default.join(workPath, './next.config.js');
    if (await fs_extra_1.default.pathExists(workConfig)) {
        return fs_extra_1.default.readFile(workConfig, 'utf8');
    }
    return null;
}
exports.getNextConfig = getNextConfig;
function getImagesConfig(imagesManifest) {
    return imagesManifest?.images?.loader === 'default' &&
        imagesManifest.images?.unoptimized !== true
        ? {
            domains: imagesManifest.images.domains,
            sizes: imagesManifest.images.sizes,
            remotePatterns: imagesManifest.images.remotePatterns,
            minimumCacheTTL: imagesManifest.images.minimumCacheTTL,
            formats: imagesManifest.images.formats,
            dangerouslyAllowSVG: imagesManifest.images.dangerouslyAllowSVG,
            contentSecurityPolicy: imagesManifest.images.contentSecurityPolicy,
        }
        : undefined;
}
exports.getImagesConfig = getImagesConfig;
function normalizePage(page) {
    // Resolve on anything that doesn't start with `/`
    if (!page.startsWith('/')) {
        page = `/${page}`;
    }
    // remove '/index' from the end
    page = page.replace(/\/index$/, '/');
    return page;
}
exports.normalizePage = normalizePage;
async function getRoutesManifest(entryPath, outputDirectory, nextVersion) {
    const shouldHaveManifest = nextVersion && semver_1.default.gte(nextVersion, '9.1.4-canary.0');
    if (!shouldHaveManifest)
        return;
    const pathRoutesManifest = path_1.default.join(entryPath, outputDirectory, 'routes-manifest.json');
    const hasRoutesManifest = await fs_extra_1.default
        .access(pathRoutesManifest)
        .then(() => true)
        .catch(() => false);
    if (shouldHaveManifest && !hasRoutesManifest) {
        throw new build_utils_1.NowBuildError({
            message: `The file "${pathRoutesManifest}" couldn't be found. This is normally caused by a misconfiguration in your project.\n` +
                'Please check the following, and reach out to support if you cannot resolve the problem:\n' +
                '  1. If present, be sure your `build` script in "package.json" calls `next build`.' +
                '  2. Navigate to your project\'s settings in the Vercel dashboard, and verify that the "Build Command" is not overridden, or that it calls `next build`.' +
                '  3. Navigate to your project\'s settings in the Vercel dashboard, and verify that the "Output Directory" is not overridden. Note that `next export` does **not** require you change this setting, even if you customize the `next export` output directory.',
            link: 'https://err.sh/vercel/vercel/now-next-routes-manifest',
            code: 'NEXT_NO_ROUTES_MANIFEST',
        });
    }
    const routesManifest = await fs_extra_1.default.readJSON(pathRoutesManifest);
    // remove temporary array based routeKeys from v1/v2 of routes
    // manifest since it can result in invalid routes
    for (const route of routesManifest.dataRoutes || []) {
        if (Array.isArray(route.routeKeys)) {
            delete route.routeKeys;
            delete route.namedDataRouteRegex;
        }
    }
    for (const route of routesManifest.dynamicRoutes || []) {
        if ('routeKeys' in route && Array.isArray(route.routeKeys)) {
            delete route.routeKeys;
            delete route.namedRegex;
        }
    }
    return routesManifest;
}
exports.getRoutesManifest = getRoutesManifest;
async function getDynamicRoutes(entryPath, entryDirectory, dynamicPages, isDev, routesManifest, omittedRoutes, canUsePreviewMode, bypassToken, isServerMode, dynamicMiddlewareRouteMap) {
    if (routesManifest) {
        switch (routesManifest.version) {
            case 1:
            case 2: {
                return routesManifest.dynamicRoutes
                    .filter(({ page }) => canUsePreviewMode || !omittedRoutes?.has(page))
                    .map(({ page, regex }) => {
                    return {
                        src: regex,
                        dest: !isDev ? path_1.default.posix.join('/', entryDirectory, page) : page,
                        check: true,
                        status: canUsePreviewMode && omittedRoutes?.has(page) ? 404 : undefined,
                    };
                });
            }
            case 3:
            case 4: {
                return routesManifest.dynamicRoutes
                    .filter(({ page }) => canUsePreviewMode || !omittedRoutes?.has(page))
                    .map(params => {
                    if ('isMiddleware' in params) {
                        const route = dynamicMiddlewareRouteMap?.get(params.page);
                        if (!route) {
                            throw new Error(`Could not find dynamic middleware route for ${params.page}`);
                        }
                        return route;
                    }
                    const { page, namedRegex, regex, routeKeys } = params;
                    const route = {
                        src: namedRegex || regex,
                        dest: `${!isDev ? path_1.default.posix.join('/', entryDirectory, page) : page}${routeKeys
                            ? `?${Object.keys(routeKeys)
                                .map(key => `${routeKeys[key]}=$${key}`)
                                .join('&')}`
                            : ''}`,
                    };
                    if (!isServerMode) {
                        route.check = true;
                    }
                    if (isServerMode && canUsePreviewMode && omittedRoutes?.has(page)) {
                        // only match this route when in preview mode so
                        // preview works for non-prerender fallback: false pages
                        route.has = [
                            {
                                type: 'cookie',
                                key: '__prerender_bypass',
                                value: bypassToken || undefined,
                            },
                            {
                                type: 'cookie',
                                key: '__next_preview_data',
                            },
                        ];
                    }
                    return route;
                });
            }
            default: {
                // update MIN_ROUTES_MANIFEST_VERSION
                throw new build_utils_1.NowBuildError({
                    message: 'This version of `@vercel/next` does not support the version of Next.js you are trying to deploy.\n' +
                        'Please upgrade your `@vercel/next` builder and try again. Contact support if this continues to happen.',
                    code: 'NEXT_VERSION_UPGRADE',
                });
            }
        }
    }
    // FALLBACK:
    // When `routes-manifest.json` does not exist (old Next.js versions), we'll try to
    // require the methods we need from Next.js' internals.
    if (!dynamicPages.length) {
        return [];
    }
    let getRouteRegex = undefined;
    let getSortedRoutes;
    try {
        // NOTE: `eval('require')` is necessary to avoid bad transpilation to `__webpack_require__`
        ({ getRouteRegex, getSortedRoutes } = eval('require')((0, resolve_from_1.default)(entryPath, 'next-server/dist/lib/router/utils')));
        if (typeof getRouteRegex !== 'function') {
            getRouteRegex = undefined;
        }
    }
    catch (_) { } // eslint-disable-line no-empty
    if (!getRouteRegex || !getSortedRoutes) {
        try {
            // NOTE: `eval('require')` is necessary to avoid bad transpilation to `__webpack_require__`
            ({ getRouteRegex, getSortedRoutes } = eval('require')((0, resolve_from_1.default)(entryPath, 'next/dist/next-server/lib/router/utils')));
            if (typeof getRouteRegex !== 'function') {
                getRouteRegex = undefined;
            }
        }
        catch (_) { } // eslint-disable-line no-empty
    }
    if (!getRouteRegex || !getSortedRoutes) {
        throw new build_utils_1.NowBuildError({
            message: 'Found usage of dynamic routes but not on a new enough version of Next.js.',
            code: 'NEXT_DYNAMIC_ROUTES_OUTDATED',
        });
    }
    const pageMatchers = getSortedRoutes(dynamicPages).map(pageName => ({
        pageName,
        matcher: getRouteRegex && getRouteRegex(pageName).re,
    }));
    const routes = [];
    pageMatchers.forEach(pageMatcher => {
        // in `vercel dev` we don't need to prefix the destination
        const dest = !isDev
            ? path_1.default.posix.join('/', entryDirectory, pageMatcher.pageName)
            : pageMatcher.pageName;
        if (pageMatcher && pageMatcher.matcher) {
            routes.push({
                src: pageMatcher.matcher.source,
                dest,
                check: !isDev,
            });
        }
    });
    return routes;
}
exports.getDynamicRoutes = getDynamicRoutes;
function localizeDynamicRoutes(dynamicRoutes, dynamicPrefix, entryDirectory, staticPages, prerenderManifest, routesManifest, isServerMode, isCorrectLocaleAPIRoutes) {
    return dynamicRoutes.map((route) => {
        // i18n is already handled for middleware
        if (route.middleware !== undefined || route.middlewarePath !== undefined)
            return route;
        const { i18n } = routesManifest || {};
        if (i18n) {
            const { pathname } = url_1.default.parse(route.dest);
            const pathnameNoPrefix = pathname?.replace(dynamicPrefix, '');
            const isFallback = prerenderManifest.fallbackRoutes[pathname];
            const isBlocking = prerenderManifest.blockingFallbackRoutes[pathname];
            const isApiRoute = pathnameNoPrefix === '/api' || pathnameNoPrefix?.startsWith('/api/');
            const isAutoExport = staticPages[addLocaleOrDefault(pathname, routesManifest).substring(1)];
            const isLocalePrefixed = isFallback || isBlocking || isAutoExport || isServerMode;
            route.src = route.src.replace('^', `^${dynamicPrefix ? `${dynamicPrefix}[/]?` : '[/]?'}(?${isLocalePrefixed ? '<nextLocale>' : ':'}${i18n.locales.map(locale => (0, escape_string_regexp_1.default)(locale)).join('|')})?`);
            if (isLocalePrefixed && !(isCorrectLocaleAPIRoutes && isApiRoute)) {
                // ensure destination has locale prefix to match prerender output
                // path so that the prerender object is used
                route.dest = route.dest.replace(`${path_1.default.posix.join('/', entryDirectory, '/')}`, `${path_1.default.posix.join('/', entryDirectory, '$nextLocale', '/')}`);
            }
        }
        else {
            route.src = route.src.replace('^', `^${dynamicPrefix}`);
        }
        return route;
    });
}
exports.localizeDynamicRoutes = localizeDynamicRoutes;
async function getImagesManifest(entryPath, outputDirectory) {
    const pathImagesManifest = path_1.default.join(entryPath, outputDirectory, 'images-manifest.json');
    const hasImagesManifest = await fs_extra_1.default
        .access(pathImagesManifest)
        .then(() => true)
        .catch(() => false);
    if (!hasImagesManifest) {
        return undefined;
    }
    return fs_extra_1.default.readJson(pathImagesManifest);
}
exports.getImagesManifest = getImagesManifest;
function filterStaticPages(staticPageFiles, dynamicPages, entryDirectory, htmlContentType, prerenderManifest, routesManifest) {
    const staticPages = {};
    Object.keys(staticPageFiles).forEach((page) => {
        const pathname = page.replace(/\.html$/, '');
        const routeName = normalizeLocalePath(normalizePage(pathname), routesManifest?.i18n?.locales).pathname;
        // Prerendered routes emit a `.html` file but should not be treated as a
        // static page.
        // Lazily prerendered routes have a fallback `.html` file on newer
        // Next.js versions so we need to also not treat it as a static page here.
        if (prerenderManifest.staticRoutes[routeName] ||
            prerenderManifest.fallbackRoutes[routeName] ||
            prerenderManifest.staticRoutes[normalizePage(pathname)] ||
            prerenderManifest.fallbackRoutes[normalizePage(pathname)]) {
            return;
        }
        const staticRoute = path_1.default.posix.join(entryDirectory, pathname);
        staticPages[staticRoute] = staticPageFiles[page];
        staticPages[staticRoute].contentType = htmlContentType;
        if (isDynamicRoute(pathname)) {
            dynamicPages.push(routeName);
            return;
        }
    });
    return staticPages;
}
exports.filterStaticPages = filterStaticPages;
function getFilesMapFromReasons(fileList, reasons, ignoreFn) {
    // this uses the reasons tree to collect files specific to a
    // certain parent allowing us to not have to trace each parent
    // separately
    const parentFilesMap = new Map();
    function propagateToParents(parents, file, seen = new Set()) {
        for (const parent of parents || []) {
            if (!seen.has(parent)) {
                seen.add(parent);
                let parentFiles = parentFilesMap.get(parent);
                if (!parentFiles) {
                    parentFiles = new Set();
                    parentFilesMap.set(parent, parentFiles);
                }
                if (!ignoreFn?.(file, parent)) {
                    parentFiles.add(file);
                }
                const parentReason = reasons.get(parent);
                if (parentReason?.parents) {
                    propagateToParents(parentReason.parents, file, seen);
                }
            }
        }
    }
    for (const file of fileList) {
        const reason = reasons.get(file);
        const isInitial = reason?.type.length === 1 && reason.type.includes('initial');
        if (!reason ||
            !reason.parents ||
            (isInitial && reason.parents.size === 0)) {
            continue;
        }
        propagateToParents(reason.parents, file);
    }
    return parentFilesMap;
}
exports.getFilesMapFromReasons = getFilesMapFromReasons;
const collectTracedFiles = (baseDir, lstatResults, lstatSema, reasons, files) => async (file) => {
    const reason = reasons.get(file);
    if (reason && reason.type.includes('initial')) {
        // Initial files are manually added to the lambda later
        return;
    }
    const filePath = path_1.default.join(baseDir, file);
    if (!lstatResults[filePath]) {
        lstatResults[filePath] = lstatSema
            .acquire()
            .then(() => (0, fs_extra_1.lstat)(filePath))
            .finally(() => lstatSema.release());
    }
    const { mode } = await lstatResults[filePath];
    files[file] = new build_utils_1.FileFsRef({
        fsPath: path_1.default.join(baseDir, file),
        mode,
    });
};
exports.collectTracedFiles = collectTracedFiles;
exports.ExperimentalTraceVersion = `9.0.4-canary.1`;
const compressBuffer = (buf) => {
    return new Promise((resolve, reject) => {
        zlib_1.default.deflateRaw(buf, { level: zlib_1.default.constants.Z_BEST_COMPRESSION }, (err, compBuf) => {
            if (err)
                return reject(err);
            resolve(compBuf);
        });
    });
};
async function createPseudoLayer(files) {
    const pseudoLayer = {};
    let pseudoLayerBytes = 0;
    for (const fileName of Object.keys(files)) {
        const file = files[fileName];
        if ((0, build_utils_1.isSymbolicLink)(file.mode)) {
            const symlinkTarget = await fs_extra_1.default.readlink(file.fsPath);
            pseudoLayer[fileName] = {
                file,
                isSymlink: true,
                symlinkTarget,
            };
        }
        else {
            const origBuffer = await (0, build_utils_1.streamToBuffer)(file.toStream());
            const compBuffer = await compressBuffer(origBuffer);
            pseudoLayerBytes += compBuffer.byteLength;
            pseudoLayer[fileName] = {
                file,
                compBuffer,
                isSymlink: false,
                crc32: buffer_crc32_1.default.unsigned(origBuffer),
                uncompressedSize: origBuffer.byteLength,
            };
        }
    }
    return { pseudoLayer, pseudoLayerBytes };
}
exports.createPseudoLayer = createPseudoLayer;
// measured with 1, 2, 5, 10, and `os.cpus().length || 5`
// and sema(1) produced the best results
const createLambdaSema = new async_sema_1.Sema(1);
async function createLambdaFromPseudoLayers({ files: baseFiles, layers, isStreaming, ...lambdaOptions }) {
    await createLambdaSema.acquire();
    const files = {};
    const addedFiles = new Set();
    // Add files from pseudo layers
    for (const layer of layers) {
        for (const seedKey of Object.keys(layer)) {
            if (addedFiles.has(seedKey)) {
                // File was already added in a previous pseudo layer
                continue;
            }
            const item = layer[seedKey];
            files[seedKey] = item.file;
            addedFiles.add(seedKey);
        }
    }
    for (const fileName of Object.keys(baseFiles)) {
        if (addedFiles.has(fileName)) {
            // File was already added in a previous pseudo layer
            continue;
        }
        const file = baseFiles[fileName];
        files[fileName] = file;
        addedFiles.add(fileName);
    }
    createLambdaSema.release();
    return new build_utils_1.NodejsLambda({
        ...lambdaOptions,
        ...(isStreaming
            ? {
                experimentalResponseStreaming: true,
            }
            : {}),
        files,
        shouldAddHelpers: false,
        shouldAddSourcemapSupport: false,
        supportsMultiPayloads: !!process.env.NEXT_PRIVATE_MULTI_PAYLOAD,
    });
}
exports.createLambdaFromPseudoLayers = createLambdaFromPseudoLayers;
async function getExportIntent(entryPath) {
    const pathExportMarker = path_1.default.join(entryPath, '.next', 'export-marker.json');
    const hasExportMarker = await fs_extra_1.default
        .access(pathExportMarker, fs_extra_1.default.constants.F_OK)
        .then(() => true)
        .catch(() => false);
    if (!hasExportMarker) {
        return false;
    }
    const manifest = JSON.parse(await fs_extra_1.default.readFile(pathExportMarker, 'utf8'));
    switch (manifest.version) {
        case 1: {
            if (manifest.hasExportPathMap !== true) {
                return false;
            }
            return { trailingSlash: manifest.exportTrailingSlash };
        }
        default: {
            return false;
        }
    }
}
exports.getExportIntent = getExportIntent;
async function getExportStatus(entryPath) {
    const pathExportDetail = path_1.default.join(entryPath, '.next', 'export-detail.json');
    const hasExportDetail = await fs_extra_1.default
        .access(pathExportDetail, fs_extra_1.default.constants.F_OK)
        .then(() => true)
        .catch(() => false);
    if (!hasExportDetail) {
        return false;
    }
    const manifest = JSON.parse(await fs_extra_1.default.readFile(pathExportDetail, 'utf8'));
    switch (manifest.version) {
        case 1: {
            return {
                success: !!manifest.success,
                outDirectory: manifest.outDirectory,
            };
        }
        default: {
            return false;
        }
    }
}
exports.getExportStatus = getExportStatus;
async function getRequiredServerFilesManifest(entryPath, outputDirectory) {
    const pathRequiredServerFilesManifest = path_1.default.join(entryPath, outputDirectory, 'required-server-files.json');
    const hasManifest = await fs_extra_1.default
        .access(pathRequiredServerFilesManifest, fs_extra_1.default.constants.F_OK)
        .then(() => true)
        .catch(() => false);
    if (!hasManifest) {
        return false;
    }
    const manifestData = JSON.parse(await fs_extra_1.default.readFile(pathRequiredServerFilesManifest, 'utf8'));
    const requiredServerFiles = {
        files: [],
        ignore: [],
        config: {},
        appDir: manifestData.appDir,
    };
    switch (manifestData.version) {
        case 1: {
            requiredServerFiles.files = manifestData.files;
            requiredServerFiles.ignore = manifestData.ignore;
            requiredServerFiles.config = manifestData.config;
            requiredServerFiles.appDir = manifestData.appDir;
            break;
        }
        default: {
            throw new Error(`Invalid required-server-files manifest version ${manifestData.version}, please contact support if this error persists`);
        }
    }
    return requiredServerFiles;
}
exports.getRequiredServerFilesManifest = getRequiredServerFilesManifest;
async function getPrerenderManifest(entryPath, outputDirectory) {
    const pathPrerenderManifest = path_1.default.join(entryPath, outputDirectory, 'prerender-manifest.json');
    const hasManifest = await fs_extra_1.default
        .access(pathPrerenderManifest, fs_extra_1.default.constants.F_OK)
        .then(() => true)
        .catch(() => false);
    if (!hasManifest) {
        return {
            staticRoutes: {},
            blockingFallbackRoutes: {},
            fallbackRoutes: {},
            bypassToken: null,
            omittedRoutes: {},
            notFoundRoutes: [],
            isLocalePrefixed: false,
        };
    }
    const manifest = JSON.parse(await fs_extra_1.default.readFile(pathPrerenderManifest, 'utf8'));
    switch (manifest.version) {
        case 1: {
            const routes = Object.keys(manifest.routes);
            const lazyRoutes = Object.keys(manifest.dynamicRoutes);
            const ret = {
                staticRoutes: {},
                blockingFallbackRoutes: {},
                fallbackRoutes: {},
                bypassToken: (manifest.preview && manifest.preview.previewModeId) || null,
                omittedRoutes: {},
                notFoundRoutes: [],
                isLocalePrefixed: false,
            };
            routes.forEach(route => {
                const { initialRevalidateSeconds, dataRoute, srcRoute } = manifest.routes[route];
                ret.staticRoutes[route] = {
                    initialRevalidate: initialRevalidateSeconds === false
                        ? false
                        : Math.max(1, initialRevalidateSeconds),
                    dataRoute,
                    srcRoute,
                };
            });
            lazyRoutes.forEach(lazyRoute => {
                const { routeRegex, fallback, dataRoute, dataRouteRegex } = manifest.dynamicRoutes[lazyRoute];
                if (fallback) {
                    ret.fallbackRoutes[lazyRoute] = {
                        routeRegex,
                        fallback,
                        dataRoute,
                        dataRouteRegex,
                    };
                }
                else {
                    ret.blockingFallbackRoutes[lazyRoute] = {
                        routeRegex,
                        dataRoute,
                        dataRouteRegex,
                    };
                }
            });
            return ret;
        }
        case 2:
        case 3: {
            const routes = Object.keys(manifest.routes);
            const lazyRoutes = Object.keys(manifest.dynamicRoutes);
            const ret = {
                staticRoutes: {},
                blockingFallbackRoutes: {},
                fallbackRoutes: {},
                bypassToken: manifest.preview.previewModeId,
                omittedRoutes: {},
                notFoundRoutes: [],
                isLocalePrefixed: manifest.version > 2,
            };
            if (manifest.notFoundRoutes) {
                ret.notFoundRoutes.push(...manifest.notFoundRoutes);
            }
            routes.forEach(route => {
                const { initialRevalidateSeconds, dataRoute, srcRoute } = manifest.routes[route];
                ret.staticRoutes[route] = {
                    initialRevalidate: initialRevalidateSeconds === false
                        ? false
                        : Math.max(1, initialRevalidateSeconds),
                    dataRoute,
                    srcRoute,
                };
            });
            lazyRoutes.forEach(lazyRoute => {
                const { routeRegex, fallback, dataRoute, dataRouteRegex } = manifest.dynamicRoutes[lazyRoute];
                if (typeof fallback === 'string') {
                    ret.fallbackRoutes[lazyRoute] = {
                        routeRegex,
                        fallback,
                        dataRoute,
                        dataRouteRegex,
                    };
                }
                else if (fallback === null) {
                    ret.blockingFallbackRoutes[lazyRoute] = {
                        routeRegex,
                        dataRoute,
                        dataRouteRegex,
                    };
                }
                else {
                    // Fallback behavior is disabled, all routes would've been provided
                    // in the top-level `routes` key (`staticRoutes`).
                    ret.omittedRoutes[lazyRoute] = {
                        routeRegex,
                        dataRoute,
                        dataRouteRegex,
                    };
                }
            });
            return ret;
        }
        default: {
            return {
                staticRoutes: {},
                blockingFallbackRoutes: {},
                fallbackRoutes: {},
                bypassToken: null,
                omittedRoutes: {},
                notFoundRoutes: [],
                isLocalePrefixed: false,
            };
        }
    }
}
exports.getPrerenderManifest = getPrerenderManifest;
// We only need this once per build
let _usesSrcCache;
async function usesSrcDirectory(workPath) {
    if (!_usesSrcCache) {
        const source = path_1.default.join(workPath, 'src', 'pages');
        try {
            if ((await fs_extra_1.default.stat(source)).isDirectory()) {
                _usesSrcCache = true;
            }
        }
        catch (_err) {
            _usesSrcCache = false;
        }
    }
    return Boolean(_usesSrcCache);
}
async function getSourceFilePathFromPage({ workPath, page, pageExtensions, }) {
    // TODO: this should be updated to get the pageExtensions
    // value used during next build
    const extensionsToTry = pageExtensions || ['js', 'jsx', 'ts', 'tsx'];
    let fsPath = path_1.default.join(workPath, 'pages', page);
    if (await usesSrcDirectory(workPath)) {
        fsPath = path_1.default.join(workPath, 'src', 'pages', page);
    }
    if (fs_extra_1.default.existsSync(fsPath)) {
        return path_1.default.relative(workPath, fsPath);
    }
    const extensionless = fsPath.slice(0, -3); // remove ".js"
    for (const ext of extensionsToTry) {
        fsPath = `${extensionless}.${ext}`;
        if (fs_extra_1.default.existsSync(fsPath)) {
            return path_1.default.relative(workPath, fsPath);
        }
    }
    if (isDirectory(extensionless)) {
        for (const ext of extensionsToTry) {
            fsPath = path_1.default.join(extensionless, `index.${ext}`);
            if (fs_extra_1.default.existsSync(fsPath)) {
                return path_1.default.relative(workPath, fsPath);
            }
        }
    }
    console.log(`WARNING: Unable to find source file for page ${page} with extensions: ${extensionsToTry.join(', ')}, this can cause functions config from \`vercel.json\` to not be applied`);
    return '';
}
exports.getSourceFilePathFromPage = getSourceFilePathFromPage;
function isDirectory(path) {
    return fs_extra_1.default.existsSync(path) && fs_extra_1.default.lstatSync(path).isDirectory();
}
function normalizeLocalePath(pathname, locales) {
    let detectedLocale;
    // first item will be empty string from splitting at first char
    const pathnameParts = pathname.split('/');
    (locales || []).some(locale => {
        if (pathnameParts[1].toLowerCase() === locale.toLowerCase()) {
            detectedLocale = locale;
            pathnameParts.splice(1, 1);
            pathname = pathnameParts.join('/') || '/';
            return true;
        }
        return false;
    });
    return {
        pathname,
        detectedLocale,
    };
}
exports.normalizeLocalePath = normalizeLocalePath;
function addLocaleOrDefault(pathname, routesManifest, locale) {
    if (!routesManifest?.i18n)
        return pathname;
    if (!locale)
        locale = routesManifest.i18n.defaultLocale;
    return locale
        ? `/${locale}${pathname === '/index' ? '' : pathname}`
        : pathname;
}
exports.addLocaleOrDefault = addLocaleOrDefault;
exports.MAX_UNCOMPRESSED_LAMBDA_SIZE = 250 * exports.MIB;
const LAMBDA_RESERVED_UNCOMPRESSED_SIZE = 2.5 * exports.MIB;
const LAMBDA_RESERVED_COMPRESSED_SIZE = 250 * exports.KIB;
async function getPageLambdaGroups({ entryPath, config, pages, prerenderRoutes, pageTraces, compressedPages, tracedPseudoLayer, initialPseudoLayer, initialPseudoLayerUncompressed, lambdaCompressedByteLimit, internalPages, pageExtensions, }) {
    const groups = [];
    for (const page of pages) {
        const newPages = [...internalPages, page];
        const routeName = normalizePage(page.replace(/\.js$/, ''));
        const isPrerenderRoute = prerenderRoutes.has(routeName);
        let opts = {};
        if (config && config.functions) {
            const sourceFile = await getSourceFilePathFromPage({
                workPath: entryPath,
                page,
                pageExtensions,
            });
            opts = await (0, build_utils_1.getLambdaOptionsFromFunction)({
                sourceFile,
                config,
            });
        }
        let matchingGroup = groups.find(group => {
            const matches = group.maxDuration === opts.maxDuration &&
                group.memory === opts.memory &&
                group.isPrerenders === isPrerenderRoute;
            if (matches) {
                let newTracedFilesSize = group.pseudoLayerBytes;
                let newTracedFilesUncompressedSize = group.pseudoLayerUncompressedBytes;
                for (const newPage of newPages) {
                    Object.keys(pageTraces[newPage] || {}).map(file => {
                        if (!group.pseudoLayer[file]) {
                            const item = tracedPseudoLayer[file];
                            newTracedFilesSize += item.compBuffer?.byteLength || 0;
                            newTracedFilesUncompressedSize += item.uncompressedSize || 0;
                        }
                    });
                    newTracedFilesSize += compressedPages[newPage].compBuffer.byteLength;
                    newTracedFilesUncompressedSize +=
                        compressedPages[newPage].uncompressedSize;
                }
                const underUncompressedLimit = newTracedFilesUncompressedSize <
                    exports.MAX_UNCOMPRESSED_LAMBDA_SIZE - LAMBDA_RESERVED_UNCOMPRESSED_SIZE;
                const underCompressedLimit = newTracedFilesSize <
                    lambdaCompressedByteLimit - LAMBDA_RESERVED_COMPRESSED_SIZE;
                return underUncompressedLimit && underCompressedLimit;
            }
            return false;
        });
        if (matchingGroup) {
            matchingGroup.pages.push(page);
        }
        else {
            const newGroup = {
                pages: [page],
                ...opts,
                isPrerenders: isPrerenderRoute,
                pseudoLayerBytes: initialPseudoLayer.pseudoLayerBytes,
                pseudoLayerUncompressedBytes: initialPseudoLayerUncompressed,
                pseudoLayer: Object.assign({}, initialPseudoLayer.pseudoLayer),
            };
            groups.push(newGroup);
            matchingGroup = newGroup;
        }
        for (const newPage of newPages) {
            Object.keys(pageTraces[newPage] || {}).map(file => {
                const pseudoItem = tracedPseudoLayer[file];
                const compressedSize = pseudoItem?.compBuffer?.byteLength || 0;
                if (!matchingGroup.pseudoLayer[file]) {
                    matchingGroup.pseudoLayer[file] = pseudoItem;
                    matchingGroup.pseudoLayerBytes += compressedSize;
                    matchingGroup.pseudoLayerUncompressedBytes +=
                        pseudoItem.uncompressedSize || 0;
                }
            });
            // ensure the page file itself is accounted for when grouping as
            // large pages can be created that can push the group over the limit
            matchingGroup.pseudoLayerBytes +=
                compressedPages[newPage].compBuffer.byteLength;
            matchingGroup.pseudoLayerUncompressedBytes +=
                compressedPages[newPage].uncompressedSize;
        }
    }
    return groups;
}
exports.getPageLambdaGroups = getPageLambdaGroups;
const outputFunctionFileSizeInfo = (pages, pseudoLayer, pseudoLayerBytes, pseudoLayerUncompressedBytes, compressedPages) => {
    const exceededLimitOutput = [];
    console.log(`Serverless Function's page${pages.length === 1 ? '' : 's'}: ${pages.join(', ')}`);
    exceededLimitOutput.push([
        'Large Dependencies',
        'Uncompressed size',
        'Compressed size',
    ]);
    const dependencies = {};
    for (const fileKey of Object.keys(pseudoLayer)) {
        if (!pseudoLayer[fileKey].isSymlink) {
            const fileItem = pseudoLayer[fileKey];
            const depKey = fileKey.split('/').slice(0, 3).join('/');
            if (!dependencies[depKey]) {
                dependencies[depKey] = {
                    compressed: 0,
                    uncompressed: 0,
                };
            }
            dependencies[depKey].compressed += fileItem.compBuffer.byteLength;
            dependencies[depKey].uncompressed += fileItem.uncompressedSize;
        }
    }
    for (const page of pages) {
        dependencies[`pages/${page}`] = {
            compressed: compressedPages[page].compBuffer.byteLength,
            uncompressed: compressedPages[page].uncompressedSize,
        };
    }
    let numLargeDependencies = 0;
    Object.keys(dependencies)
        .sort((a, b) => {
        // move largest dependencies to the top
        const aDep = dependencies[a];
        const bDep = dependencies[b];
        if (aDep.compressed > bDep.compressed) {
            return -1;
        }
        if (aDep.compressed < bDep.compressed) {
            return 1;
        }
        return 0;
    })
        .forEach(depKey => {
        const dep = dependencies[depKey];
        if (dep.compressed < 100 * exports.KIB && dep.uncompressed < 500 * exports.KIB) {
            // ignore smaller dependencies to reduce noise
            return;
        }
        exceededLimitOutput.push([
            depKey,
            (0, exports.prettyBytes)(dep.uncompressed),
            (0, exports.prettyBytes)(dep.compressed),
        ]);
        numLargeDependencies += 1;
    });
    if (numLargeDependencies === 0) {
        exceededLimitOutput.push([
            'No large dependencies found (> 100KB compressed)',
        ]);
    }
    exceededLimitOutput.push([]);
    exceededLimitOutput.push([
        'All dependencies',
        (0, exports.prettyBytes)(pseudoLayerUncompressedBytes),
        (0, exports.prettyBytes)(pseudoLayerBytes),
    ]);
    console.log((0, text_table_1.default)(exceededLimitOutput, {
        align: ['l', 'r', 'r'],
    }));
};
exports.outputFunctionFileSizeInfo = outputFunctionFileSizeInfo;
const detectLambdaLimitExceeding = async (lambdaGroups, compressedSizeLimit, compressedPages) => {
    // show debug info if within 5 MB of exceeding the limit
    const COMPRESSED_SIZE_LIMIT_CLOSE = compressedSizeLimit - 5 * exports.MIB;
    const UNCOMPRESSED_SIZE_LIMIT_CLOSE = exports.MAX_UNCOMPRESSED_LAMBDA_SIZE - 5 * exports.MIB;
    let numExceededLimit = 0;
    let numCloseToLimit = 0;
    let loggedHeadInfo = false;
    // pre-iterate to see if we are going to exceed the limit
    // or only get close so our first log line can be correct
    const filteredGroups = lambdaGroups.filter(group => {
        const exceededLimit = group.pseudoLayerBytes > compressedSizeLimit ||
            group.pseudoLayerUncompressedBytes > exports.MAX_UNCOMPRESSED_LAMBDA_SIZE;
        const closeToLimit = group.pseudoLayerBytes > COMPRESSED_SIZE_LIMIT_CLOSE ||
            group.pseudoLayerUncompressedBytes > UNCOMPRESSED_SIZE_LIMIT_CLOSE;
        if (closeToLimit ||
            exceededLimit ||
            (0, build_utils_1.getPlatformEnv)('BUILDER_DEBUG') ||
            process.env.NEXT_DEBUG_FUNCTION_SIZE) {
            if (exceededLimit) {
                numExceededLimit += 1;
            }
            if (closeToLimit) {
                numCloseToLimit += 1;
            }
            return true;
        }
    });
    for (const group of filteredGroups) {
        if (!loggedHeadInfo) {
            if (numExceededLimit || numCloseToLimit) {
                console.log(`Warning: Max serverless function size of ${(0, exports.prettyBytes)(compressedSizeLimit)} compressed or ${(0, exports.prettyBytes)(exports.MAX_UNCOMPRESSED_LAMBDA_SIZE)} uncompressed${numExceededLimit ? '' : ' almost'} reached`);
            }
            else {
                console.log(`Serverless function size info`);
            }
            loggedHeadInfo = true;
        }
        (0, exports.outputFunctionFileSizeInfo)(group.pages, group.pseudoLayer, group.pseudoLayerBytes, group.pseudoLayerUncompressedBytes, compressedPages);
    }
    if (numExceededLimit) {
        console.log(`Max serverless function size was exceeded for ${numExceededLimit} function${numExceededLimit === 1 ? '' : 's'}`);
    }
};
exports.detectLambdaLimitExceeding = detectLambdaLimitExceeding;
// checks if prerender files are all static or not before creating lambdas
const onPrerenderRouteInitial = (prerenderManifest, canUsePreviewMode, entryDirectory, nonLambdaSsgPages, routeKey, hasPages404, routesManifest, appDir) => {
    let static404Page;
    let static500Page;
    // Get the route file as it'd be mounted in the builder output
    const pr = prerenderManifest.staticRoutes[routeKey];
    const { initialRevalidate, srcRoute, dataRoute } = pr;
    const route = srcRoute || routeKey;
    const isAppPathRoute = appDir && dataRoute?.endsWith('.rsc');
    const routeNoLocale = routesManifest?.i18n
        ? normalizeLocalePath(routeKey, routesManifest.i18n.locales).pathname
        : routeKey;
    // if the 404 page used getStaticProps we need to update static404Page
    // since it wasn't populated from the staticPages group
    if (routeNoLocale === '/404') {
        static404Page = path_1.default.posix.join(entryDirectory, routeKey);
    }
    if (routeNoLocale === '/500') {
        static500Page = path_1.default.posix.join(entryDirectory, routeKey);
    }
    if (
    // App paths must be Prerenders to ensure Vary header is
    // correctly added
    !isAppPathRoute &&
        initialRevalidate === false &&
        (!canUsePreviewMode || (hasPages404 && routeNoLocale === '/404')) &&
        !prerenderManifest.fallbackRoutes[route] &&
        !prerenderManifest.blockingFallbackRoutes[route]) {
        if (routesManifest?.i18n &&
            Object.keys(prerenderManifest.staticRoutes).some(route => {
                const staticRoute = prerenderManifest.staticRoutes[route];
                return (staticRoute.srcRoute === srcRoute &&
                    staticRoute.initialRevalidate !== false);
            })) {
            // if any locale static routes are using revalidate the page
            // requires a lambda
            return {
                static404Page,
                static500Page,
            };
        }
        nonLambdaSsgPages.add(route === '/' ? '/index' : route);
    }
    return {
        static404Page,
        static500Page,
    };
};
exports.onPrerenderRouteInitial = onPrerenderRouteInitial;
let prerenderGroup = 1;
const onPrerenderRoute = (prerenderRouteArgs) => (routeKey, { isBlocking, isFallback, isOmitted, locale, }) => {
    const { appDir, pagesDir, static404Page, entryDirectory, prerenderManifest, isSharedLambdas, isServerMode, canUsePreviewMode, lambdas, prerenders, pageLambdaMap, routesManifest, isCorrectNotFoundRoutes, isEmptyAllowQueryForPrendered, } = prerenderRouteArgs;
    if (isBlocking && isFallback) {
        throw new build_utils_1.NowBuildError({
            code: 'NEXT_ISBLOCKING_ISFALLBACK',
            message: 'invariant: isBlocking and isFallback cannot both be true',
        });
    }
    if (isFallback && isOmitted) {
        throw new build_utils_1.NowBuildError({
            code: 'NEXT_ISOMITTED_ISFALLBACK',
            message: 'invariant: isOmitted and isFallback cannot both be true',
        });
    }
    // Get the route file as it'd be mounted in the builder output
    let routeFileNoExt = routeKey === '/' ? '/index' : routeKey;
    let origRouteFileNoExt = routeFileNoExt;
    const { isLocalePrefixed } = prerenderManifest;
    if (!locale && isLocalePrefixed) {
        const localePathResult = normalizeLocalePath(routeKey, routesManifest?.i18n?.locales || []);
        locale = localePathResult.detectedLocale;
        origRouteFileNoExt =
            localePathResult.pathname === '/'
                ? '/index'
                : localePathResult.pathname;
    }
    const nonDynamicSsg = !isFallback &&
        !isBlocking &&
        !isOmitted &&
        !prerenderManifest.staticRoutes[routeKey].srcRoute;
    // if there isn't a srcRoute then it's a non-dynamic SSG page
    if ((nonDynamicSsg && !isLocalePrefixed) || isFallback || isOmitted) {
        routeFileNoExt = addLocaleOrDefault(
        // root index files are located without folder/index.html
        routeFileNoExt, routesManifest, locale);
    }
    const isNotFound = prerenderManifest.notFoundRoutes.includes(routeKey);
    let initialRevalidate;
    let srcRoute;
    let dataRoute;
    if (isFallback || isBlocking) {
        const pr = isFallback
            ? prerenderManifest.fallbackRoutes[routeKey]
            : prerenderManifest.blockingFallbackRoutes[routeKey];
        initialRevalidate = 1; // TODO: should Next.js provide this default?
        // @ts-ignore
        if (initialRevalidate === false) {
            // Lazy routes cannot be "snapshotted" in time.
            throw new build_utils_1.NowBuildError({
                code: 'NEXT_ISLAZY_INITIALREVALIDATE',
                message: 'invariant isLazy: initialRevalidate !== false',
            });
        }
        srcRoute = null;
        dataRoute = pr.dataRoute;
    }
    else if (isOmitted) {
        initialRevalidate = false;
        srcRoute = routeKey;
        dataRoute = prerenderManifest.omittedRoutes[routeKey].dataRoute;
    }
    else {
        const pr = prerenderManifest.staticRoutes[routeKey];
        ({ initialRevalidate, srcRoute, dataRoute } = pr);
    }
    let isAppPathRoute = false;
    // TODO: leverage manifest to determine app paths more accurately
    if (appDir && srcRoute && dataRoute.endsWith('.rsc')) {
        isAppPathRoute = true;
    }
    const isOmittedOrNotFound = isOmitted || isNotFound;
    const htmlFsRef = isBlocking || (isNotFound && !static404Page)
        ? // Blocking pages do not have an HTML fallback
            null
        : new build_utils_1.FileFsRef({
            fsPath: path_1.default.join(isAppPathRoute && !isOmittedOrNotFound && appDir
                ? appDir
                : pagesDir, isFallback
                ? // Fallback pages have a special file.
                    addLocaleOrDefault(prerenderManifest.fallbackRoutes[routeKey].fallback, routesManifest, locale)
                : // Otherwise, the route itself should exist as a static HTML
                    // file.
                    `${isOmittedOrNotFound
                        ? addLocaleOrDefault('/404', routesManifest, locale)
                        : routeFileNoExt}.html`),
        });
    const jsonFsRef = 
    // JSON data does not exist for fallback or blocking pages
    isFallback || isBlocking || (isNotFound && !static404Page)
        ? null
        : new build_utils_1.FileFsRef({
            fsPath: path_1.default.join(isAppPathRoute && !isOmittedOrNotFound && appDir
                ? appDir
                : pagesDir, `${isOmittedOrNotFound
                ? addLocaleOrDefault('/404.html', routesManifest, locale)
                : isAppPathRoute
                    ? dataRoute
                    : routeFileNoExt + '.json'}`),
        });
    if (isAppPathRoute) {
        // for literal index routes we need to append an additional /index
        // due to the proxy's normalizing for /index routes
        if (routeKey !== '/index' && routeKey.endsWith('/index')) {
            routeKey = `${routeKey}/index`;
            routeFileNoExt = routeKey;
            origRouteFileNoExt = routeKey;
        }
    }
    let outputPathPage = path_1.default.posix.join(entryDirectory, routeFileNoExt);
    if (!isAppPathRoute) {
        outputPathPage = normalizeIndexOutput(outputPathPage, isServerMode);
    }
    const outputPathPageOrig = path_1.default.posix.join(entryDirectory, origRouteFileNoExt);
    let lambda;
    let outputPathData = path_1.default.posix.join(entryDirectory, dataRoute);
    if (nonDynamicSsg || isFallback || isOmitted) {
        outputPathData = outputPathData.replace(new RegExp(`${(0, escape_string_regexp_1.default)(origRouteFileNoExt)}.json$`), 
        // ensure we escape "$" correctly while replacing as "$" is a special
        // character, we need to do double escaping as first is for the initial
        // replace on the routeFile and then the second on the outputPath
        `${routeFileNoExt.replace(/\$/g, '$$$$')}.json`);
    }
    if (isSharedLambdas) {
        const outputSrcPathPage = normalizeIndexOutput(path_1.default.join('/', srcRoute == null
            ? outputPathPageOrig
            : path_1.default.posix.join(entryDirectory, srcRoute === '/' ? '/index' : srcRoute)), isServerMode);
        const lambdaId = pageLambdaMap[outputSrcPathPage];
        lambda = lambdas[lambdaId];
    }
    else {
        const outputSrcPathPage = normalizeIndexOutput(srcRoute == null
            ? outputPathPageOrig
            : path_1.default.posix.join(entryDirectory, srcRoute === '/' ? '/index' : srcRoute), isServerMode);
        lambda = lambdas[outputSrcPathPage];
    }
    if (!isAppPathRoute && !isNotFound && initialRevalidate === false) {
        if (htmlFsRef == null || jsonFsRef == null) {
            throw new build_utils_1.NowBuildError({
                code: 'NEXT_HTMLFSREF_JSONFSREF',
                message: 'invariant: htmlFsRef != null && jsonFsRef != null',
            });
        }
        // if preview mode/On-Demand ISR can't be leveraged
        // we can output pure static outputs instead of prerenders
        if (!canUsePreviewMode ||
            (routeKey === '/404' && !lambdas[outputPathPage])) {
            htmlFsRef.contentType = _1.htmlContentType;
            prerenders[outputPathPage] = htmlFsRef;
            prerenders[outputPathData] = jsonFsRef;
        }
    }
    const isNotFoundPreview = isCorrectNotFoundRoutes &&
        !initialRevalidate &&
        canUsePreviewMode &&
        isServerMode &&
        isNotFound;
    if (prerenders[outputPathPage] == null &&
        (!isNotFound || initialRevalidate || isNotFoundPreview)) {
        if (lambda == null) {
            throw new build_utils_1.NowBuildError({
                code: 'NEXT_MISSING_LAMBDA',
                message: `Unable to find lambda for route: ${routeFileNoExt}`,
            });
        }
        // `allowQuery` is an array of query parameter keys that are allowed for
        // a given path. All other query keys will be striped. We can automatically
        // detect this for prerender (ISR) pages by reading the routes manifest file.
        const pageKey = srcRoute || routeKey;
        const route = routesManifest?.dynamicRoutes.find((r) => r.page === pageKey && !('isMiddleware' in r));
        const routeKeys = route?.routeKeys;
        // by default allowQuery should be undefined and only set when
        // we have sufficient information to set it
        let allowQuery;
        if (isEmptyAllowQueryForPrendered) {
            const isDynamic = isDynamicRoute(routeKey);
            if (!isDynamic) {
                // for non-dynamic routes we use an empty array since
                // no query values bust the cache for non-dynamic prerenders
                // prerendered paths also do not pass allowQuery as they match
                // during handle: 'filesystem' so should not cache differently
                // by query values
                allowQuery = [];
            }
            else if (routeKeys) {
                // if we have routeKeys in the routes-manifest we use those
                // for allowQuery for dynamic routes
                allowQuery = Object.values(routeKeys);
            }
        }
        else {
            const isDynamic = isDynamicRoute(pageKey);
            if (routeKeys) {
                // if we have routeKeys in the routes-manifest we use those
                // for allowQuery for dynamic routes
                allowQuery = Object.values(routeKeys);
            }
            else if (!isDynamic) {
                // for non-dynamic routes we use an empty array since
                // no query values bust the cache for non-dynamic prerenders
                allowQuery = [];
            }
        }
        const rscVaryHeader = routesManifest?.rsc?.varyHeader ||
            '__rsc__, __next_router_state_tree__, __next_router_prefetch__';
        prerenders[outputPathPage] = new build_utils_1.Prerender({
            expiration: initialRevalidate,
            lambda,
            allowQuery,
            fallback: htmlFsRef,
            group: prerenderGroup,
            bypassToken: prerenderManifest.bypassToken,
            ...(isNotFound
                ? {
                    initialStatus: 404,
                }
                : {}),
            ...(isAppPathRoute
                ? {
                    initialHeaders: {
                        vary: rscVaryHeader,
                    },
                }
                : {}),
        });
        prerenders[outputPathData] = new build_utils_1.Prerender({
            expiration: initialRevalidate,
            lambda,
            allowQuery,
            fallback: jsonFsRef,
            group: prerenderGroup,
            bypassToken: prerenderManifest.bypassToken,
            ...(isNotFound
                ? {
                    initialStatus: 404,
                }
                : {}),
            ...(isAppPathRoute
                ? {
                    initialHeaders: {
                        'content-type': 'application/octet-stream',
                        vary: rscVaryHeader,
                    },
                }
                : {}),
        });
        ++prerenderGroup;
        if (routesManifest?.i18n && isBlocking) {
            for (const locale of routesManifest.i18n.locales) {
                const localeRouteFileNoExt = addLocaleOrDefault(routeFileNoExt, routesManifest, locale);
                const localeOutputPathPage = normalizeIndexOutput(path_1.default.posix.join(entryDirectory, localeRouteFileNoExt), isServerMode);
                const localeOutputPathData = outputPathData.replace(new RegExp(`${(0, escape_string_regexp_1.default)(origRouteFileNoExt)}.json$`), `${localeRouteFileNoExt}${localeRouteFileNoExt !== origRouteFileNoExt &&
                    origRouteFileNoExt === '/index'
                    ? '/index'
                    : ''}.json`);
                const origPrerenderPage = prerenders[outputPathPage];
                const origPrerenderData = prerenders[outputPathData];
                prerenders[localeOutputPathPage] = {
                    ...origPrerenderPage,
                    group: prerenderGroup,
                };
                prerenders[localeOutputPathData] = {
                    ...origPrerenderData,
                    group: prerenderGroup,
                };
                ++prerenderGroup;
            }
        }
    }
    if (((nonDynamicSsg && !isLocalePrefixed) || isFallback || isOmitted) &&
        routesManifest?.i18n &&
        !locale) {
        // load each locale
        for (const locale of routesManifest.i18n.locales) {
            if (locale === routesManifest.i18n.defaultLocale)
                continue;
            (0, exports.onPrerenderRoute)(prerenderRouteArgs)(routeKey, {
                isBlocking,
                isFallback,
                isOmitted,
                locale,
            });
        }
    }
};
exports.onPrerenderRoute = onPrerenderRoute;
async function getStaticFiles(entryPath, entryDirectory, outputDirectory) {
    const collectLabel = 'Collected static files (public/, static/, .next/static)';
    console.time(collectLabel);
    const nextStaticFiles = await (0, build_utils_1.glob)('**', path_1.default.join(entryPath, outputDirectory, 'static'));
    const staticFolderFiles = await (0, build_utils_1.glob)('**', path_1.default.join(entryPath, 'static'));
    let publicFolderFiles = {};
    let publicFolderPath;
    if (await fs_extra_1.default.pathExists(path_1.default.join(entryPath, 'public'))) {
        publicFolderPath = path_1.default.join(entryPath, 'public');
    }
    else if (
    // check at the same level as the output directory also
    await fs_extra_1.default.pathExists(path_1.default.join(entryPath, outputDirectory, '../public'))) {
        publicFolderPath = path_1.default.join(entryPath, outputDirectory, '../public');
    }
    if (publicFolderPath) {
        (0, build_utils_1.debug)(`Using public folder at ${publicFolderPath}`);
        publicFolderFiles = await (0, build_utils_1.glob)('**/*', publicFolderPath);
    }
    else {
        (0, build_utils_1.debug)('No public folder found');
    }
    const staticFiles = {};
    const staticDirectoryFiles = {};
    const publicDirectoryFiles = {};
    for (const file of Object.keys(nextStaticFiles)) {
        staticFiles[path_1.default.posix.join(entryDirectory, `_next/static/${file}`)] =
            nextStaticFiles[file];
    }
    for (const file of Object.keys(staticFolderFiles)) {
        staticDirectoryFiles[path_1.default.posix.join(entryDirectory, 'static', file)] =
            staticFolderFiles[file];
    }
    for (const file of Object.keys(publicFolderFiles)) {
        publicDirectoryFiles[path_1.default.posix.join(entryDirectory, file)] =
            publicFolderFiles[file];
    }
    console.timeEnd(collectLabel);
    return {
        staticFiles,
        staticDirectoryFiles,
        publicDirectoryFiles,
    };
}
exports.getStaticFiles = getStaticFiles;
function normalizeIndexOutput(outputName, isServerMode) {
    if (outputName !== '/index' && isServerMode) {
        return outputName.replace(/\/index$/, '');
    }
    return outputName;
}
exports.normalizeIndexOutput = normalizeIndexOutput;
/**
 * The path to next-server was changed in
 * https://github.com/vercel/next.js/pull/26756
 */
function getNextServerPath(nextVersion) {
    return semver_1.default.gte(nextVersion, 'v11.0.2-canary.4')
        ? 'next/dist/server'
        : 'next/dist/next-server/server';
}
exports.getNextServerPath = getNextServerPath;
// update to leverage
function updateRouteSrc(route, index, manifestItems) {
    if (route.src) {
        route.src = manifestItems[index].regex;
    }
    return route;
}
exports.updateRouteSrc = updateRouteSrc;
async function getPrivateOutputs(dir, entries) {
    const files = {};
    const routes = [];
    for (const [existingFile, outputFile] of Object.entries(entries)) {
        const fsPath = path_1.default.join(dir, existingFile);
        try {
            const { mode, size } = await (0, fs_extra_1.stat)(fsPath);
            if (size > 30 * 1024 * 1024) {
                throw new Error(`Exceeds maximum file size: ${size}`);
            }
            files[outputFile] = new build_utils_1.FileFsRef({ mode, fsPath });
            routes.push({
                src: `/${outputFile}`,
                dest: '/404',
                status: 404,
                continue: true,
            });
        }
        catch (error) {
            (0, build_utils_1.debug)(`Private file ${existingFile} had an error and will not be uploaded: ${error}`);
        }
    }
    return { files, routes };
}
exports.getPrivateOutputs = getPrivateOutputs;
async function getMiddlewareBundle({ entryPath, outputDirectory, routesManifest, isCorrectMiddlewareOrder, prerenderBypassToken, }) {
    const middlewareManifest = await getMiddlewareManifest(entryPath, outputDirectory);
    const sortedFunctions = [
        ...(!middlewareManifest
            ? []
            : middlewareManifest.sortedMiddleware.map(key => ({
                key,
                edgeFunction: middlewareManifest?.middleware[key],
                type: 'middleware',
            }))),
        ...Object.entries(middlewareManifest?.functions ?? {}).map(([key, edgeFunction]) => {
            return {
                key,
                edgeFunction,
                type: 'function',
            };
        }),
    ];
    if (middlewareManifest && sortedFunctions.length > 0) {
        const workerConfigs = await Promise.all(sortedFunctions.map(async ({ key, edgeFunction, type }) => {
            try {
                const wrappedModuleSource = await (0, get_edge_function_source_1.getNextjsEdgeFunctionSource)(edgeFunction.files, {
                    name: edgeFunction.name,
                    staticRoutes: routesManifest.staticRoutes,
                    dynamicRoutes: routesManifest.dynamicRoutes.filter(r => !('isMiddleware' in r)),
                    nextConfig: {
                        basePath: routesManifest.basePath,
                        i18n: routesManifest.i18n,
                    },
                }, path_1.default.resolve(entryPath, outputDirectory), edgeFunction.wasm);
                return {
                    type,
                    page: edgeFunction.page,
                    edgeFunction: (() => {
                        const { source, map } = wrappedModuleSource.sourceAndMap();
                        const transformedMap = (0, sourcemapped_1.stringifySourceMap)(transformSourceMap(map));
                        const wasmFiles = (edgeFunction.wasm ?? []).reduce((acc, { filePath, name }) => {
                            const fullFilePath = path_1.default.join(entryPath, outputDirectory, filePath);
                            acc[`wasm/${name}.wasm`] = new build_utils_1.FileFsRef({
                                mode: 0o644,
                                contentType: 'application/wasm',
                                fsPath: fullFilePath,
                            });
                            return acc;
                        }, {});
                        const assetFiles = (edgeFunction.assets ?? []).reduce((acc, { filePath, name }) => {
                            const fullFilePath = path_1.default.join(entryPath, outputDirectory, filePath);
                            acc[`assets/${name}`] = new build_utils_1.FileFsRef({
                                mode: 0o644,
                                contentType: 'application/octet-stream',
                                fsPath: fullFilePath,
                            });
                            return acc;
                        }, {});
                        return new build_utils_1.EdgeFunction({
                            deploymentTarget: 'v8-worker',
                            name: edgeFunction.name,
                            files: {
                                'index.js': new build_utils_1.FileBlob({
                                    data: source,
                                    contentType: 'application/javascript',
                                    mode: 0o644,
                                }),
                                ...(transformedMap && {
                                    'index.js.map': new build_utils_1.FileBlob({
                                        data: transformedMap,
                                        contentType: 'application/json',
                                        mode: 0o644,
                                    }),
                                }),
                                ...wasmFiles,
                                ...assetFiles,
                            },
                            regions: edgeFunction.regions,
                            entrypoint: 'index.js',
                            envVarsInUse: edgeFunction.env,
                            assets: (edgeFunction.assets ?? []).map(({ name }) => {
                                return {
                                    name,
                                    path: `assets/${name}`,
                                };
                            }),
                        });
                    })(),
                    routeMatchers: getRouteMatchers(edgeFunction, routesManifest),
                };
            }
            catch (e) {
                e.message = `Can't build edge function ${key}: ${e.message}`;
                throw e;
            }
        }));
        const source = {
            staticRoutes: [],
            dynamicRouteMap: new Map(),
            edgeFunctions: {},
        };
        for (const worker of workerConfigs.values()) {
            const edgeFile = worker.edgeFunction.name;
            let shortPath = edgeFile;
            // Replacing the folder prefix for the page
            //
            // For `pages/`, use file base name directly:
            //    pages/index -> index
            // For `app/`, use folder name, handle the root page as index:
            //    app/route/page -> route
            //    app/page -> index
            //    app/index/page -> index/index
            if (shortPath.startsWith('pages/')) {
                shortPath = shortPath.replace(/^pages\//, '');
            }
            else if (shortPath.startsWith('app/') && shortPath.endsWith('/page')) {
                shortPath =
                    shortPath.replace(/^app\//, '').replace(/(^|\/)page$/, '') || 'index';
            }
            if (routesManifest?.basePath) {
                shortPath = path_1.default.posix
                    .join(routesManifest.basePath, shortPath)
                    .replace(/^\//, '');
            }
            worker.edgeFunction.name = shortPath;
            source.edgeFunctions[shortPath] = worker.edgeFunction;
            // we don't add the route for edge functions as these
            // are already added in the routes-manifest under dynamicRoutes
            if (worker.type === 'function') {
                continue;
            }
            for (const matcher of worker.routeMatchers) {
                const route = {
                    continue: true,
                    src: matcher.regexp,
                    has: matcher.has,
                    missing: [
                        {
                            type: 'header',
                            key: 'x-prerender-revalidate',
                            value: prerenderBypassToken,
                        },
                        ...(matcher.missing || []),
                    ],
                };
                route.middlewarePath = shortPath;
                if (isCorrectMiddlewareOrder) {
                    route.override = true;
                }
                if (routesManifest.version > 3 && isDynamicRoute(worker.page)) {
                    source.dynamicRouteMap.set(worker.page, route);
                }
                else {
                    source.staticRoutes.push(route);
                }
            }
        }
        return source;
    }
    return {
        staticRoutes: [],
        dynamicRouteMap: new Map(),
        edgeFunctions: {},
    };
}
exports.getMiddlewareBundle = getMiddlewareBundle;
/**
 * Attempts to read the middleware manifest from the pre-defined
 * location. If the manifest can't be found it will resolve to
 * undefined.
 */
async function getMiddlewareManifest(entryPath, outputDirectory) {
    const middlewareManifestPath = path_1.default.join(entryPath, outputDirectory, './server/middleware-manifest.json');
    const hasManifest = await fs_extra_1.default
        .access(middlewareManifestPath)
        .then(() => true)
        .catch(() => false);
    if (!hasManifest) {
        return;
    }
    const manifest = (await fs_extra_1.default.readJSON(middlewareManifestPath));
    return manifest.version === 1
        ? upgradeMiddlewareManifest(manifest)
        : manifest;
}
exports.getMiddlewareManifest = getMiddlewareManifest;
function upgradeMiddlewareManifest(v1) {
    function updateInfo(v1Info) {
        const { regexp, ...rest } = v1Info;
        return {
            ...rest,
            matchers: [{ regexp }],
        };
    }
    const middleware = Object.fromEntries(Object.entries(v1.middleware).map(([p, info]) => [p, updateInfo(info)]));
    const functions = v1.functions
        ? Object.fromEntries(Object.entries(v1.functions).map(([p, info]) => [p, updateInfo(info)]))
        : undefined;
    return {
        ...v1,
        version: 2,
        middleware,
        functions,
    };
}
exports.upgradeMiddlewareManifest = upgradeMiddlewareManifest;
/**
 * For an object containing middleware info and a routes manifest this will
 * generate a string with the route that will activate the middleware on
 * Vercel Proxy.
 *
 * @param param0 The middleware info including matchers and page.
 * @param param1 The routes manifest
 * @returns matchers for the middleware route.
 */
function getRouteMatchers(info, { basePath = '', i18n }) {
    function getRegexp(regexp) {
        if (info.page === '/') {
            return regexp;
        }
        const locale = i18n?.locales.length
            ? `(?:/(${i18n.locales
                .map(locale => (0, escape_string_regexp_1.default)(locale))
                .join('|')}))?`
            : '';
        return `(?:^${basePath}${locale}${regexp.substring(1)})`;
    }
    function normalizeHas(has) {
        return has.map(v => v.type === 'header'
            ? {
                ...v,
                key: v.key.toLowerCase(),
            }
            : v);
    }
    return info.matchers.map(matcher => {
        const m = {
            regexp: getRegexp(matcher.regexp),
        };
        if (matcher.has) {
            m.has = normalizeHas(matcher.has);
        }
        if (matcher.missing) {
            m.missing = normalizeHas(matcher.missing);
        }
        return m;
    });
}
/**
 * Makes the sources more human-readable in the source map
 * by removing webpack-specific prefixes
 */
function transformSourceMap(sourcemap) {
    if (!sourcemap)
        return;
    const sources = sourcemap.sources
        ?.map(source => {
        return source.replace(/^webpack:\/\/?_N_E\/(?:\.\/)?/, '');
    })
        // Hide the Next.js entrypoint
        .map(source => {
        return source.startsWith('?') ? '[native code]' : source;
    });
    return { ...sourcemap, sources };
}
