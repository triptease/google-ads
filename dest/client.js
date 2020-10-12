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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
    function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleAdsClient = exports.InvalidRPCServiceError = exports.ResourceNotFoundError = void 0;
const google_auth_library_1 = require("google-auth-library");
const grpc_1 = __importDefault(require("grpc"));
const lodash_1 = require("lodash");
const $protobuf = __importStar(require("protobufjs"));
const google_proto_1 = require("../compiled/google-proto");
const error_parsing_interceptor_1 = require("./error-parsing-interceptor");
const extract_1 = require("./extract");
const GOOGLE_ADS_ENDPOINT = 'googleads.googleapis.com:443';
const services = google_proto_1.google.ads.googleads.v5.services;
const resources = google_proto_1.google.ads.googleads.v5.resources;
const Client = grpc_1.default.makeGenericClientConstructor({}, '', {});
class ResourceNotFoundError extends Error {
}
exports.ResourceNotFoundError = ResourceNotFoundError;
class InvalidRPCServiceError extends Error {
}
exports.InvalidRPCServiceError = InvalidRPCServiceError;
class GoogleAdsClient {
    constructor(options) {
        this.options = options;
        this.auth = new google_auth_library_1.JWT(this.options.authOptions);
    }
    getMccAccountId() {
        return this.options.mccAccountId;
    }
    getRpcImpl(serviceName) {
        const sslCreds = grpc_1.default.credentials.createSsl();
        const googleCreds = grpc_1.default.credentials.createFromGoogleCredential(this.auth);
        const client = new Client(GOOGLE_ADS_ENDPOINT, grpc_1.default.credentials.combineChannelCredentials(sslCreds, googleCreds), {
            interceptors: this.buildInterceptors(),
        });
        const metadata = new grpc_1.default.Metadata();
        metadata.add('developer-token', this.options.developerToken);
        metadata.add('login-customer-id', this.options.mccAccountId);
        // tslint:disable-next-line:only-arrow-functions
        return function (method, requestData, callback) {
            client.makeUnaryRequest(`/google.ads.googleads.v5.services.${serviceName}/` + method.name, 
            // @ts-ignore
            arg => arg, arg => arg, requestData, metadata, null, callback);
        };
    }
    async getFieldsForTable(tableName) {
        if (!this.fieldsCache) {
            const fieldQueryService = await this.getService('GoogleAdsFieldService');
            const response = await fieldQueryService.searchGoogleAdsFields({
                query: `SELECT name, selectable, category`,
            });
            this.fieldsCache = response.results
                .map(field => extract_1.extract(field, ['name']))
                .filter(field => field.selectable === true);
        }
        return this.fieldsCache.filter(f => f.name.startsWith(`${tableName}.`));
    }
    buildSearchSql(tableName, fields, filters = {}, orderBy, orderByDirection = 'ASC', limit) {
        const fieldSql = fields.map(f => f.name).join(', ');
        const wheres = [];
        // tslint:disable-next-line:forin
        for (const filterName in filters) {
            const filterValue = filters[filterName];
            if (!filterValue) {
                continue;
            }
            const filterValues = Array.isArray(filterValue) ? filterValue : [filterValue];
            const quotedFilters = filterValues.map(filterValue => `"${filterValue}"`);
            const filterStatement = `${tableName}.${lodash_1.snakeCase(filterName)} in (${quotedFilters.join(',')})`;
            wheres.push(filterStatement);
        }
        const wheresSql = wheres.join(' and ');
        return [
            `SELECT ${fieldSql}`,
            `FROM ${tableName}`,
            `${wheresSql ? `WHERE ${wheresSql}` : ''}`,
            `${orderBy ? `ORDER BY ${tableName}.${orderBy} ${orderByDirection}` : ''}`,
            `${limit ? `LIMIT ${limit}` : ''}`,
        ]
            .filter(seg => !!seg)
            .join(' ');
    }
    async search(params) {
        var e_1, _a;
        const results = [];
        try {
            for (var _b = __asyncValues(this.searchGenerator(params)), _c; _c = await _b.next(), !_c.done;) {
                const x = _c.value;
                results.push(x);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) await _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return results;
    }
    searchGenerator(params) {
        return __asyncGenerator(this, arguments, function* searchGenerator_1() {
            const tableName = lodash_1.snakeCase(params.resource);
            const objName = lodash_1.camelCase(params.resource);
            const fields = yield __await(this.getFieldsForTable(tableName));
            const queryService = yield __await(this.getService('GoogleAdsService'));
            let token = null;
            do {
                const request = {
                    customerId: params.customerId,
                    query: this.buildSearchSql(tableName, fields, params.filters, params.orderBy ? lodash_1.snakeCase(params.orderBy) : undefined, params.orderByDirection, params.limit),
                    pageToken: token,
                    pageSize: 1000,
                };
                const result = yield __await(queryService.search(request));
                token = result.nextPageToken;
                for (const field of result.results) {
                    yield yield __await(field[objName]);
                }
            } while (token);
            return yield __await(void 0);
        });
    }
    async findOne(customerId, resource, resourceId) {
        const resourceName = `customers/${customerId}/${lodash_1.camelCase(resource)}s/${resourceId}`;
        const results = await this.search({
            customerId,
            resource,
            // cast as any because we know that all resources have a resource name
            filters: {
                resourceName: [resourceName],
            },
        });
        if (results.length > 0) {
            return results[0];
        }
        throw new ResourceNotFoundError(`Resource ${resource} with resourceName ${resourceName} for cusomterId ${customerId} does not exist`);
    }
    getService(serviceName) {
        const constructor = services[serviceName];
        if (constructor.prototype instanceof $protobuf.rpc.Service) {
            const rpcServiceConstructor = constructor;
            const rpcImplementation = this.getRpcImpl(serviceName);
            return new rpcServiceConstructor(rpcImplementation);
        }
        throw new InvalidRPCServiceError(`Service with serviceName ${serviceName} does not support remote procedure calls`);
    }
    buildInterceptors() {
        const exceptionInterceptor = new error_parsing_interceptor_1.ExceptionInterceptor();
        const interceptors = [
            (options, nextCall) => exceptionInterceptor.intercept(options, nextCall),
        ];
        return interceptors;
    }
}
exports.GoogleAdsClient = GoogleAdsClient;
