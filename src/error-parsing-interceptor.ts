import grpc from 'grpc';

import { google } from '../compiled/google-proto';

const FAILURE_KEY = 'google.ads.googleads.v5.errors.googleadsfailure-bin';
const RETRY_STATUS_CODES = [grpc.status.INTERNAL, grpc.status.RESOURCE_EXHAUSTED];

type NextCall = (options: grpc.CallOptions) => grpc.InterceptingCall | null;
export type InterceptorMethod = (options: grpc.CallOptions, nextCall: NextCall) => any;

export class ExceptionInterceptor {
  private requestInterceptor: grpc.Requester;

  constructor() {
    this.requestInterceptor = this.buildRequester();
  }

  public intercept(options: grpc.CallOptions, nextCall: NextCall): grpc.InterceptingCall {
    return new grpc.InterceptingCall(nextCall(options), this.requestInterceptor);
  }

  private buildRequester(): grpc.Requester {
    return (
      new grpc.RequesterBuilder()
        // tslint:disable-next-line:ban-types
        .withStart((metadata: grpc.Metadata, listener: grpc.Listener, next: Function) => {
          const newListener = this.buildListener();
          next(metadata, newListener);
        })
        .build()
    );
  }

  private buildListener(): grpc.Listener {
    return (
      new grpc.ListenerBuilder()
        // tslint:disable-next-line:ban-types
        .withOnReceiveStatus((status: grpc.StatusObject, next: Function) => {
          if (status.code !== grpc.status.OK) {
            // TODO: Throw this error instead of returning a new status?
            const error = this.handleGrpcFailure(status);

            const errorStatus = new grpc.StatusBuilder()
              .withCode(status.code)
              .withDetails(error.message)
              .withMetadata(status.metadata)
              .build();

            next(errorStatus);
          } else {
            next(status);
          }
        })
        .build()
    );
  }

  private handleGrpcFailure(status: grpc.StatusObject): Error {
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

function parseGoogleAdsErrorFromMetadata(
  metadata: grpc.Metadata | undefined
): google.ads.googleads.v5.errors.GoogleAdsFailure[] {
  if (!metadata) {
    return [];
  }

  const failureArray = metadata.get(FAILURE_KEY);

  return failureArray.map(bytes => google.ads.googleads.v5.errors.GoogleAdsFailure.decode(bytes as any));
}

export class GaClientError extends Error {
  constructor(readonly failures: google.ads.googleads.v5.errors.GoogleAdsFailure[]) {
    super(JSON.stringify(failures, null, 2));
  }
}
