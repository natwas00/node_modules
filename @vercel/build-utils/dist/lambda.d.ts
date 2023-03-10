/// <reference types="node" />
import type { Files, Config } from './types';
interface Environment {
    [key: string]: string;
}
export declare type LambdaOptions = LambdaOptionsWithFiles | LambdaOptionsWithZipBuffer;
export interface LambdaOptionsBase {
    handler: string;
    runtime: string;
    memory?: number;
    maxDuration?: number;
    environment?: Environment;
    allowQuery?: string[];
    regions?: string[];
    supportsMultiPayloads?: boolean;
    supportsWrapper?: boolean;
    experimentalResponseStreaming?: boolean;
    operationType?: string;
}
export interface LambdaOptionsWithFiles extends LambdaOptionsBase {
    files: Files;
}
/**
 * @deprecated Use `LambdaOptionsWithFiles` instead.
 */
export interface LambdaOptionsWithZipBuffer extends LambdaOptionsBase {
    /**
     * @deprecated Use `files` property instead.
     */
    zipBuffer: Buffer;
}
interface GetLambdaOptionsFromFunctionOptions {
    sourceFile: string;
    config?: Pick<Config, 'functions'>;
}
export declare class Lambda {
    type: 'Lambda';
    /**
     * This is a label for the type of Lambda a framework is producing.
     * The value can be any string that makes sense for a given framework.
     * Examples: "API", "ISR", "SSR", "SSG", "Render", "Resource"
     */
    operationType?: string;
    files?: Files;
    handler: string;
    runtime: string;
    memory?: number;
    maxDuration?: number;
    environment: Environment;
    allowQuery?: string[];
    regions?: string[];
    /**
     * @deprecated Use `await lambda.createZip()` instead.
     */
    zipBuffer?: Buffer;
    supportsMultiPayloads?: boolean;
    supportsWrapper?: boolean;
    experimentalResponseStreaming?: boolean;
    constructor(opts: LambdaOptions);
    createZip(): Promise<Buffer>;
}
/**
 * @deprecated Use `new Lambda()` instead.
 */
export declare function createLambda(opts: LambdaOptions): Promise<Lambda>;
export declare function createZip(files: Files): Promise<Buffer>;
export declare function getLambdaOptionsFromFunction({ sourceFile, config, }: GetLambdaOptionsFromFunctionOptions): Promise<Pick<LambdaOptions, 'memory' | 'maxDuration'>>;
export {};
