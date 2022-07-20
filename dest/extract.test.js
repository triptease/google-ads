"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const long_1 = __importDefault(require("long"));
const google_proto_1 = require("../compiled/google-proto");
const extract_1 = require("./extract");
describe("flatten", () => {
    it("should hoist objs value properties", () => {
        const result = (0, extract_1.flatten)({
            resourceName: "customers/123/campaigns/456",
            id: {
                value: 1758658058,
            },
            name: {
                value: "A Hotel",
            },
            status: "PAUSED",
            networkSettings: {
                targetGoogleSearch: {
                    value: true,
                },
            },
            targetingSetting: {
                targetRestrictions: [
                    {
                        targetingDimension: "AUDIENCE",
                        bidOnly: {
                            value: true,
                        },
                    },
                ],
            },
        });
        expect(result).toEqual({
            resourceName: "customers/123/campaigns/456",
            id: 1758658058,
            name: "A Hotel",
            status: "PAUSED",
            networkSettings: {
                targetGoogleSearch: true,
            },
            targetingSetting: {
                targetRestrictions: [
                    {
                        targetingDimension: "AUDIENCE",
                        bidOnly: true,
                    },
                ],
            },
        });
    });
    test("extract should not mangle Long values", () => {
        // create a simple protobuf object with a campaign id in it
        const id = long_1.default.fromNumber(12345);
        const campaign = new google_proto_1.google.ads.googleads.v11.resources.Campaign({ id });
        const row = new google_proto_1.google.ads.googleads.v11.services.GoogleAdsRow({
            campaign,
        });
        const extractedRow = (0, extract_1.extract)(row, ["campaign"]);
        expect(extractedRow.campaign.id).toBe(12345);
        const extractedCampaign = (0, extract_1.extract)(extractedRow.campaign, ["id"]);
        expect(extractedCampaign.id).toBe(12345);
    });
    test("flatten should not mangle Long values", () => {
        const id = long_1.default.fromNumber(12345);
        const campaign = new google_proto_1.google.ads.googleads.v11.resources.Campaign({ id });
        const flattenedCampaign = (0, extract_1.flatten)(campaign);
        expect(flattenedCampaign.id).toEqual(12345);
        const reFlattenedCampaign = (0, extract_1.flatten)(flattenedCampaign);
        expect(reFlattenedCampaign.id).toEqual(12345);
    });
});
