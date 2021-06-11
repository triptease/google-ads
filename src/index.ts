import { google } from "../compiled/google-proto";

export namespace GoogleAds {
  export import protobuf = google.protobuf;
  export import services = google.ads.googleads.v8.services;
  export import resources = google.ads.googleads.v8.resources;
  export import enums = google.ads.googleads.v8.enums;
  export import common = google.ads.googleads.v8.common;
  export import errors = google.ads.googleads.v8.errors;
}

export * from "./client";
export * from "./extract";
export * from "./mock-client";
