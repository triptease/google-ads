import { ServiceClient } from "@grpc/grpc-js/build/src/make-client";
import { OAuth2Client } from "google-auth-library";
import { google } from "../compiled/google-proto";
import {
  ClientCreator,
  ClientPool,
  GoogleAdsClient,
  ResourceNotFoundError,
} from "./client";

const settings = {
  developerToken: "dev-toke",
  mccAccountId: "123",
  authOptions: {
    scopes: ["https://www.googleapis.com/auth/adwords"],
    keyFilename: "./.not-a-real-key.json",
  },
};

function buildMockGetServices(pages: number = 1) {
  const mockServices = {
    GoogleAdsFieldService: {
      searchGoogleAdsFields: jest.fn(async () => {
        return {
          results: [
            { name: "campaign.status", selectable: true },
            { name: "campaign.count", selectable: false },
            { name: "campaign_budget.name", selectable: true },
            { name: "change_status.last_change_date_time", selectable: true },
          ],
          totalResultsCount: 1000,
        } as Partial<google.ads.googleads.v8.services.SearchGoogleAdsFieldsResponse>;
      }),
    } as Partial<google.ads.googleads.v8.services.GoogleAdsFieldService>,

    GoogleAdsService: {
      search: jest.fn(async () => {
        const pageNumber = --pages;
        return {
          nextPageToken: pageNumber ? String(pageNumber) : undefined,
          results: [
            {
              campaign: { name: "foo " + pageNumber },
            },
          ],
        } as Partial<google.ads.googleads.v8.services.SearchGoogleAdsResponse>;
      }),
    } as Partial<google.ads.googleads.v8.services.GoogleAdsService>,
  };

  const getServices = (serviceName: any) => {
    if (serviceName in mockServices) {
      return (mockServices as any)[serviceName];
    }

    throw new Error(`${serviceName} service not implemented`);
  };

  return Object.assign(getServices, mockServices);
}

describe("ClientPool", () => {
  it("should balance requests across the client pool", () => {
    let clientIndex = 0;
    const mockClientCreator: ClientCreator = () => {
      let localIndex = clientIndex++;
      // Mocking `close` as it has no params so the test is neater -
      // we don't care what it actually does.
      return { close: () => localIndex } as unknown as ServiceClient;
    };

    const clientPool = new ClientPool(
      {} as unknown as OAuth2Client,
      2,
      mockClientCreator
    );

    const client1 = clientPool.getClient();
    const client2 = clientPool.getClient();
    const client3 = clientPool.getClient();

    expect(client1.close()).toStrictEqual(0);
    expect(client2.close()).toStrictEqual(1);
    // The pool has two clients so this should have wrapped back around
    expect(client3.close()).toStrictEqual(0);
  });
});

