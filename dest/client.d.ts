import { JWTOptions } from "google-auth-library";
import * as grpc from "@grpc/grpc-js";
import { google } from "../compiled/google-proto";
import { StatusObject } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
declare const services: typeof google.ads.googleads.v8.services;
declare type services = typeof services;
declare type serviceNames = keyof services;
declare const resources: typeof google.ads.googleads.v8.resources;
declare type resources = typeof resources;
declare type resourceNames = keyof resources;
export interface GoogleAdsClientOptions {
    authOptions: JWTOptions;
    developerToken: string;
    mccAccountId: string;
}
export declare class ResourceNotFoundError extends Error {
}
export declare class InvalidRPCServiceError extends Error {
}
export interface ClientSearchParams<R extends resourceNames> {
    customerId: string;
    resource: R;
    filters?: {
        [attr in keyof InstanceType<resources[R]>]?: string | number | string[] | number[];
    };
    orderBy?: keyof InstanceType<resources[R]>;
    orderByDirection?: "ASC" | "DESC";
    limit?: number;
}
export interface IGoogleAdsClient {
    getMccAccountId(): string;
    search<R extends resourceNames>(params: ClientSearchParams<R>): Promise<Array<InstanceType<resources[R]>>>;
    findOne<R extends resourceNames>(customerId: string, resource: R, resourceId: number): Promise<InstanceType<resources[R]>>;
    getService<T extends serviceNames>(serviceName: T): InstanceType<services[T]>;
}
export declare class GoogleAdsClient implements IGoogleAdsClient {
    private options;
    private auth;
    constructor(options: GoogleAdsClientOptions);
    getMccAccountId(): string;
    private getRpcImpl;
    private fieldsCache;
    private getFieldsForTable;
    private buildSearchSql;
    search<R extends resourceNames>(params: ClientSearchParams<R>): Promise<Array<InstanceType<resources[R]>>>;
    searchGenerator<R extends resourceNames>(params: ClientSearchParams<R>): AsyncIterable<InstanceType<resources[R]>>;
    findOne<R extends resourceNames>(customerId: string, resource: R, resourceId: number): Promise<InstanceType<resources[R]>>;
    getService<T extends serviceNames>(serviceName: T): InstanceType<services[T]>;
}
export declare class GaClientError extends Error implements StatusObject {
    firstError: google.ads.googleads.v8.errors.IErrorCode | null | undefined;
    code: Status;
    details: string;
    metadata: grpc.Metadata;
    constructor(status: grpc.ServiceError);
}
export {};
