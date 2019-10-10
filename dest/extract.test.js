"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const long_1 = __importDefault(require("long"));
const google_proto_1 = require("../compiled/google-proto");
const extract_1 = require("./extract");
describe('fattern', () => {
    it('should hoist objs value properties', () => {
        const result = extract_1.flattern({
            resourceName: 'customers/123/campaigns/456',
            id: {
                value: 1758658058,
            },
            name: {
                value: 'A Hotel',
            },
            status: 'PAUSED',
            networkSettings: {
                targetGoogleSearch: {
                    value: true,
                },
            },
            targetingSetting: {
                targetRestrictions: [
                    {
                        targetingDimension: 'AUDIENCE',
                        bidOnly: {
                            value: true,
                        },
                    },
                ],
            },
        });
        expect(result).toEqual({
            resourceName: 'customers/123/campaigns/456',
            id: 1758658058,
            name: 'A Hotel',
            status: 'PAUSED',
            networkSettings: {
                targetGoogleSearch: true,
            },
            targetingSetting: {
                targetRestrictions: [
                    {
                        targetingDimension: 'AUDIENCE',
                        bidOnly: true,
                    },
                ],
            },
        });
    });
    test('extract should not mangle Long values', () => {
        // create a simple protobuf object with a campaign id in it
        const longValue = long_1.default.fromNumber(12345);
        const id = new google_proto_1.google.protobuf.Int64Value({ value: longValue });
        const campaign = new google_proto_1.google.ads.googleads.v2.resources.Campaign({ id });
        const row = new google_proto_1.google.ads.googleads.v2.services.GoogleAdsRow({ campaign });
        const extractedRow = extract_1.extract(row, ['campaign']);
        expect(extractedRow.campaign.id).toBe(12345);
        const extractedCampaign = extract_1.extract(extractedRow.campaign, ['id']);
        expect(extractedCampaign.id).toBe(12345);
    });
    test('flattern should not mangle Long values', () => {
        const longValue = long_1.default.fromNumber(12345);
        const id = new google_proto_1.google.protobuf.Int64Value({ value: longValue });
        const campaign = new google_proto_1.google.ads.googleads.v2.resources.Campaign({ id });
        const flattenedCampaign = extract_1.flattern(campaign);
        expect(flattenedCampaign.id).toEqual(12345);
        const reFlatternedCampaign = extract_1.flattern(flattenedCampaign);
        expect(reFlatternedCampaign.id).toEqual(12345);
    });
});
