import SqlString from "sqlstring";
import { JWT, JWTOptions } from "google-auth-library";
import * as grpc from "@grpc/grpc-js";
import { ClientUnaryCall, StatusObject } from "@grpc/grpc-js";
import { camelCase, snakeCase } from "lodash";
import * as $protobuf from "protobufjs";
import { rpc } from "protobufjs";
import { google } from "../compiled/google-proto";
import { extract } from "./extract";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { ServiceClient } from "@grpc/grpc-js/build/src/make-client";
import { Logger } from "winston";
import { NoOpStatter, Statter } from "./statter";

const GOOGLE_ADS_ENDPOINT = "googleads.googleapis.com:443";
const GOOGLE_ADS_VERSION = "v12";

const services = google.ads.googleads.v12.services;
type services = typeof services;
type serviceNames = keyof services;

const resources = google.ads.googleads.v12.resources;
type resources = typeof resources;
type resourceNames = keyof resources;

const Client = grpc.makeGenericClientConstructor({}, "", {});

export interface Stoppable {
  stop(): void;
}

export interface IServiceCache {
  set<T extends serviceNames>(
    serviceName: T,
    service: InstanceType<services[T]>
  ): void;
  get<T extends serviceNames>(
    serviceName: T
  ): InstanceType<services[T]> | undefined;
  clear(): void;
}

export const createServiceCache = (): IServiceCache => {
  const serviceCache: ServiceCache = {};

  return {
    get: (serviceName) => {
      if (serviceCache[serviceName]) {
        return serviceCache[serviceName] as InstanceType<
          services[typeof serviceName]
        >;
      }
    },
    set: (serviceName, service) => {
      serviceCache[serviceName] = service as ServiceCache[typeof serviceName];
    },
    clear: () => {
      for (const serviceName of Object.keys(
        serviceCache
      ) as (keyof services)[]) {
        (serviceCache[serviceName] as rpc.Service).end();
        delete serviceCache[serviceName];
      }
    },
  };
};

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

export class ResourceNotFoundError extends Error {}
export class InvalidRPCServiceError extends Error {}

export interface ClientSearchParams<R extends resourceNames> {
  customerId: string;
  resource: R;
  filters?: {
    [attr in keyof InstanceType<resources[R]>]?:
      | boolean
      | string
      | number
      | string[]
      | number[]
      | { raw: string };
  };
  fields?: string[];
  orderBy?: keyof InstanceType<resources[R]>;
  orderByDirection?: "ASC" | "DESC";
  limit?: number;
  includeDrafts?: boolean;
}

export interface IGoogleAdsClient extends Stoppable {
  getMccAccountId(): string;
  search<R extends resourceNames>(
    params: ClientSearchParams<R>
  ): Promise<Array<InstanceType<resources[R]>>>;
  findOne<R extends resourceNames>(
    customerId: string,
    resource: R,
    resourceId: number,
    fields?: string[]
  ): Promise<InstanceType<resources[R]>>;
  getService<T extends serviceNames>(serviceName: T): InstanceType<services[T]>;
}

type ServiceCache = Partial<{ [K in serviceNames]: InstanceType<services[K]> }>;

export interface ClientCreator {
  (
    channelCredentials: grpc.ChannelCredentials,
    callCredentials: grpc.CallCredentials,
    serviceConfig: string
  ): ServiceClient;
}

const defaultClientCreator: ClientCreator = (
  channelCredentials: grpc.ChannelCredentials,
  callCredentials: grpc.CallCredentials,
  serviceConfig: string
) =>
  new Client(
    GOOGLE_ADS_ENDPOINT,
    grpc.credentials.combineChannelCredentials(
      channelCredentials,
      callCredentials
    ),
    { "grpc.service_config": serviceConfig, "grpc.enable_channelz": 0 }
  );

/**
 * A very simple round-robin pool for gRPC clients. This is needed for meta since we run
 * a very large number of concurrent requests which try and multiplex over a single Channel
 * that gets overwhelmed and hangs. This provides a dumb mechanism to spread that load
 * across a pool of clients, who each manage a single Channel per scheme/host/port.
 */
export class ClientPool {
  private readonly pool: ServiceClient[] = [];
  private currentIndex = 0;

  constructor(
    authOptions: JWTOptions,
    private readonly size: number = 1,
    clientCreator: ClientCreator = defaultClientCreator
  ) {
    if (size <= 0) throw new Error("Client pool size must be bigger than 0");

    const channelCredentials = grpc.credentials.createSsl();
    const serviceConfig = JSON.stringify({
      loadBalancingConfig: [{ round_robin: {} }],
    });

    for (let i = 0; i < size; i++) {
      // Creating a new Google auth object for each client (should) force them not to share channels
      const auth = new JWT(authOptions);
      const callCredentials = grpc.credentials.createFromGoogleCredential(auth);

      const client = clientCreator(
        channelCredentials,
        callCredentials,
        serviceConfig
      );

      this.pool.push(client);
    }
  }

