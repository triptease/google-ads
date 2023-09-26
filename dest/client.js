"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
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
exports.GaClientError = exports.GoogleAdsClient = exports.ClientPool = exports.InvalidRPCServiceError = exports.ResourceNotFoundError = exports.createServiceCache = void 0;
const sqlstring_1 = __importDefault(require("sqlstring"));
const google_auth_library_1 = require("google-auth-library");
const grpc = __importStar(require("@grpc/grpc-js"));
const lodash_1 = require("lodash");
const protobufjs_1 = require("protobufjs");
const googleads_1 = require("../definitions/googleads");
const extract_1 = require("./extract");
const statter_1 = require("./statter");
const GOOGLE_ADS_ENDPOINT = "googleads.googleapis.com:443";
const GOOGLE_ADS_VERSION = "v14";
const services = googleads_1.google.ads.googleads.v14.services;
const resources = googleads_1.google.ads.googleads.v14.resources;
const Client = grpc.makeGenericClientConstructor({}, "", {});
const createServiceCache = () => {
    const serviceCache = {};
    return {
        get: (serviceName) => {
            if (serviceCache[serviceName]) {
                return serviceCache[serviceName];
            }
        },
        set: (serviceName, service) => {
            serviceCache[serviceName] = service;
        },
        clear: () => {
            for (const serviceName of Object.keys(serviceCache)) {
                serviceCache[serviceName].end();
                delete serviceCache[serviceName];
            }
        },
    };
};
exports.createServiceCache = createServiceCache;
class ResourceNotFoundError extends Error {
}
exports.ResourceNotFoundError = ResourceNotFoundError;
class InvalidRPCServiceError extends Error {
}
exports.InvalidRPCServiceError = InvalidRPCServiceError;
const defaultClientCreator = (channelCredentials, callCredentials, serviceConfig) => new Client(GOOGLE_ADS_ENDPOINT, grpc.credentials.combineChannelCredentials(channelCredentials, callCredentials), { "grpc.service_config": serviceConfig, "grpc.enable_channelz": 0 });
/**
 * A very simple round-robin pool for gRPC clients. This is needed for meta since we run
 * a very large number of concurrent requests which try and multiplex over a single Channel
 * that gets overwhelmed and hangs. This provides a dumb mechanism to spread that load
 * across a pool of clients, who each manage a single Channel per scheme/host/port.
 */
