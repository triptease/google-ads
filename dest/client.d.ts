import { JWTOptions } from "google-auth-library";
import * as grpc from "@grpc/grpc-js";
import { StatusObject } from "@grpc/grpc-js";
import { google } from "../definitions/googleads";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { ServiceClient } from "@grpc/grpc-js/build/src/make-client";
import { Logger } from "winston";
import { Statter } from "./statter";
declare const adsServices: typeof google.ads.googleads.v14.services;
declare const longrunningServices: typeof google.longrunning;
type Services = typeof adsServices & typeof longrunningServices;
export type ServiceNames = keyof Services;
declare const resources: typeof google.ads.googleads.v14.resources;
type Resources = typeof resources;
type ResourceNames = keyof Resources;
export interface Stoppable {
    stop(): void;
}
export interface IServiceCache {
    set<T extends ServiceNames>(serviceName: T, service: InstanceType<Services[T]>): void;
    get<T extends ServiceNames>(serviceName: T): InstanceType<Services[T]> | undefined;
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
export interface ClientSearchParams<R extends ResourceNames> {
    customerId: string;
    resource: R;
    filters?: {
        [attr in keyof InstanceType<Resources[R]>]?: boolean | string | number | string[] | number[] | {
            raw: string;
        };
    };
    fields?: string[];
    orderBy?: keyof InstanceType<Resources[R]>;
    orderByDirection?: "ASC" | "DESC";
    limit?: number;
    includeDrafts?: boolean;
}
export interface IGoogleAdsClient extends Stoppable {
    getMccAccountId(): string;
    search<R extends ResourceNames>(params: ClientSearchParams<R>): Promise<Array<InstanceType<Resources[R]>>>;
    findOne<R extends ResourceNames>(customerId: string, resource: R, resourceId: number, fields?: string[]): Promise<InstanceType<Resources[R]>>;
    getService<T extends ServiceNames>(serviceName: T): InstanceType<Services[T]>;
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
    private readonly metadata;
    private readonly clientPool;
    private readonly statter;
    constructor(options: GoogleAdsClientOptions);
    getMccAccountId(): string;
    private getRpcImpl;
    private fieldsCache;
    private getFieldsForTable;
    private buildSearchSql;
    search<R extends ResourceNames>(params: ClientSearchParams<R>): Promise<Array<InstanceType<Resources[R]>>>;
    searchGenerator<R extends ResourceNames>(params: ClientSearchParams<R>): AsyncIterable<InstanceType<Resources[R]>>;
    stop(): void;
    findOne<R extends ResourceNames>(customerId: string, resource: R, resourceId: number, fields?: string[], includeDrafts?: boolean): Promise<InstanceType<Resources[R]>>;
    getService<T extends ServiceNames>(serviceName: T): InstanceType<Services[T]>;
}
export declare class GaClientError extends Error implements StatusObject {
    firstError: google.ads.googleads.v14.errors.IErrorCode | null | undefined;
    code: Status;
    details: string;
    metadata: grpc.Metadata;
    constructor(status: grpc.ServiceError);
}
export {};
