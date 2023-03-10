"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appendRoutesToPhase = void 0;
const index_1 = require("./index");
function appendRoutesToPhase({ routes: prevRoutes, newRoutes, phase, }) {
    const routes = prevRoutes ? [...prevRoutes] : [];
    if (newRoutes === null || newRoutes.length === 0) {
        return routes;
    }
    let isInPhase = false;
    let insertIndex = -1;
    routes.forEach((r, i) => {
        if (index_1.isHandler(r)) {
            if (r.handle === phase) {
                isInPhase = true;
            }
            else if (isInPhase) {
                insertIndex = i;
                isInPhase = false;
            }
        }
    });
    if (isInPhase) {
        routes.push(...newRoutes);
    }
    else if (phase === null) {
        // If the phase is null, we want to insert the routes at the beginning
        const lastPhase = routes.findIndex(r => index_1.isHandler(r) && r.handle);
        if (lastPhase === -1) {
            routes.push(...newRoutes);
        }
        else {
            routes.splice(lastPhase, 0, ...newRoutes);
        }
    }
    else if (insertIndex > -1) {
        routes.splice(insertIndex, 0, ...newRoutes);
    }
    else {
        routes.push({ handle: phase });
        routes.push(...newRoutes);
    }
    return routes;
}
exports.appendRoutesToPhase = appendRoutesToPhase;
