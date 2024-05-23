import { google } from "../definitions/googleads";

export namespace GoogleAds {
  export import protobuf = google.protobuf;
  export import longrunning = google.longrunning;
  export import services = google.ads.googleads.v15.services;
  export import resources = google.ads.googleads.v15.resources;
  export import enums = google.ads.googleads.v15.enums;
  export import common = google.ads.googleads.v15.common;
  export import errors = google.ads.googleads.v15.errors;
}

export * from "./client";
export * from "./extract";
export * from "./mock-client";
