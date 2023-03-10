import { File } from './types';
import { Lambda } from './lambda';
interface PrerenderOptions {
    expiration: number | false;
    lambda?: Lambda;
    fallback: File | null;
    group?: number;
    bypassToken?: string | null;
    allowQuery?: string[];
    initialHeaders?: Record<string, string>;
    initialStatus?: number;
}
export declare class Prerender {
    type: 'Prerender';
    expiration: number | false;
    lambda?: Lambda;
    fallback: File | null;
    group?: number;
    bypassToken: string | null;
    allowQuery?: string[];
    initialHeaders?: Record<string, string>;
    initialStatus?: number;
    constructor({ expiration, lambda, fallback, group, bypassToken, allowQuery, initialHeaders, initialStatus, }: PrerenderOptions);
}
export {};
