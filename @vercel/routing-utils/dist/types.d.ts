import { HandleValue } from './index';
export declare type RouteApiError = {
    name: string;
    code: string;
    message: string;
    link?: string;
    action?: string;
    errors?: string[];
};
export declare type HasField = Array<{
    type: 'host';
    value: string;
} | {
    type: 'header' | 'cookie' | 'query';
    key: string;
    value?: string;
}>;
export declare type RouteWithSrc = {
    src: string;
    dest?: string;
    headers?: {
        [name: string]: string;
    };
    methods?: string[];
    continue?: boolean;
    override?: boolean;
    caseSensitive?: boolean;
    check?: boolean;
    important?: boolean;
    status?: number;
    has?: HasField;
    missing?: HasField;
    locale?: {
        redirect?: Record<string, string>;
        cookie?: string;
    };
    /**
     * A middleware key within the `output` key under the build result.
     * Overrides a `middleware` definition.
     */
    middlewarePath?: string;
    /**
     * A middleware index in the `middleware` key under the build result
     */
    middleware?: number;
};
export declare type RouteWithHandle = {
    handle: HandleValue;
    src?: string;
    dest?: string;
    status?: number;
};
export declare type Route = RouteWithSrc | RouteWithHandle;
export declare type NormalizedRoutes = {
    routes: Route[] | null;
    error: RouteApiError | null;
};
export interface GetRoutesProps {
    routes?: Route[];
    cleanUrls?: boolean;
    rewrites?: Rewrite[];
    redirects?: Redirect[];
    headers?: Header[];
    trailingSlash?: boolean;
}
export interface MergeRoutesProps {
    userRoutes?: Route[] | null | undefined;
    builds: Build[];
}
export interface Build {
    use: string;
    entrypoint: string;
    routes?: Route[];
}
export interface Rewrite {
    source: string;
    destination: string;
    has?: HasField;
    missing?: HasField;
}
export interface Redirect {
    source: string;
    destination: string;
    permanent?: boolean;
    statusCode?: number;
    has?: HasField;
    missing?: HasField;
}
export interface Header {
    source: string;
    headers: HeaderKeyValue[];
    has?: HasField;
    missing?: HasField;
}
export interface HeaderKeyValue {
    key: string;
    value: string;
}
export interface AppendRoutesToPhaseProps {
    /**
     * All input routes including `handle` phases.
     */
    routes: Route[] | null;
    /**
     * The routes to append to a specific phase.
     */
    newRoutes: Route[] | null;
    /**
     * The phase to append the routes such as `filesystem`.
     * If the phase is `null`, the routes will be appended prior to the first handle being found.
     */
    phase: HandleValue | null;
}