describe("GoogleAdsClient", () => {
  describe("findOne", () => {
    it("should produce SQL to search", async () => {
      const client = new GoogleAdsClient(settings);
      const services = buildMockGetServices();
      client.getService = services;

      await client.findOne("123", "Campaign", 456);

      expect(
        services.GoogleAdsFieldService.searchGoogleAdsFields
      ).toBeCalledWith({
        query: `SELECT name, selectable, category`,
      });

      expect(services.GoogleAdsService.search).toBeCalledWith({
        customerId: "123",
        pageSize: 1000,
        pageToken: null,
        query:
          `SELECT campaign.status FROM campaign WHERE campaign.resource_name = 'customers/123/campaigns/456'`,
      });
    });

    it("should throw an error if no resource is found", async () => {
      const client = new GoogleAdsClient(settings);
      const services = buildMockGetServices();
      client.getService = services;
      services.GoogleAdsService.search = () => ({ results: [] } as any);

      await expect(client.findOne("123", "Campaign", 456)).rejects.toThrow(
        ResourceNotFoundError
      );
    });
  });

  describe("search", () => {
    it("should produce SQL to search", async () => {
      const client = new GoogleAdsClient(settings);
      const services = buildMockGetServices();
      client.getService = services;

      await client.search({
        customerId: "123",
        resource: "Campaign",
        filters: {
          status: ["ENABLED", "PAUSED"],
          name: "test",
        },
      });

      expect(
        services.GoogleAdsFieldService.searchGoogleAdsFields
      ).toBeCalledWith({
        query: `SELECT name, selectable, category`,
      });

      expect(services.GoogleAdsService.search).toBeCalledWith({
        customerId: "123",
        pageSize: 1000,
        pageToken: null,
        query:
          `SELECT campaign.status FROM campaign WHERE campaign.status in ('ENABLED','PAUSED') and campaign.name = 'test'`,
      });
    });

    it("should produce SQL basic", async () => {
      const client = new GoogleAdsClient(settings);
      const services = buildMockGetServices();
      client.getService = services;

      await client.search({
        customerId: "123",
        resource: "Campaign",
        filters: {},
      });

      expect(services.GoogleAdsService.search).toBeCalledWith({
        customerId: "123",
        pageSize: 1000,
        pageToken: null,
        query: "SELECT campaign.status FROM campaign",
      });
    });

    it("should produce SQL  with limit and order by", async () => {
      const client = new GoogleAdsClient(settings);
      const services = buildMockGetServices();
      client.getService = services;

      await client.search({
        customerId: "123",
        resource: "Campaign",
        filters: {
          status: "ENABLED",
        },
        orderBy: "status",
        orderByDirection: "DESC",
        limit: 300,
      });

      expect(services.GoogleAdsService.search).toBeCalledWith({
        customerId: "123",
        pageSize: 1000,
        pageToken: null,
        query:
          `SELECT campaign.status FROM campaign WHERE campaign.status = 'ENABLED' ORDER BY campaign.status DESC LIMIT 300`,
      });
    });


    it("should produce SQL  and escale quotes", async () => {
      const client = new GoogleAdsClient(settings);
      const services = buildMockGetServices();
      client.getService = services;

      await client.search({
        customerId: "123",
        resource: "Campaign",
        filters: {
          name: `'Sneaky' \\'Hacks\\'`,
        }
      });

      expect(services.GoogleAdsService.search).toBeCalledWith({
        customerId: "123",
        pageSize: 1000,
        pageToken: null,
        query:
          `SELECT campaign.status FROM campaign WHERE campaign.name = '\\'Sneaky\\' \\\\\\'Hacks\\\\\\''`,
      });
    });


    it("should produce SQL with booleans", async () => {
      const client = new GoogleAdsClient(settings);
      const services = buildMockGetServices();
      client.getService = services;

      await client.search({
        customerId: "123",
        resource: "CampaignBudget",
        filters: {
          explicitlyShared: true,
        },
      });

      expect(services.GoogleAdsService.search).toBeCalledWith({
        customerId: "123",
        pageSize: 1000,
        pageToken: null,
        query:
          'SELECT campaign_budget.name FROM campaign_budget WHERE campaign_budget.explicitly_shared = true',
      });
    });

    it("should be able to do complex conditions", async () => {
      const client = new GoogleAdsClient(settings);
      const services = buildMockGetServices();
      client.getService = services;

      await client.search({
        customerId: "123",
        resource: "ChangeStatus",
        filters: {
          lastChangeDateTime: { raw: `> "2020-01-01"` },
        },
      });

      expect(services.GoogleAdsService.search).toBeCalledWith({
        customerId: "123",
        pageSize: 1000,
        pageToken: null,
        query:
          `SELECT change_status.last_change_date_time FROM change_status WHERE change_status.last_change_date_time > "2020-01-01"`,
      });
    });

    it("should return expected values from search", async () => {
      const client = new GoogleAdsClient(settings);
      client.getService = buildMockGetServices();

      const result = await client.search({
        customerId: "123",
        resource: "Campaign",
        filters: {
          status: "ENABLED",
        },
      });

      expect(result).toEqual([{ name: "foo 0" }]);
    });

    it("should cast camel case filters into snake case", async () => {
      const client = new GoogleAdsClient(settings);
      const services = buildMockGetServices();
      client.getService = services;

      await client.search({
        customerId: "123",
        resource: "Campaign",
        filters: {
          status: "ENABLED",
          resourceName: "1234",
        },
      });

      expect(services.GoogleAdsService.search).toBeCalledWith(
        expect.objectContaining({
          query:
            `SELECT campaign.status FROM campaign WHERE campaign.status = 'ENABLED' and campaign.resource_name = '1234'`,
        })
      );
    });

    it("should return all results if paginated", async () => {
      const client = new GoogleAdsClient(settings);
      client.getService = buildMockGetServices(2);

      const result = await client.search({
        customerId: "123",
        resource: "Campaign",
        filters: {
          status: "ENABLED",
        },
      });

      expect(result).toEqual([{ name: "foo 1" }, { name: "foo 0" }]);
    });
  });

  describe("getService", () => {
    it("should get a service", async () => {
      const client = new GoogleAdsClient(settings);
      const service = client.getService("CampaignService");
      expect(service).toBeInstanceOf(
        google.ads.googleads.v8.services.CampaignService
      );
    });
  });
});
