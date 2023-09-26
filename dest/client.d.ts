import { JWTOptions } from "google-auth-library";
import * as grpc from "@grpc/grpc-js";
import { StatusObject } from "@grpc/grpc-js";
import { google } from "../definitions/googleads";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { ServiceClient } from "@grpc/grpc-js/build/src/make-client";
import { Logger } from "winston";
import { Statter } from "./statter";
declare const services: typeof google.ads.googleads.v14.services;
type services = typeof services;
type serviceNames = keyof services;
declare const resources: typeof google.ads.googleads.v14.resources;
type resources = typeof resources;
type resourceNames = keyof resources;
export interface Stoppable {
    stop(): void;
}
export interface IServiceCache {
    set<T extends serviceNames>(serviceName: T, service: InstanceType<services[T]>): void;
    get<T extends serviceNames>(serviceName: T): InstanceType<services[T]> | undefined;
    clear(): void;
}
export declare const createServiceCache: () => IServiceCache;
export interface GoogleAdsClientOptions {
    authOptions: JWTOptions;
    developerToken: string;
    mccAccountId: string;
    timeout?: number;
    clientPoolSize?: number;
    serviceCache?: IServiceCache;
    logger?: Logger;
    statter?: Statter;
}
export declare class ResourceNotFoundError extends Error {
}
export declare class InvalidRPCServiceError extends Error {
}
export interface ClientSearchParams<R extends resourceNames> {
    customerId: string;
    resource: R;
    filters?: {
        [attr in keyof InstanceType<resources[R]>]?: boolean | string | number | string[] | number[] | {
            raw: string;
        };
    };
    fields?: string[];
    orderBy?: keyof InstanceType<resources[R]>;
    orderByDirection?: "ASC" | "DESC";
    limit?: number;
    includeDrafts?: boolean;
}
export interface IGoogleAdsClient extends Stoppable {
    getMccAccountId(): string;
    search<R extends resourceNames>(params: ClientSearchParams<R>): Promise<Array<InstanceType<resources[R]>>>;
    findOne<R extends resourceNames>(customerId: string, resource: R, resourceId: number, fields?: string[]): Promise<InstanceType<resources[R]>>;
    getService<T extends serviceNames>(serviceName: T): InstanceType<services[T]>;
}
export interface ClientCreator {
    (channelCredentials: grpc.ChannelCredentials, callCredentials: grpc.CallCredentials, serviceConfig: string): ServiceClient;
}
/**
 * A very simple round-robin pool for gRPC clients. This is needed for meta since we run
 * a very large number of concurrent requests which try and multiplex over a single Channel
 * that gets overwhelmed and hangs. This provides a dumb mechanism to spread that load
 * across a pool of clients, who each manage a single Channel per scheme/host/port.
 */
export declare class ClientPool {
    private readonly size;
    private readonly pool;
    private currentIndex;
    constructor(authOptions: JWTOptions, size?: number, clientCreator?: ClientCreator);
    getClient(): ServiceClient;
}
export declare class GoogleAdsClient implements IGoogleAdsClient {
    private readonly options;
    private readonly serviceCache;
    private longRunningOps;
    private readonly metadata;
    private readonly clientPool;
    private readonly statter;
    constructor(options: GoogleAdsClientOptions);
    getMccAccountId(): string;
    private getRpcImpl;
    private fieldsCache;
    private getFieldsForTable;
    private buildSearchSql;
    search<R extends resourceNames>(params: ClientSearchParams<R>): Promise<Array<InstanceType<resources[R]>>>;
    searchGenerator<R extends resourceNames>(params: ClientSearchParams<R>): AsyncIterable<InstanceType<resources[R]>>;
    stop(): void;
    findOne<R extends resourceNames>(customerId: string, resource: R, resourceId: number, fields?: string[], includeDrafts?: boolean): Promise<InstanceType<resources[R]>>;
    getService<T extends serviceNames>(serviceName: T): InstanceType<services[T]>;
    getLongRunningOperationsService(): google.longrunning.Operations;
}
export declare class GaClientError extends Error implements StatusObject {
    firstError: google.ads.googleads.v14.errors.IErrorCode | null | undefined;
    code: Status;
    details: string;
    metadata: grpc.Metadata;
    constructor(status: grpc.ServiceError);
}
export {};
