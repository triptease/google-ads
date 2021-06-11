import Long from "long";
import { google } from "../compiled/google-proto";
import { extract, flattern } from "./extract";

describe("fattern", () => {
  it("should hoist objs value properties", () => {
    const result = flattern({
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
    const id = Long.fromNumber(12345);
    const campaign = new google.ads.googleads.v8.resources.Campaign({ id });

    const row = new google.ads.googleads.v8.services.GoogleAdsRow({ campaign });

    const extractedRow = extract(row, ["campaign"]);
    expect(extractedRow.campaign.id).toBe(12345);

    const extractedCampaign = extract(extractedRow.campaign, ["id"]);
    expect(extractedCampaign.id).toBe(12345);
  });

  test("flattern should not mangle Long values", () => {
    const id = Long.fromNumber(12345);
    const campaign = new google.ads.googleads.v8.resources.Campaign({ id });

    const flattenedCampaign = flattern(campaign);
    expect(flattenedCampaign.id).toEqual(12345);

    const reFlatternedCampaign = flattern(flattenedCampaign);
    expect(reFlatternedCampaign.id).toEqual(12345);
  });
});
