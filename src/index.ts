import { google } from "../definitions/googleads";

export namespace GoogleAds {
  export import protobuf = google.protobuf;
  export import services = google.ads.googleads.v14.services;
  export import resources = google.ads.googleads.v14.resources;
  export import enums = google.ads.googleads.v14.enums;
  export import common = google.ads.googleads.v14.common;
  export import errors = google.ads.googleads.v14.errors;
}

export * from "./client";
export * from "./extract";
export * from "./mock-client";