class ClientPool {
    size;
    pool = [];
    currentIndex = 0;
    constructor(authOptions, size = 1, clientCreator = defaultClientCreator) {
        this.size = size;
        if (size <= 0)
            throw new Error("Client pool size must be bigger than 0");
        const channelCredentials = grpc.credentials.createSsl();
        const serviceConfig = JSON.stringify({
            loadBalancingConfig: [{ round_robin: {} }],
        });
        for (let i = 0; i < size; i++) {
            // Creating a new Google auth object for each client (should) force them not to share channels
            const auth = new google_auth_library_1.JWT(authOptions);
            const callCredentials = grpc.credentials.createFromGoogleCredential(auth);
            const client = clientCreator(channelCredentials, callCredentials, serviceConfig);
            this.pool.push(client);
        }
    }
    getClient() {
        if (this.currentIndex === this.size) {
            this.currentIndex = 0;
        }
        return this.pool[this.currentIndex++];
    }
}
exports.ClientPool = ClientPool;
class GoogleAdsClient {
    options;
    // Service creation leaks memory, so services are cached and re-used.
    serviceCache;
    metadata;
    clientPool;
    statter;
    constructor(options) {
        this.options = options;
        this.metadata = new grpc.Metadata();
        this.metadata.add("developer-token", this.options.developerToken);
        this.metadata.add("login-customer-id", this.options.mccAccountId);
        this.clientPool = new ClientPool(this.options.authOptions, this.options.clientPoolSize);
        this.serviceCache = this.options.serviceCache ?? (0, exports.createServiceCache)();
        this.longRunningOps = null;
        this.statter = options.statter ?? new statter_1.NoOpStatter();
    }
    getMccAccountId() {
        return this.options.mccAccountId;
    }
    getRpcImpl(serviceName) {
        const timeout = this.options?.timeout;
        let call;
        return (method, requestData, callback) => {
            if (method === null && requestData === null && callback == null) {
                // Called by rpc.Service.end
                if (call) {
                    call.cancel();
                }
                return;
            }
            const client = this.clientPool.getClient();
            const thisStatter = this.statter;
            call = client.makeUnaryRequest(`/google.ads.googleads.${GOOGLE_ADS_VERSION}.services.${serviceName}/${method.name}`, (value) => Buffer.from(value), (value) => value, requestData, this.metadata, {
                deadline: timeout ? Date.now() + timeout : undefined,
            }, function (err, value) {
                call = undefined;
                if (isServiceError(err)) {
                    thisStatter.increment("google_ads_grpc", 1, [
                        `version:${GOOGLE_ADS_VERSION}`,
                        `outcome:error`,
                        `service:${serviceName}`,
                        `method:${method.name}`,
                    ]);
                    err = new GaClientError(err);
                }
                else {
                    thisStatter.increment("google_ads_grpc", 1, [
                        `version:${GOOGLE_ADS_VERSION}`,
                        `outcome:success`,
                        `service:${serviceName}`,
                        `method:${method.name}`,
                    ]);
                }
                callback(err, value);
            });
            return call;
        };
    }
    fieldsCache;
    async getFieldsForTable(tableName) {
        if (!this.fieldsCache) {
            const fieldQueryService = this.getService("GoogleAdsFieldService");
            const response = await fieldQueryService.searchGoogleAdsFields({
                query: `SELECT name, selectable, category`,
            });
            this.fieldsCache = response.results
                .map((field) => (0, extract_1.extract)(field, ["name"]))
                .filter((field) => field.selectable === true)
                .filter((field) => 
            // Selecting this field will break the google ads api always remove it
            field.name !==
                "campaign_criterion.keyword_theme.free_form_keyword_theme");
        }
        return this.fieldsCache.filter((f) => f.name.startsWith(`${tableName}.`));
    }
    buildSearchSql(tableName, fields, filters = {}, orderBy, orderByDirection = "ASC", limit, includeDrafts) {
        const fieldSql = fields.map((f) => f.name).join(", ");
        const wheres = [];
        // tslint:disable-next-line:forin
        for (const filterName in filters) {
            const filterValue = filters[filterName];
            if (!filterValue) {
                continue;
            }
            if (isRawFilterObject(filterValue)) {
                wheres.push(`${tableName}.${(0, lodash_1.snakeCase)(filterName)} ${filterValue.raw}`);
            }
            else {
                const filterValues = Array.isArray(filterValue)
                    ? filterValue
                    : [filterValue];
                const quotedFilters = filterValues.map((filterValue) => sqlstring_1.default.escape(filterValue));
                const tableFieldName = `${tableName}.${(0, lodash_1.snakeCase)(filterName)}`;
                const conditional = quotedFilters.length === 1
                    ? ` = ${quotedFilters[0]}`
                    : ` in (${quotedFilters.join(",")})`;
                wheres.push(tableFieldName + conditional);
            }
        }
        const wheresSql = wheres.join(" and ");
        return [
            `SELECT ${fieldSql}`,
            `FROM ${tableName}`,
            `${wheresSql ? `WHERE ${wheresSql}` : ""}`,
            `${orderBy ? `ORDER BY ${tableName}.${orderBy} ${orderByDirection}` : ""}`,
            `${limit ? `LIMIT ${limit}` : ""}`,
            `${includeDrafts ? `PARAMETERS include_drafts = true` : ""}`
        ]
            .filter((seg) => !!seg)
            .join(" ");
    }
    async search(params) {
        const results = [];
        for await (const x of this.searchGenerator(params)) {
            results.push(x);
        }
        return results;
    }
    async *searchGenerator(params) {
        const tableName = (0, lodash_1.snakeCase)(params.resource);
        const objName = (0, lodash_1.camelCase)(params.resource);
        const fields = params.fields?.length
            ? params.fields.map((f) => ({ name: f }))
            : await this.getFieldsForTable(tableName);
        const googleAdsService = this.getService("GoogleAdsService");
        let token = null;
        do {
            const query = this.buildSearchSql(tableName, fields, params.filters, params.orderBy ? (0, lodash_1.snakeCase)(params.orderBy) : undefined, params.orderByDirection, params.limit, params.includeDrafts || false);
            const request = {
                customerId: params.customerId,
                query,
                pageToken: token,
                pageSize: 1000,
            };
            let result;
            try {
                result = await googleAdsService.search(request);
            }
            catch (error) {
                this.options.logger?.error("Error occurred during search", {
                    request,
                    error,
                });
                throw error;
            }
            token = result.nextPageToken;
            for (const field of result.results) {
                yield field[objName];
            }
        } while (token);
        return;
    }
    stop() {
        return this.serviceCache.clear();
    }
    async findOne(customerId, resource, resourceId, fields, includeDrafts) {
        const resourceName = `customers/${customerId}/${(0, lodash_1.camelCase)(resource)}s/${resourceId}`;
        const results = await this.search({
            customerId,
            resource,
            // cast as any because we know that all resources have a resource name
            filters: {
                resourceName: [resourceName],
            },
            fields,
            includeDrafts
        });
        if (results.length > 0) {
            return results[0];
        }
        throw new ResourceNotFoundError(`Resource ${resource} with resourceName ${resourceName} for customerId ${customerId} does not exist`);
    }
    getService(serviceName) {
        const cachedService = this.serviceCache.get(serviceName);
        if (cachedService) {
            return cachedService;
        }
        const rpcServiceConstructor = services[serviceName];
        if (!(rpcServiceConstructor.prototype instanceof protobufjs_1.rpc.Service)) {
            throw new InvalidRPCServiceError(`Service with serviceName ${serviceName} does not support remote procedure calls`);
        }
        const rpcImplementation = this.getRpcImpl(serviceName);
        const service = new rpcServiceConstructor(rpcImplementation);
        this.serviceCache.set(serviceName, service);
        return service;
    }
    getLongRunningOperationsService() {
        if (this.longRunningOps === null) {
            this.longRunningOps = new google_proto_1.google.longrunning.Operations(this.getRpcImpl("Operations"));
        }
        return this.longRunningOps;
    }
}
exports.GoogleAdsClient = GoogleAdsClient;
class GaClientError extends Error {
    firstError;
    code;
    details;
    metadata;
    constructor(status) {
        const failures = parseGoogleAdsErrorFromMetadata(status.metadata);
        const failureObj = failures.length > 0 ? failures : status.details;
        super(JSON.stringify(failureObj, null, 2));
        this.details = this.message;
        this.code = status.code;
        this.metadata = status.metadata;
        this.firstError = failures[0]?.errors[0]?.errorCode;
    }
}
exports.GaClientError = GaClientError;
const FAILURE_KEY = `google.ads.googleads.${GOOGLE_ADS_VERSION}.errors.googleadsfailure-bin`;
function parseGoogleAdsErrorFromMetadata(metadata) {
    if (!metadata) {
        return [];
    }
    const failureArray = metadata.get(FAILURE_KEY);
    return failureArray.map((bytes) => googleads_1.google.ads.googleads.v14.errors.GoogleAdsFailure.decode(bytes));
}
function isServiceError(err) {
    return err && err.code && err.details && err.metadata;
}
function isRawFilterObject(obj) {
    return obj.hasOwnProperty("raw");
}