  public getClient(): ServiceClient {
    if (this.currentIndex === this.size) {
      this.currentIndex = 0;
    }
    return this.pool[this.currentIndex++];
  }
}

export class GoogleAdsClient implements IGoogleAdsClient {
  private readonly options: GoogleAdsClientOptions;
  // Service creation leaks memory, so services are cached and re-used.
  private readonly serviceCache: IServiceCache;
  private longRunningOps: google.longrunning.Operations | null;
  private readonly metadata: grpc.Metadata;
  private readonly clientPool: ClientPool;
  private readonly statter: Statter;

  constructor(options: GoogleAdsClientOptions) {
    this.options = options;

    this.metadata = new grpc.Metadata();
    this.metadata.add("developer-token", this.options.developerToken);
    this.metadata.add("login-customer-id", this.options.mccAccountId);

    this.clientPool = new ClientPool(
      this.options.authOptions,
      this.options.clientPoolSize
    );

    this.serviceCache = this.options.serviceCache ?? createServiceCache();
    this.longRunningOps = null;
    this.statter = options.statter ?? new NoOpStatter();
  }

  public getMccAccountId(): string {
    return this.options.mccAccountId;
  }

  private getRpcImpl(
    serviceName: serviceNames | "Operations"
  ): $protobuf.RPCImpl {
    const timeout = this.options?.timeout;
    let call: ClientUnaryCall | undefined;

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

      const methodName =
        serviceName !== "Operations"
          ? `/google.ads.googleads.${GOOGLE_ADS_VERSION}.services.${serviceName}/${method.name}`
          : `/google.longrunning.Operations/${method.name}`;

      call = client.makeUnaryRequest(
        methodName,
        (value: Uint8Array) => Buffer.from(value),
        (value: Buffer) => value,
        requestData,
        this.metadata,
        {
          deadline: timeout ? Date.now() + timeout : undefined,
        },
        function (err, value) {
          call = undefined;
          if (isServiceError(err)) {
            thisStatter.increment("google_ads_grpc", 1, [
              `version:${GOOGLE_ADS_VERSION}`,
              `outcome:error`,
              `service:${serviceName}`,
              `method:${method.name}`,
            ]);

            err = new GaClientError(err);
          } else {
            thisStatter.increment("google_ads_grpc", 1, [
              `version:${GOOGLE_ADS_VERSION}`,
              `outcome:success`,
              `service:${serviceName}`,
              `method:${method.name}`,
            ]);
          }
          callback(err, value);
        }
      );
      return call;
    };
  }

  private fieldsCache:
    | undefined
    | Array<
        extract<google.ads.googleads.v12.resources.IGoogleAdsField, "name">
      >;
  private async getFieldsForTable(tableName: string) {
    if (!this.fieldsCache) {
      const fieldQueryService = this.getService("GoogleAdsFieldService");
      const response = await fieldQueryService.searchGoogleAdsFields({
        query: `SELECT name, selectable, category`,
      });

      this.fieldsCache = response.results
        .map((field) => extract(field, ["name"]))
        .filter((field) => field.selectable === true)
        .filter(
          (field) =>
            // Selecting this field will break the google ads api always remove it
            field.name !==
            "campaign_criterion.keyword_theme.free_form_keyword_theme"
        );
    }

    return this.fieldsCache.filter((f) => f.name.startsWith(`${tableName}.`));
  }

  private buildSearchSql(
    tableName: string,
    fields: Array<{ name: string }>,
    filters: {
      [col: string]:
        | boolean
        | string
        | number
        | string[]
        | number[]
        | undefined
        | { raw: string };
    } = {},
    orderBy: string | undefined,
    orderByDirection: "ASC" | "DESC" = "ASC",
    limit: number | undefined,
    includeDrafts: boolean
  ) {
    const fieldSql = fields.map((f) => f.name).join(", ");

    const wheres: string[] = [];

    // tslint:disable-next-line:forin
    for (const filterName in filters) {
      const filterValue = filters[filterName];
      if (!filterValue) {
        continue;
      }

      if (isRawFilterObject(filterValue)) {
        wheres.push(`${tableName}.${snakeCase(filterName)} ${filterValue.raw}`);
      } else {
        const filterValues = Array.isArray(filterValue)
          ? filterValue
          : [filterValue];

        const quotedFilters = filterValues.map((filterValue) =>
          SqlString.escape(filterValue)
        );
        const tableFieldName = `${tableName}.${snakeCase(filterName)}`;

        const conditional =
          quotedFilters.length === 1
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
      `${
        orderBy ? `ORDER BY ${tableName}.${orderBy} ${orderByDirection}` : ""
      }`,
      `${limit ? `LIMIT ${limit}` : ""}`,
      `${includeDrafts ? `PARAMETERS include_drafts = true` : ""}`
    ]
      .filter((seg) => !!seg)
      .join(" ");
  }

  public async search<R extends resourceNames>(
    params: ClientSearchParams<R>
  ): Promise<Array<InstanceType<resources[R]>>> {
    const results: Array<InstanceType<resources[R]>> = [];
    for await (const x of this.searchGenerator(params)) {
      results.push(x);
    }

    return results;
  }

  public async *searchGenerator<R extends resourceNames>(
    params: ClientSearchParams<R>
  ): AsyncIterable<InstanceType<resources[R]>> {
    const tableName = snakeCase(params.resource);
    const objName = camelCase(params.resource);
    const fields = params.fields?.length
      ? params.fields.map((f) => ({ name: f }))
      : await this.getFieldsForTable(tableName);
    const googleAdsService = this.getService("GoogleAdsService");
    let token: string | null = null;

    do {
      const query = this.buildSearchSql(
        tableName,
        fields,
        params.filters,
        params.orderBy ? snakeCase(params.orderBy as string) : undefined,
        params.orderByDirection,
        params.limit,
        params.includeDrafts || false
      );

      const request = {
        customerId: params.customerId,
        query,
        pageToken: token,
        pageSize: 1000,
      };

      let result: google.ads.googleads.v12.services.SearchGoogleAdsResponse;
      try {
        result = await googleAdsService.search(request);
      } catch (error) {
        this.options.logger?.error("Error occurred during search", {
          request,
          error,
        });
        throw error;
      }

      token = result.nextPageToken as string;

      for (const field of result.results) {
        yield (field as any)[objName];
      }
    } while (token);
    return;
  }

  public stop(): void {
    return this.serviceCache.clear();
  }

  public async findOne<R extends resourceNames>(
    customerId: string,
    resource: R,
    resourceId: number,
    fields?: string[],
    includeDrafts?: boolean,
  ): Promise<InstanceType<resources[R]>> {
    const resourceName = `customers/${customerId}/${camelCase(
      resource
    )}s/${resourceId}`;
    const results = await this.search({
      customerId,
      resource,
      // cast as any because we know that all resources have a resource name
      filters: {
        resourceName: [resourceName],
      } as any,
      fields,
      includeDrafts
    });

    if (results.length > 0) {
      return results[0];
    }

    throw new ResourceNotFoundError(
      `Resource ${resource} with resourceName ${resourceName} for customerId ${customerId} does not exist`
    );
  }

  public getService<T extends serviceNames>(
    serviceName: T
  ): InstanceType<services[T]> {
    const cachedService = this.serviceCache.get(serviceName);

    if (cachedService) {
      return cachedService;
    }

    const rpcServiceConstructor = services[serviceName];

    if (!(rpcServiceConstructor.prototype instanceof rpc.Service)) {
      throw new InvalidRPCServiceError(
        `Service with serviceName ${serviceName} does not support remote procedure calls`
      );
    }

    const rpcImplementation = this.getRpcImpl(serviceName);
    const service = new rpcServiceConstructor(rpcImplementation);

    this.serviceCache.set(serviceName, service as InstanceType<services[T]>);
    return service as InstanceType<services[T]>;
  }

  public getLongRunningOperationsService(): google.longrunning.Operations {
    if (this.longRunningOps === null) {
      this.longRunningOps = new google.longrunning.Operations(
        this.getRpcImpl("Operations")
      );
    }

    return this.longRunningOps;
  }
}

