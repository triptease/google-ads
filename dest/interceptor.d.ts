import grpc from "grpc";
declare type NextCall = (options: grpc.CallOptions) => grpc.InterceptingCall | null;
export declare type InterceptorMethod = (options: grpc.CallOptions, nextCall: NextCall) => any;
export declare class ExceptionInterceptor {
    private requestInterceptor;
    constructor();
    intercept(options: grpc.CallOptions, nextCall: NextCall): grpc.InterceptingCall;
    private buildRequester;
    private buildListener;
    private getGoogleAdsFailure;
    private getRequestId;
    private handleGrpcFailure;
}
export {};
