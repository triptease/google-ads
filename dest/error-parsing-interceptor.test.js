"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const google_proto_1 = require("../compiled/google-proto");
const error_parsing_interceptor_1 = require("./error-parsing-interceptor");
const GoogleAdsFailure = google_proto_1.google.ads.googleads.v2.errors.GoogleAdsFailure;
it('can present google error message from metadata', () => {
    const failureMetadataBytes = fs_1.default.readFileSync(path_1.default.join(__dirname, 'failure.pb'));
    const obj = GoogleAdsFailure.decode(failureMetadataBytes);
    const err = new error_parsing_interceptor_1.GaClientError([obj]);
    expect(err.message).toMatchSnapshot();
});
