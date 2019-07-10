"use strict";
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
const google_proto_1 = require("../compiled/google-proto");
var GoogleAds;
(function (GoogleAds) {
    GoogleAds.protobuf = google_proto_1.google.protobuf;
    GoogleAds.services = google_proto_1.google.ads.googleads.v2.services;
    GoogleAds.resources = google_proto_1.google.ads.googleads.v2.resources;
    GoogleAds.enums = google_proto_1.google.ads.googleads.v2.enums;
    GoogleAds.common = google_proto_1.google.ads.googleads.v2.common;
})(GoogleAds = exports.GoogleAds || (exports.GoogleAds = {}));
__export(require("./client"));
__export(require("./extract"));
__export(require("./mock-client"));
