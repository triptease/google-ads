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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GaClientError = exports.ExceptionInterceptor = void 0;
const grpc = __importStar(require("@grpc/grpc-js"));
const google_proto_1 = require("../compiled/google-proto");
const FAILURE_KEY = 'google.ads.googleads.v5.errors.googleadsfailure-bin';
const RETRY_STATUS_CODES = [grpc.status.INTERNAL, grpc.status.RESOURCE_EXHAUSTED];
class ExceptionInterceptor {
    constructor() {
        this.requestInterceptor = this.buildRequester();
    }
    intercept(options, nextCall) {
        return new grpc.InterceptingCall(nextCall(options), this.requestInterceptor);
    }
    buildRequester() {
        return (new grpc.RequesterBuilder()
            // tslint:disable-next-line:ban-types
            .withStart((metadata, listener, next) => {
            const newListener = this.buildListener();
            next(metadata, newListener);
        })
            .build());
    }
    buildListener() {
        return (new grpc.ListenerBuilder()
            // tslint:disable-next-line:ban-types
            .withOnReceiveStatus((status, next) => {
            if (status.code !== grpc.status.OK) {
                // TODO: Throw this error instead of returning a new status?
                const error = this.handleGrpcFailure(status);
                const errorStatus = new grpc.StatusBuilder()
                    .withCode(status.code)
                    .withDetails(error.message)
                    .withMetadata(status.metadata)
                    .build();
                next(errorStatus);
            }
            else {
                next(status);
            }
        })
            .build());
    }
    handleGrpcFailure(status) {
        const { code, metadata } = status;
        if (RETRY_STATUS_CODES.includes(code)) {
            /* Throw error if code one of INTERNAL or RESOURCE_EXHAUSTED */
            return new Error(status.details);
        }
        const gaFailures = parseGoogleAdsErrorFromMetadata(metadata);
        if (gaFailures.length === 0) {
            /* Throw error with status details if not a Google Ads API error */
            return new Error(status.details);
        }
        return new GaClientError(gaFailures);
    }
}
exports.ExceptionInterceptor = ExceptionInterceptor;
function parseGoogleAdsErrorFromMetadata(metadata) {
    if (!metadata) {
        return [];
    }
    const failureArray = metadata.get(FAILURE_KEY);
    return failureArray.map(bytes => google_proto_1.google.ads.googleads.v5.errors.GoogleAdsFailure.decode(bytes));
}
class GaClientError extends Error {
    constructor(failures) {
        super(JSON.stringify(failures, null, 2));
        this.failures = failures;
    }
}
exports.GaClientError = GaClientError;
