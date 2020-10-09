import grpc from 'grpc';
import { google } from '../compiled/google-proto';
declare type NextCall = (options: grpc.CallOptions) => grpc.InterceptingCall | null;
export declare type InterceptorMethod = (options: grpc.CallOptions, nextCall: NextCall) => any;
export declare class ExceptionInterceptor {
    private requestInterceptor;
    constructor();
    intercept(options: grpc.CallOptions, nextCall: NextCall): grpc.InterceptingCall;
    private buildRequester;
    private buildListener;
    private handleGrpcFailure;
}
export declare class GaClientError extends Error {
    readonly failures: google.ads.googleads.v5.errors.GoogleAdsFailure[];
    constructor(failures: google.ads.googleads.v5.errors.GoogleAdsFailure[]);
}
export {};
