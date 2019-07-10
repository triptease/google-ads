"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const grpc_1 = __importDefault(require("grpc"));
const google_proto_1 = require("../compiled/google-proto");
const FAILURE_KEY = "google.ads.googleads.v2.errors.googleadsfailure-bin";
const REQUEST_ID_KEY = "request-id";
const RETRY_STATUS_CODES = [grpc_1.default.status.INTERNAL, grpc_1.default.status.RESOURCE_EXHAUSTED];
function getErrorLocationPath(location) {
    if (!location || !location.hasOwnProperty("fieldPathElementsList")) {
        return "";
    }
    if (!Array.isArray(location.fieldPathElementsList) && location.fieldPathElementsList.length < 1) {
        return "";
    }
    const { fieldPathElementsList } = location;
    const paths = fieldPathElementsList.map((field) => {
        let path = field.fieldName;
        if (field.index && field.index.hasOwnProperty("value")) {
            path += `[${field.index.value}]`;
        }
        return path;
    });
    return paths.join(".");
}
class ExceptionInterceptor {
    constructor() {
        this.requestInterceptor = this.buildRequester();
    }
    intercept(options, nextCall) {
        return new grpc_1.default.InterceptingCall(nextCall(options), this.requestInterceptor);
    }
    buildRequester() {
        return new grpc_1.default.RequesterBuilder()
            .withStart((metadata, _listener, next) => {
            const newListener = this.buildListener();
            next(metadata, newListener);
        })
            .build();
    }
    buildListener() {
        return new grpc_1.default.ListenerBuilder()
            .withOnReceiveStatus((status, next) => {
            if (status.code !== grpc_1.default.status.OK) {
                // TODO: Throw this error instead of returning a new status?
                const error = this.handleGrpcFailure(status);
                if (error.hasOwnProperty("error_code")) {
                    // @ts-ignore Custom error field "error_code"
                    status.metadata.add("error-code", JSON.stringify(error.error_code));
                }
                if (error.hasOwnProperty("location")) {
                    // @ts-ignore Custom error field "location"
                    status.metadata.add("location", error.location);
                }
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
            .build();
    }
    getGoogleAdsFailure(metadata) {
        if (!metadata) {
            return null;
        }
        for (const key in metadata.getMap()) {
            if (key === FAILURE_KEY) {
                const message = metadata.get(key);
                try {
                    const failure = google_proto_1.google.ads.googleads.v2.errors.GoogleAdsFailure.decode(message[0]);
                    return failure;
                }
                catch (err) {
                    return null;
                }
            }
        }
        return null;
    }
    getRequestId(metadata) {
        if (metadata.get(REQUEST_ID_KEY)) {
            return metadata.get(REQUEST_ID_KEY)[0];
        }
        return "";
    }
    handleGrpcFailure(status) {
        const { code, metadata } = status;
        if (RETRY_STATUS_CODES.includes(code)) {
            /* Throw error if code one of INTERNAL or RESOURCE_EXHAUSTED */
            return new Error(status.details);
        }
        const gaFailure = this.getGoogleAdsFailure(metadata);
        if (!gaFailure) {
            /* Throw error with status details if not a Google Ads API error */
            return new Error(status.details);
        }
        const requestId = this.getRequestId(metadata);
        let error;
        const errorsList = gaFailure.errors;
        if (errorsList && errorsList.length > 0) {
            const firstError = errorsList[0];
            const firstErrorObj = firstError;
            let path = "";
            if (firstErrorObj.hasOwnProperty("location")) {
                path = getErrorLocationPath(firstErrorObj.location);
            }
            return new ClientError(firstErrorObj.message, requestId, gaFailure, path);
        }
        try {
            /* Try to parse the error */
            const errorPieces = gaFailure.toString().split(",");
            const errorMessage = errorPieces[errorPieces.length - 1];
            error = new ClientError(errorMessage, requestId, gaFailure);
        }
        catch (err) {
            /* Use the original error message if parsing fails */
            error = new ClientError(status.details, requestId, gaFailure);
        }
        return error;
    }
}
exports.ExceptionInterceptor = ExceptionInterceptor;
class ClientError extends Error {
    constructor(message, requestId, failure, path) {
        super(message);
        this.message = message;
        this.location = path || "";
        this.request_id = requestId;
        this.failure = failure;
        if (failure.errors && failure.errors.length > 0) {
            const errorCode = failure.errors[0].errorCode;
            this.error_code = errorCode;
        }
        else {
            this.error_code = {};
        }
    }
}
