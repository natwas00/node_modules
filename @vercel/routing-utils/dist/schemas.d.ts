export declare const hasSchema: {
    readonly description: "An array of requirements that are needed to match";
    readonly type: "array";
    readonly maxItems: 16;
    readonly items: {
        readonly anyOf: readonly [{
            readonly type: "object";
            readonly additionalProperties: false;
            readonly required: readonly ["type", "value"];
            readonly properties: {
                readonly type: {
                    readonly description: "The type of request element to check";
                    readonly type: "string";
                    readonly enum: readonly ["host"];
                };
                readonly value: {
                    readonly description: "A regular expression used to match the value. Named groups can be used in the destination";
                    readonly type: "string";
                    readonly maxLength: 4096;
                };
            };
        }, {
            readonly type: "object";
            readonly additionalProperties: false;
            readonly required: readonly ["type", "key"];
            readonly properties: {
                readonly type: {
                    readonly description: "The type of request element to check";
                    readonly type: "string";
                    readonly enum: readonly ["header", "cookie", "query"];
                };
                readonly key: {
                    readonly description: "The name of the element contained in the particular type";
                    readonly type: "string";
                    readonly maxLength: 4096;
                };
                readonly value: {
                    readonly description: "A regular expression used to match the value. Named groups can be used in the destination";
                    readonly type: "string";
                    readonly maxLength: 4096;
                };
            };
        }];
    };
};
/**
 * An ajv schema for the routes array
 */
