"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleAds = void 0;
const googleads_1 = require("../definitions/googleads");
var GoogleAds;
(function (GoogleAds) {
    GoogleAds.protobuf = googleads_1.google.protobuf;
    GoogleAds.longrunning = googleads_1.google.longrunning;
    GoogleAds.services = googleads_1.google.ads.googleads.v16.services;
    GoogleAds.resources = googleads_1.google.ads.googleads.v16.resources;
    GoogleAds.enums = googleads_1.google.ads.googleads.v16.enums;
    GoogleAds.common = googleads_1.google.ads.googleads.v16.common;
    GoogleAds.errors = googleads_1.google.ads.googleads.v16.errors;
})(GoogleAds || (exports.GoogleAds = GoogleAds = {}));
__exportStar(require("./client"), exports);
__exportStar(require("./extract"), exports);
__exportStar(require("./mock-client"), exports);
