import { google } from "../compiled/google-proto";

export namespace GoogleAds {
  export import protobuf = google.protobuf;
  export import services = google.ads.googleads.v11.services;
  export import resources = google.ads.googleads.v11.resources;
  export import enums = google.ads.googleads.v11.enums;
  export import common = google.ads.googleads.v11.common;
  export import errors = google.ads.googleads.v11.errors;
}

export * from "./client";
export * from "./extract";
export * from "./mock-client";