export class GaClientError extends Error implements StatusObject {
  firstError: google.ads.googleads.v12.errors.IErrorCode | null | undefined;
  code: Status;
  details: string;
  metadata: grpc.Metadata;

  constructor(status: grpc.ServiceError) {
    const failures = parseGoogleAdsErrorFromMetadata(status.metadata);
    const failureObj = failures.length > 0 ? failures : status.details;

    super(JSON.stringify(failureObj, null, 2));
    this.details = this.message;

    this.code = status.code;
    this.metadata = status.metadata;

    this.firstError = failures[0]?.errors[0]?.errorCode;
  }
}

const FAILURE_KEY = `google.ads.googleads.${GOOGLE_ADS_VERSION}.errors.googleadsfailure-bin`;

function parseGoogleAdsErrorFromMetadata(
  metadata: grpc.Metadata | undefined
): google.ads.googleads.v12.errors.GoogleAdsFailure[] {
  if (!metadata) {
    return [];
  }

  const failureArray = metadata.get(FAILURE_KEY);

  return failureArray.map((bytes) =>
    google.ads.googleads.v12.errors.GoogleAdsFailure.decode(bytes as any)
  );
}

function isServiceError(err: any): err is grpc.ServiceError {
  return err && err.code && err.details && err.metadata;
}

function isRawFilterObject(obj: any): obj is { raw: string } {
  return obj.hasOwnProperty("raw");
}
