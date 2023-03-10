"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEdgeEventHandler = void 0;
const build_utils_1 = require("@vercel/build-utils");
const exit_hook_1 = __importDefault(require("exit-hook"));
const edge_runtime_1 = require("edge-runtime");
const esbuild_1 = __importDefault(require("esbuild"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const edge_wasm_plugin_1 = require("./edge-wasm-plugin");
const utils_1 = require("../utils");
const fs_1 = require("fs");
const NODE_VERSION_MAJOR = process.version.match(/^v(\d+)\.\d+/)?.[1];
const NODE_VERSION_IDENTIFIER = `node${NODE_VERSION_MAJOR}`;
if (!NODE_VERSION_MAJOR) {
    throw new Error(`Unable to determine current node version: process.version=${process.version}`);
}
const edgeHandlerTemplate = fs_1.readFileSync(`${__dirname}/edge-handler-template.js`);
async function serializeRequest(message) {
    const bodyBuffer = await build_utils_1.streamToBuffer(message);
    const body = bodyBuffer.toString('base64');
    return JSON.stringify({
        url: message.url,
        method: message.method,
        headers: message.headers,
        body,
    });
}
async function compileUserCode(entrypointPath, entrypointLabel, isMiddleware) {
    const { wasmAssets, plugin: edgeWasmPlugin } = edge_wasm_plugin_1.createEdgeWasmPlugin();
    try {
        const result = await esbuild_1.default.build({
            // bundling behavior: use globals (like "browser") instead
            // of "require" statements for core libraries (like "node")
            platform: 'browser',
            // target syntax: only use syntax available on the current
            // version of node
            target: NODE_VERSION_IDENTIFIER,
            sourcemap: 'inline',
            legalComments: 'none',
            bundle: true,
            plugins: [edgeWasmPlugin],
            entryPoints: [entrypointPath],
            write: false,
            format: 'cjs',
        });
        const compiledFile = result.outputFiles?.[0];
        if (!compiledFile) {
            throw new Error(`Compilation of ${entrypointLabel} produced no output files.`);
        }
        const userCode = `
      // strict mode
      "use strict";var regeneratorRuntime;

      // user code
      ${compiledFile.text};

      // request metadata
      const IS_MIDDLEWARE = ${isMiddleware};
      const ENTRYPOINT_LABEL = '${entrypointLabel}';

      // edge handler
      ${edgeHandlerTemplate}
    `;
        return { userCode, wasmAssets };
    }
    catch (error) {
        // We can't easily show a meaningful stack trace from ncc -> edge-runtime.
        // So, stick with just the message for now.
        console.error(`Failed to compile user code for edge runtime.`);
        utils_1.logError(error);
        return undefined;
    }
}
async function createEdgeRuntime(params) {
    try {
        if (!params) {
            return undefined;
        }
        const wasmBindings = await params.wasmAssets.getContext();
        const edgeRuntime = new edge_runtime_1.EdgeRuntime({
            initialCode: params.userCode,
            extend: (context) => {
                Object.assign(context, {
                    // This is required for esbuild wrapping logic to resolve
                    module: {},
                    // This is required for environment variable access.
                    // In production, env var access is provided by static analysis
                    // so that only the used values are available.
                    process: {
                        env: process.env,
                    },
                    // These are the global bindings for WebAssembly module
                    ...wasmBindings,
                });
                return context;
            },
        });
        const server = await edge_runtime_1.runServer({ runtime: edgeRuntime });
        exit_hook_1.default(server.close);
        return server;
    }
    catch (error) {
        // We can't easily show a meaningful stack trace from ncc -> edge-runtime.
        // So, stick with just the message for now.
        console.error('Failed to instantiate edge runtime.');
        utils_1.logError(error);
        return undefined;
    }
}
async function createEdgeEventHandler(entrypointPath, entrypointLabel, isMiddleware) {
    const userCode = await compileUserCode(entrypointPath, entrypointLabel, isMiddleware);
    const server = await createEdgeRuntime(userCode);
    return async function (request) {
        if (!server) {
            // this error state is already logged, but we have to wait until here to exit the process
            // this matches the serverless function bridge launcher's behavior when
            // an error is thrown in the function
            process.exit(1);
        }
        const response = await node_fetch_1.default(server.url, {
            redirect: 'manual',
            method: 'post',
            body: await serializeRequest(request),
        });
        const body = await response.text();
        const isUserError = response.headers.get('x-vercel-failed') === 'edge-wrapper';
        if (isUserError && response.status >= 500) {
            // this error was "unhandled" from the user code's perspective
            console.log(`Unhandled rejection: ${body}`);
            // this matches the serverless function bridge launcher's behavior when
            // an error is thrown in the function
            process.exit(1);
        }
        return {
            statusCode: response.status,
            headers: response.headers.raw(),
            body,
            encoding: 'utf8',
        };
    };
}
exports.createEdgeEventHandler = createEdgeEventHandler;
