"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeRoutes = void 0;
const index_1 = require("./index");
function getBuilderRoutesMapping(builds) {
    const builderRoutes = {};
    for (const { entrypoint, routes, use } of builds) {
        if (routes) {
            if (!builderRoutes[entrypoint]) {
                builderRoutes[entrypoint] = {};
            }
            builderRoutes[entrypoint][use] = routes;
        }
    }
    return builderRoutes;
}
function getCheckAndContinue(routes) {
    const checks = [];
    const continues = [];
    const others = [];
    for (const route of routes) {
        if (index_1.isHandler(route)) {
            // Should never happen, only here to make TS happy
            throw new Error(`Unexpected route found in getCheckAndContinue(): ${JSON.stringify(route)}`);
        }
        else if (route.check && !route.override) {
            checks.push(route);
        }
        else if (route.continue && !route.override) {
            continues.push(route);
        }
        else {
            others.push(route);
        }
    }
    return { checks, continues, others };
}
function mergeRoutes({ userRoutes, builds }) {
    const userHandleMap = new Map();
    let userPrevHandle = null;
    (userRoutes || []).forEach(route => {
        if (index_1.isHandler(route)) {
            userPrevHandle = route.handle;
        }
        else {
            const routes = userHandleMap.get(userPrevHandle);
            if (!routes) {
                userHandleMap.set(userPrevHandle, [route]);
            }
            else {
                routes.push(route);
            }
        }
    });
    const builderHandleMap = new Map();
    const builderRoutes = getBuilderRoutesMapping(builds);
    const sortedPaths = Object.keys(builderRoutes).sort();
    sortedPaths.forEach(path => {
        const br = builderRoutes[path];
        const sortedBuilders = Object.keys(br).sort();
        sortedBuilders.forEach(use => {
            let builderPrevHandle = null;
            br[use].forEach(route => {
                if (index_1.isHandler(route)) {
                    builderPrevHandle = route.handle;
                }
                else {
                    const routes = builderHandleMap.get(builderPrevHandle);
                    if (!routes) {
                        builderHandleMap.set(builderPrevHandle, [route]);
                    }
                    else {
                        routes.push(route);
                    }
                }
            });
        });
    });
    const outputRoutes = [];
    const uniqueHandleValues = new Set([
        null,
        ...userHandleMap.keys(),
        ...builderHandleMap.keys(),
    ]);
    for (const handle of uniqueHandleValues) {
        const userRoutes = userHandleMap.get(handle) || [];
        const builderRoutes = builderHandleMap.get(handle) || [];
        const builderSorted = getCheckAndContinue(builderRoutes);
        if (handle !== null &&
            (userRoutes.length > 0 || builderRoutes.length > 0)) {
            outputRoutes.push({ handle });
        }
        outputRoutes.push(...builderSorted.continues);
        outputRoutes.push(...userRoutes);
        outputRoutes.push(...builderSorted.checks);
        outputRoutes.push(...builderSorted.others);
    }
    return outputRoutes;
}
exports.mergeRoutes = mergeRoutes;
