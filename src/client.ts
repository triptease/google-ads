import { JWT, JWTOptions, OAuth2Client } from "google-auth-library";
import * as grpc from "@grpc/grpc-js";
import { camelCase, snakeCase } from "lodash";
import * as $protobuf from "protobufjs";

import { google } from "../compiled/google-proto";
import { extract } from "./extract";
import { StatusObject } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";

const GOOGLE_ADS_ENDPOINT = "googleads.googleapis.com:443";
const GOOGLE_ADS_VERSION = "v8";

const services = google.ads.googleads.v8.services;
type services = typeof services;
type serviceNames = keyof services;

const resources = google.ads.googleads.v8.resources;
type resources = typeof resources;
type resourceNames = keyof resources;

const Client = grpc.makeGenericClientConstructor({}, "", {});

export interface GoogleAdsClientOptions {
  authOptions: JWTOptions;
  developerToken: string;
  mccAccountId: string;
}

export class ResourceNotFoundError extends Error {}
export class InvalidRPCServiceError extends Error {}

export interface ClientSearchParams<R extends resourceNames> {
  customerId: string;
  resource: R;
  filters?: {
    [attr in keyof InstanceType<resources[R]>]?:
      | string
      | number
      | string[]
      | number[]
      | { raw: string };
  };
  orderBy?: keyof InstanceType<resources[R]>;
  orderByDirection?: "ASC" | "DESC";
  limit?: number;
}

export interface IGoogleAdsClient {
  getMccAccountId(): string;
  search<R extends resourceNames>(
    params: ClientSearchParams<R>
  ): Promise<Array<InstanceType<resources[R]>>>;
  findOne<R extends resourceNames>(
    customerId: string,
    resource: R,
    resourceId: number
  ): Promise<InstanceType<resources[R]>>;
  getService<T extends serviceNames>(serviceName: T): InstanceType<services[T]>;
}

export class GoogleAdsClient implements IGoogleAdsClient {
  private auth: OAuth2Client;

  constructor(private options: GoogleAdsClientOptions) {
    this.auth = new JWT(this.options.authOptions);
  }

  public getMccAccountId(): string {
    return this.options.mccAccountId;
  }

  private getRpcImpl(serviceName: serviceNames): $protobuf.RPCImpl {
    const sslCreds = grpc.credentials.createSsl();
    const googleCreds = grpc.credentials.createFromGoogleCredential(this.auth);

    const client = new Client(
      GOOGLE_ADS_ENDPOINT,
      grpc.credentials.combineChannelCredentials(sslCreds, googleCreds)
    );

    const metadata = new grpc.Metadata();
    metadata.add("developer-token", this.options.developerToken);
    metadata.add("login-customer-id", this.options.mccAccountId);

    return function (method, requestData, callback) {
      client.makeUnaryRequest(
        `/google.ads.googleads.${GOOGLE_ADS_VERSION}.services.${serviceName}/` +
          method.name,
        (value: Uint8Array) => Buffer.from(value),
        (value: Buffer) => value,
        requestData,
        metadata,
        {},
        function (err, value) {
          if (isServiceError(err)) {
            err = new GaClientError(err);
          }
          callback(err, value);
        }
      );
    };
  }

  private fieldsCache:
    | undefined
    | Array<extract<google.ads.googleads.v8.resources.IGoogleAdsField, "name">>;
  private async getFieldsForTable(tableName: string) {
    if (!this.fieldsCache) {
      const fieldQueryService = await this.getService("GoogleAdsFieldService");
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
        | string
        | number
        | string[]
        | number[]
        | undefined
        | { raw: string };
    } = {},
    orderBy: string | undefined,
    orderByDirection: "ASC" | "DESC" = "ASC",
    limit: number | undefined
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

        const quotedFilters = filterValues.map(
          (filterValue) => `"${filterValue}"`
        );
        const filterStatement = `${tableName}.${snakeCase(
          filterName
        )} in (${quotedFilters.join(",")})`;
        wheres.push(filterStatement);
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
    ]
      .filter((seg) => !!seg)
      .join(" ");
  }

  public async search<R extends resourceNames>(
    params: ClientSearchParams<R>
  ): Promise<Array<InstanceType<resources[R]>>> {
    const results = [];
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
    const fields = await this.getFieldsForTable(tableName);
    const queryService = await this.getService("GoogleAdsService");
    let token: string | null = null;

    do {
      const request = {
        customerId: params.customerId,
        query: this.buildSearchSql(
          tableName,
          fields,
          params.filters,
          params.orderBy ? snakeCase(params.orderBy as string) : undefined,
          params.orderByDirection,
          params.limit
        ),
        pageToken: token,
        pageSize: 1000,
      };
      const result = await queryService.search(request);

      token = result.nextPageToken as string;

      for (const field of result.results) {
        yield (field as any)[objName];
      }
    } while (token);
    return;
  }

  public async findOne<R extends resourceNames>(
    customerId: string,
    resource: R,
    resourceId: number
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
    });

    if (results.length > 0) {
      return results[0];
    }

    throw new ResourceNotFoundError(
      `Resource ${resource} with resourceName ${resourceName} for cusomterId ${customerId} does not exist`
    );
  }

  public getService<T extends serviceNames>(
    serviceName: T
  ): InstanceType<services[T]> {
    const constructor = services[serviceName];

    if (constructor.prototype instanceof $protobuf.rpc.Service) {
      const rpcServiceConstructor = constructor as typeof $protobuf.rpc.Service;
      const rpcImplementation = this.getRpcImpl(serviceName);
      return new rpcServiceConstructor(rpcImplementation) as InstanceType<
        services[T]
      >;
    }

    throw new InvalidRPCServiceError(
      `Service with serviceName ${serviceName} does not support remote procedure calls`
    );
  }
}

export class GaClientError extends Error implements StatusObject {
  firstError: google.ads.googleads.v8.errors.IErrorCode | null | undefined;
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
): google.ads.googleads.v8.errors.GoogleAdsFailure[] {
  if (!metadata) {
    return [];
  }

  const failureArray = metadata.get(FAILURE_KEY);

  return failureArray.map((bytes) =>
    google.ads.googleads.v8.errors.GoogleAdsFailure.decode(bytes as any)
  );
}

function isServiceError(err: any): err is grpc.ServiceError {
  return err && err.code && err.details && err.metadata;
}

function isRawFilterObject(obj: any): obj is { raw: string } {
  return obj.hasOwnProperty("raw");
}