export declare const routesSchema: {
    readonly type: "array";
    readonly maxItems: 1024;
    readonly deprecated: true;
    readonly description: "A list of routes objects used to rewrite paths to point towards other internal or external paths";
    readonly example: readonly [{
        readonly dest: "https://docs.example.com";
        readonly src: "/docs";
    }];
    readonly items: {
        readonly anyOf: readonly [{
            readonly type: "object";
            readonly required: readonly ["src"];
            readonly additionalProperties: false;
            readonly properties: {
                readonly src: {
                    readonly type: "string";
                    readonly maxLength: 4096;
                };
                readonly dest: {
                    readonly type: "string";
                    readonly maxLength: 4096;
                };
                readonly headers: {
                    readonly type: "object";
                    readonly additionalProperties: false;
                    readonly minProperties: 1;
                    readonly maxProperties: 100;
                    readonly patternProperties: {
                        readonly '^.{1,256}$': {
                            readonly type: "string";
                            readonly maxLength: 4096;
                        };
                    };
                };
                readonly methods: {
                    readonly type: "array";
                    readonly maxItems: 10;
                    readonly items: {
                        readonly type: "string";
                        readonly maxLength: 32;
                    };
                };
                readonly caseSensitive: {
                    readonly type: "boolean";
                };
                readonly important: {
                    readonly type: "boolean";
                };
                readonly user: {
                    readonly type: "boolean";
                };
                readonly continue: {
                    readonly type: "boolean";
                };
                readonly override: {
                    readonly type: "boolean";
                };
                readonly check: {
                    readonly type: "boolean";
                };
                readonly status: {
                    readonly type: "integer";
                    readonly minimum: 100;
                    readonly maximum: 999;
                };
                readonly locale: {
                    readonly type: "object";
                    readonly additionalProperties: false;
                    readonly minProperties: 1;
                    readonly properties: {
                        readonly redirect: {
                            readonly type: "object";
                            readonly additionalProperties: false;
                            readonly minProperties: 1;
                            readonly maxProperties: 100;
                            readonly patternProperties: {
                                readonly '^.{1,256}$': {
                                    readonly type: "string";
                                    readonly maxLength: 4096;
                                };
                            };
                        };
                        readonly value: {
                            readonly type: "string";
                            readonly maxLength: 4096;
                        };
                        readonly path: {
                            readonly type: "string";
                            readonly maxLength: 4096;
                        };
                        readonly cookie: {
                            readonly type: "string";
                            readonly maxLength: 4096;
                        };
                        readonly default: {
                            readonly type: "string";
                            readonly maxLength: 4096;
                        };
                    };
                };
                readonly middleware: {
                    readonly type: "number";
                };
                readonly middlewarePath: {
                    readonly type: "string";
                };
                readonly has: {
                    readonly description: "An array of requirements that are needed to match";
                    readonly type: "array";
                    readonly maxItems: 16;
                    readonly items: {
                        readonly anyOf: readonly [{
                            readonly type: "object";
                            readonly additionalProperties: false;
                            readonly required: readonly ["type", "value"];
                            readonly properties: {
                                readonly type: {
                                    readonly description: "The type of request element to check";
                                    readonly type: "string";
                                    readonly enum: readonly ["host"];
                                };
                                readonly value: {
                                    readonly description: "A regular expression used to match the value. Named groups can be used in the destination";
                                    readonly type: "string";
                                    readonly maxLength: 4096;
                                };
                            };
                        }, {
                            readonly type: "object";
                            readonly additionalProperties: false;
                            readonly required: readonly ["type", "key"];
                            readonly properties: {
                                readonly type: {
                                    readonly description: "The type of request element to check";
                                    readonly type: "string";
                                    readonly enum: readonly ["header", "cookie", "query"];
                                };
                                readonly key: {
                                    readonly description: "The name of the element contained in the particular type";
                                    readonly type: "string";
                                    readonly maxLength: 4096;
                                };
                                readonly value: {
                                    readonly description: "A regular expression used to match the value. Named groups can be used in the destination";
                                    readonly type: "string";
                                    readonly maxLength: 4096;
                                };
                            };
                        }];
                    };
                };
                readonly missing: {
                    readonly description: "An array of requirements that are needed to match";
                    readonly type: "array";
                    readonly maxItems: 16;
                    readonly items: {
                        readonly anyOf: readonly [{
                            readonly type: "object";
                            readonly additionalProperties: false;
                            readonly required: readonly ["type", "value"];
                            readonly properties: {
                                readonly type: {
                                    readonly description: "The type of request element to check";
                                    readonly type: "string";
                                    readonly enum: readonly ["host"];
                                };
                                readonly value: {
                                    readonly description: "A regular expression used to match the value. Named groups can be used in the destination";
                                    readonly type: "string";
                                    readonly maxLength: 4096;
                                };
                            };
                        }, {
                            readonly type: "object";
                            readonly additionalProperties: false;
                            readonly required: readonly ["type", "key"];
                            readonly properties: {
                                readonly type: {
                                    readonly description: "The type of request element to check";
                                    readonly type: "string";
                                    readonly enum: readonly ["header", "cookie", "query"];
                                };
                                readonly key: {
                                    readonly description: "The name of the element contained in the particular type";
                                    readonly type: "string";
                                    readonly maxLength: 4096;
                                };
                                readonly value: {
                                    readonly description: "A regular expression used to match the value. Named groups can be used in the destination";
                                    readonly type: "string";
                                    readonly maxLength: 4096;
                                };
                            };
                        }];
                    };
                };
            };
        }, {
            readonly type: "object";
            readonly required: readonly ["handle"];
            readonly additionalProperties: false;
            readonly properties: {
                readonly handle: {
                    readonly type: "string";
                    readonly maxLength: 32;
                    readonly enum: readonly ["error", "filesystem", "hit", "miss", "resource", "rewrite"];
                };
            };
        }];
    };
};
export declare const rewritesSchema: {
    readonly type: "array";
    readonly maxItems: 1024;
    readonly description: "A list of rewrite definitions.";
    readonly items: {
        readonly type: "object";
        readonly additionalProperties: false;
        readonly required: readonly ["source", "destination"];
        readonly properties: {
            readonly source: {
                readonly description: "A pattern that matches each incoming pathname (excluding querystring).";
                readonly type: "string";
                readonly maxLength: 4096;
            };
            readonly destination: {
                readonly description: "An absolute pathname to an existing resource or an external URL.";
                readonly type: "string";
                readonly maxLength: 4096;
            };
            readonly has: {
                readonly description: "An array of requirements that are needed to match";
                readonly type: "array";
                readonly maxItems: 16;
                readonly items: {
                    readonly anyOf: readonly [{
                        readonly type: "object";
                        readonly additionalProperties: false;
                        readonly required: readonly ["type", "value"];
                        readonly properties: {
                            readonly type: {
                                readonly description: "The type of request element to check";
                                readonly type: "string";
                                readonly enum: readonly ["host"];
                            };
                            readonly value: {
                                readonly description: "A regular expression used to match the value. Named groups can be used in the destination";
                                readonly type: "string";
                                readonly maxLength: 4096;
                            };
                        };
                    }, {
                        readonly type: "object";
                        readonly additionalProperties: false;
                        readonly required: readonly ["type", "key"];
                        readonly properties: {
                            readonly type: {
                                readonly description: "The type of request element to check";
                                readonly type: "string";
                                readonly enum: readonly ["header", "cookie", "query"];
                            };
                            readonly key: {
                                readonly description: "The name of the element contained in the particular type";
                                readonly type: "string";
                                readonly maxLength: 4096;
                            };
                            readonly value: {
                                readonly description: "A regular expression used to match the value. Named groups can be used in the destination";
                                readonly type: "string";
                                readonly maxLength: 4096;
                            };
                        };
                    }];
                };
            };
            readonly missing: {
                readonly description: "An array of requirements that are needed to match";
                readonly type: "array";
                readonly maxItems: 16;
                readonly items: {
                    readonly anyOf: readonly [{
                        readonly type: "object";
                        readonly additionalProperties: false;
                        readonly required: readonly ["type", "value"];
                        readonly properties: {
                            readonly type: {
                                readonly description: "The type of request element to check";
                                readonly type: "string";
                                readonly enum: readonly ["host"];
                            };
                            readonly value: {
                                readonly description: "A regular expression used to match the value. Named groups can be used in the destination";
                                readonly type: "string";
                                readonly maxLength: 4096;
                            };
                        };
                    }, {
                        readonly type: "object";
                        readonly additionalProperties: false;
                        readonly required: readonly ["type", "key"];
                        readonly properties: {
                            readonly type: {
                                readonly description: "The type of request element to check";
                                readonly type: "string";
                                readonly enum: readonly ["header", "cookie", "query"];
                            };
                            readonly key: {
                                readonly description: "The name of the element contained in the particular type";
                                readonly type: "string";
                                readonly maxLength: 4096;
                            };
                            readonly value: {
                                readonly description: "A regular expression used to match the value. Named groups can be used in the destination";
                                readonly type: "string";
                                readonly maxLength: 4096;
                            };
                        };
                    }];
                };
            };
        };
    };
};
export declare const redirectsSchema: {
    readonly title: "Redirects";
    readonly type: "array";
    readonly maxItems: 1024;
    readonly description: "A list of redirect definitions.";
    readonly items: {
        readonly type: "object";
        readonly additionalProperties: false;
        readonly required: readonly ["source", "destination"];
        readonly properties: {
            readonly source: {
                readonly description: "A pattern that matches each incoming pathname (excluding querystring).";
                readonly type: "string";
                readonly maxLength: 4096;
            };
            readonly destination: {
                readonly description: "A location destination defined as an absolute pathname or external URL.";
                readonly type: "string";
                readonly maxLength: 4096;
            };
            readonly permanent: {
                readonly description: "A boolean to toggle between permanent and temporary redirect. When `true`, the status code is `308`. When `false` the status code is `307`.";
                readonly type: "boolean";
            };
            readonly statusCode: {
                readonly private: true;
                readonly type: "integer";
                readonly minimum: 100;
                readonly maximum: 999;
            };
            readonly has: {
                readonly description: "An array of requirements that are needed to match";
                readonly type: "array";
                readonly maxItems: 16;
                readonly items: {
                    readonly anyOf: readonly [{
                        readonly type: "object";
                        readonly additionalProperties: false;
                        readonly required: readonly ["type", "value"];
                        readonly properties: {
                            readonly type: {
                                readonly description: "The type of request element to check";
                                readonly type: "string";
                                readonly enum: readonly ["host"];
                            };
                            readonly value: {
                                readonly description: "A regular expression used to match the value. Named groups can be used in the destination";
                                readonly type: "string";
                                readonly maxLength: 4096;
                            };
                        };
                    }, {
                        readonly type: "object";
                        readonly additionalProperties: false;
                        readonly required: readonly ["type", "key"];
                        readonly properties: {
                            readonly type: {
                                readonly description: "The type of request element to check";
                                readonly type: "string";
                                readonly enum: readonly ["header", "cookie", "query"];
                            };
                            readonly key: {
                                readonly description: "The name of the element contained in the particular type";
                                readonly type: "string";
                                readonly maxLength: 4096;
                            };
                            readonly value: {
                                readonly description: "A regular expression used to match the value. Named groups can be used in the destination";
                                readonly type: "string";
                                readonly maxLength: 4096;
                            };
                        };
                    }];
                };
            };
            readonly missing: {
                readonly description: "An array of requirements that are needed to match";
                readonly type: "array";
                readonly maxItems: 16;
                readonly items: {
                    readonly anyOf: readonly [{
                        readonly type: "object";
                        readonly additionalProperties: false;
                        readonly required: readonly ["type", "value"];
                        readonly properties: {
                            readonly type: {
                                readonly description: "The type of request element to check";
                                readonly type: "string";
                                readonly enum: readonly ["host"];
                            };
                            readonly value: {
                                readonly description: "A regular expression used to match the value. Named groups can be used in the destination";
                                readonly type: "string";
                                readonly maxLength: 4096;
                            };
                        };
                    }, {
                        readonly type: "object";
                        readonly additionalProperties: false;
                        readonly required: readonly ["type", "key"];
                        readonly properties: {
                            readonly type: {
                                readonly description: "The type of request element to check";
                                readonly type: "string";
                                readonly enum: readonly ["header", "cookie", "query"];
                            };
                            readonly key: {
                                readonly description: "The name of the element contained in the particular type";
                                readonly type: "string";
                                readonly maxLength: 4096;
                            };
                            readonly value: {
                                readonly description: "A regular expression used to match the value. Named groups can be used in the destination";
                                readonly type: "string";
                                readonly maxLength: 4096;
                            };
                        };
                    }];
                };
            };
        };
    };
};
export declare const headersSchema: {
    readonly type: "array";
    readonly maxItems: 1024;
    readonly description: "A list of header definitions.";
    readonly items: {
        readonly type: "object";
        readonly additionalProperties: false;
        readonly required: readonly ["source", "headers"];
        readonly properties: {
            readonly source: {
                readonly description: "A pattern that matches each incoming pathname (excluding querystring)";
                readonly type: "string";
                readonly maxLength: 4096;
            };
            readonly headers: {
                readonly description: "An array of key/value pairs representing each response header.";
                readonly type: "array";
                readonly maxItems: 1024;
                readonly items: {
                    readonly type: "object";
                    readonly additionalProperties: false;
                    readonly required: readonly ["key", "value"];
                    readonly properties: {
                        readonly key: {
                            readonly type: "string";
                            readonly maxLength: 4096;
                        };
                        readonly value: {
                            readonly type: "string";
                            readonly maxLength: 4096;
                        };
                    };
                };
            };
            readonly has: {
                readonly description: "An array of requirements that are needed to match";
                readonly type: "array";
                readonly maxItems: 16;
                readonly items: {
                    readonly anyOf: readonly [{
                        readonly type: "object";
                        readonly additionalProperties: false;
                        readonly required: readonly ["type", "value"];
                        readonly properties: {
                            readonly type: {
                                readonly description: "The type of request element to check";
                                readonly type: "string";
                                readonly enum: readonly ["host"];
                            };
                            readonly value: {
                                readonly description: "A regular expression used to match the value. Named groups can be used in the destination";
                                readonly type: "string";
                                readonly maxLength: 4096;
                            };
                        };
                    }, {
                        readonly type: "object";
                        readonly additionalProperties: false;
                        readonly required: readonly ["type", "key"];
                        readonly properties: {
                            readonly type: {
                                readonly description: "The type of request element to check";
                                readonly type: "string";
                                readonly enum: readonly ["header", "cookie", "query"];
                            };
                            readonly key: {
                                readonly description: "The name of the element contained in the particular type";
                                readonly type: "string";
                                readonly maxLength: 4096;
                            };
                            readonly value: {
                                readonly description: "A regular expression used to match the value. Named groups can be used in the destination";
                                readonly type: "string";
                                readonly maxLength: 4096;
                            };
                        };
                    }];
                };
            };
            readonly missing: {
                readonly description: "An array of requirements that are needed to match";
                readonly type: "array";
                readonly maxItems: 16;
                readonly items: {
                    readonly anyOf: readonly [{
                        readonly type: "object";
                        readonly additionalProperties: false;
                        readonly required: readonly ["type", "value"];
                        readonly properties: {
                            readonly type: {
                                readonly description: "The type of request element to check";
                                readonly type: "string";
                                readonly enum: readonly ["host"];
                            };
                            readonly value: {
                                readonly description: "A regular expression used to match the value. Named groups can be used in the destination";
                                readonly type: "string";
                                readonly maxLength: 4096;
                            };
                        };
                    }, {
                        readonly type: "object";
                        readonly additionalProperties: false;
                        readonly required: readonly ["type", "key"];
                        readonly properties: {
                            readonly type: {
                                readonly description: "The type of request element to check";
                                readonly type: "string";
                                readonly enum: readonly ["header", "cookie", "query"];
                            };
                            readonly key: {
                                readonly description: "The name of the element contained in the particular type";
                                readonly type: "string";
                                readonly maxLength: 4096;
                            };
                            readonly value: {
                                readonly description: "A regular expression used to match the value. Named groups can be used in the destination";
                                readonly type: "string";
                                readonly maxLength: 4096;
                            };
                        };
                    }];
                };
            };
        };
    };
};
export declare const cleanUrlsSchema: {
    readonly description: "When set to `true`, all HTML files and Serverless Functions will have their extension removed. When visiting a path that ends with the extension, a 308 response will redirect the client to the extensionless path.";
    readonly type: "boolean";
};
export declare const trailingSlashSchema: {
    readonly description: "When `false`, visiting a path that ends with a forward slash will respond with a `308` status code and redirect to the path without the trailing slash.";
    readonly type: "boolean";
};
