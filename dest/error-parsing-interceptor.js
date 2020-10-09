"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const grpc_1 = __importDefault(require("grpc"));
const google_proto_1 = require("../compiled/google-proto");
const FAILURE_KEY = 'google.ads.googleads.v5.errors.googleadsfailure-bin';
const RETRY_STATUS_CODES = [grpc_1.default.status.INTERNAL, grpc_1.default.status.RESOURCE_EXHAUSTED];
class ExceptionInterceptor {
    constructor() {
        this.requestInterceptor = this.buildRequester();
    }
    intercept(options, nextCall) {
        return new grpc_1.default.InterceptingCall(nextCall(options), this.requestInterceptor);
    }
    buildRequester() {
        return (new grpc_1.default.RequesterBuilder()
            // tslint:disable-next-line:ban-types
            .withStart((metadata, listener, next) => {
            const newListener = this.buildListener();
            next(metadata, newListener);
        })
            .build());
    }
    buildListener() {
        return (new grpc_1.default.ListenerBuilder()
            // tslint:disable-next-line:ban-types
            .withOnReceiveStatus((status, next) => {
            if (status.code !== grpc_1.default.status.OK) {
                // TODO: Throw this error instead of returning a new status?
                const error = this.handleGrpcFailure(status);
                const errorStatus = new grpc_1.default.StatusBuilder()
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
