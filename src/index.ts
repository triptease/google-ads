import { google } from '../compiled/google-proto';

export namespace GoogleAds {
  export import protobuf = google.protobuf;
  export import services = google.ads.googleads.v5.services;
  export import resources = google.ads.googleads.v5.resources;
  export import enums = google.ads.googleads.v5.enums;
  export import common = google.ads.googleads.v5.common;
}

export * from './client';
export * from './extract';
export * from './mock-client';
