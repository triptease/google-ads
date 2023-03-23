import { google } from "../compiled/google-proto";

export namespace GoogleAds {
  export import protobuf = google.protobuf;
  export import services = google.ads.googleads.v12.services;
  export import resources = google.ads.googleads.v12.resources;
  export import enums = google.ads.googleads.v12.enums;
  export import common = google.ads.googleads.v12.common;
  export import errors = google.ads.googleads.v12.errors;
}

export * from "./client";
export * from "./extract";
export * from "./mock-client";
