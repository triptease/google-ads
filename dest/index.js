"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleAds = void 0;
const google_proto_1 = require("../compiled/google-proto");
var GoogleAds;
(function (GoogleAds) {
    GoogleAds.protobuf = google_proto_1.google.protobuf;
    GoogleAds.services = google_proto_1.google.ads.googleads.v5.services;
    GoogleAds.resources = google_proto_1.google.ads.googleads.v5.resources;
    GoogleAds.enums = google_proto_1.google.ads.googleads.v5.enums;
    GoogleAds.common = google_proto_1.google.ads.googleads.v5.common;
})(GoogleAds = exports.GoogleAds || (exports.GoogleAds = {}));
__exportStar(require("./client"), exports);
__exportStar(require("./extract"), exports);
__exportStar(require("./mock-client"), exports);
