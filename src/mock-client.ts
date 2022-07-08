import crypto from "crypto";
import { camelCase } from "lodash";
import { google } from "../compiled/google-proto";
import {
  ClientSearchParams,
  IGoogleAdsClient,
  ResourceNotFoundError,
} from "./client";
import { flatten } from "./extract";

import ITagSnippet = google.ads.googleads.v11.common.ITagSnippet;
import TrackingCodeType = google.ads.googleads.v11.enums.TrackingCodeTypeEnum.TrackingCodeType;
import TrackingCodePageFormat = google.ads.googleads.v11.enums.TrackingCodePageFormatEnum.TrackingCodePageFormat;

const hash32 = (str: any) =>
  crypto
    .createHash("md5")
    .update(JSON.stringify(str))
    .digest("hex")
    .substr(0, 32);

function arrayify(v: any) {
  if (Array.isArray(v)) {
    return v;
  }
  return [v];
}

function randomString() {
  return hash32([Math.random(), Math.random(), Math.random()]);
}

function loweCaseFirstLetter(str: string) {
  if (str.length > 1) {
    return str.substr(0, 1).toLowerCase() + str.substr(1);
  }
  return str;
}

function upperCaseFirstLetter(str: string) {
  if (str.length > 1) {
    return str.substr(0, 1).toUpperCase() + str.substr(1);
  }
  return str;
}

export class MockGoogleAdsClient implements IGoogleAdsClient {
  private services = {} as any;
  private resources = {} as any;

  private idCounter = 1;

  public getMccAccountId() {
    return "mcc-123";
  }

  private makeMutator(resourceType: string) {
    return (options: any) => {
      const { operations, customerId } = options;
      operations.forEach((operation: any) => {
        if ("create" in operation) {
          const obj = {
            ...(operation.create.resourceName
              ? {}
              : this.getNewIdentifer(resourceType, customerId)),
            ...operation.create,
            ...this.getServerGeneratedOptions(
              resourceType,
              customerId,
              operation.create
            ),
          };
          return (this.resources[resourceType][obj.resourceName] = obj);
        } else if ("update" in operation) {
          return (this.resources[resourceType][operation.update.resourceName] =
            {
              ...this.resources[resourceType][operation.update.resourceName],
              ...operation.update,
            });
        } else if ("remove" in operation) {
          return delete this.resources[resourceType][operation.remove];
        }

        throw new Error("No action");
      });
    };
  }

  private makeGetter(resourceType: string) {
    return ({ resourceName }: { resourceName: string }) => {
      return this.resources[resourceType][resourceName];
    };
  }

  public async findOne(
    customerId: string,
    resource: string,
    resourceId: number
  ) {
    const resourceName = `customers/${customerId}/${camelCase(
      resource
    )}s/${resourceId}`;
    const results = await this.search({
      customerId,
      resource,
      // cast as any because we know that all resources have a resource name
      filters: {
        resourceName: [resourceName],
      } as any,
    });

    if (results.length > 0) {
      return results[0];
    }

    throw new ResourceNotFoundError(
      `Resource ${resource} with resourceName ${resourceName} for cusomterId ${customerId} does not exist`
    );
  }

  public getService(serviceName: string) {
    if (serviceName in this.services) {
      return this.services[serviceName];
    }

    if (serviceName === "GoogleAdsService") {
      this.services[serviceName] = {
        mutate: jest.fn((options: any) => {
          const mutateOperations = options.mutateOperations;
          mutateOperations.forEach((operation: any) => {
            const resourceOpName = Object.keys(operation)[0];
            const resourceName = resourceOpName.substr(
              0,
              resourceOpName.length - "Operation".length
            );
            const service = this.getService(`${resourceName}Service`);
            service[`mutate${upperCaseFirstLetter(resourceName)}s`]({
              ...options,
              operations: [operation[resourceOpName]],
            });
          });
        }),
      };

      return this.services[serviceName];
    }

    const resourceName = upperCaseFirstLetter(
      serviceName.substr(0, serviceName.length - 7)
    );

    this.resources[resourceName] = [];

    let additionMethods = {};
    if (serviceName === "CustomerService") {
      additionMethods = {
        createCustomerClient: ({ customerId, customerClient }: any) => {
          const fullCustomer = {
            ...this.getNewIdentifer("Customer", ""),
            ...customerClient,
          };

          this.resources.CustomerClient = this.resources.CustomerClient || [];
          this.resources.CustomerClient[fullCustomer.resourceName] = {
            resourceName: fullCustomer.resourceName,
            clientCustomer: fullCustomer.resourceName,
            hidden: false,
            level: 1,
          };

          this.resources[resourceName][fullCustomer.resourceName] =
            fullCustomer;
        },
      };
    }

    this.services[serviceName] = {
      [`mutate${resourceName}s`]: jest.fn(this.makeMutator(resourceName)),
      [`get${resourceName}`]: jest.fn(this.makeGetter(resourceName)),
      ...additionMethods,
    };

    return this.services[serviceName];
  }

  public async search(params: ClientSearchParams<any>): Promise<any> {
    let resources =
      params.resource in this.resources
        ? Object.values(this.resources[params.resource])
        : [];

    if (params.filters !== undefined) {
      resources = resources.filter((gResource: any) => {
        const gResourceStringed = (google.ads.googleads.v11.resources as any)[
          params.resource
        ].toObject(gResource, {
          enums: String,
        });
        const resource = flatten(gResourceStringed);

        if (params.filters !== undefined) {
          for (const filterKey of Object.keys(params.filters)) {
            const filterValues = arrayify(params.filters[filterKey]);
            if (filterValues.includes(resource[filterKey]) === false) {
              return false;
            }
          }
        }

        return true;
      });
    }

    if (params.limit) {
      resources = resources.splice(0, 1);
    }

    return resources;
  }

  public async stop(): Promise<void> {
    return Promise.resolve();
  }

  private getNewIdentifer(resourceName: string, customerId: string) {
    const id = this.idCounter++;
    return {
      id: { value: id },
      resourceName:
        resourceName === "Customer"
          ? `customers/${id}`
          : `customers/${customerId}/${loweCaseFirstLetter(
              resourceName
            )}s/${id}`,
    };
  }

  private getServerGeneratedOptions(
    resourceName: string,
    customerId: string,
    obj: any
  ) {
    switch (resourceName) {
      case "ConversionAction":
        const resource = flatten(obj);
        const adwordsAccountId = `AW-RND_${customerId}`;
        const conversionTrackingId = `RND_${resource.name}`;
        const tagSnippets: ITagSnippet[] = [
          {
            type: TrackingCodeType.WEBPAGE_ONCLICK,
            pageFormat: TrackingCodePageFormat.HTML,
            globalSiteTag:
              "<!-- Global site tag (gtag.js) - Google Ads: 741508461 -->\n<script async src=\"https://www.googletagmanager.com/gtag/js?id=AW-741508461\"></script>\n<script>\n  window.dataLayer = window.dataLayer || [];\n  function gtag(){dataLayer.push(arguments);}\n  gtag('js', new Date());\n\n  gtag('config', 'AW-741508461');\n</script>\n",
            eventSnippet: `<!-- Event snippet for gekko-25dc9f1dee9eebb8 conversion page\nIn your html page, add the snippet and call gtag_report_conversion when someone clicks on the chosen link or button. -->\n<script>\nfunction gtag_report_conversion(url) {\n  var callback = function () {\n    if (typeof(url) != 'undefined') {\n      window.location = url;\n    }\n  };\n  gtag('event', 'conversion', {\n      'send_to': '${adwordsAccountId}/${conversionTrackingId}',\n      'value': 0.0,\n      'currency': 'USD',\n      'event_callback': callback\n  });\n  return false;\n}\n</script>\n`,
          },
          {
            type: TrackingCodeType.WEBPAGE_ONCLICK,
            pageFormat: TrackingCodePageFormat.AMP,
            globalSiteTag:
              '<!-- Global site tag (gtag) - Google Ads: 741508461 -->\n<amp-analytics type="gtag" data-credentials="include">\n<script type="application/json">\n{\n  "vars": {\n    "gtag_id": "AW-741508461",\n    "config": {\n      "AW-741508461": {\n        "groups": "default"\n      }\n    }\n  },\n  "triggers": {\n  }\n}\n</script>\n</amp-analytics>\n',
            eventSnippet: `\"C_dhkw47fQ3-A\": {\n  \"on\": \"click\",\n  \"selector\": \"CSS_SELECTOR\",\n  \"vars\": {\n    \"event_name\": \"conversion\",\n    \"value\": 0.0,\n    \"currency\": \"USD\",\n    \"send_to\": [\"${adwordsAccountId}/${conversionTrackingId}\"]\n  }\n}\n`,
          },
          {
            type: TrackingCodeType.WEBPAGE,
            pageFormat: TrackingCodePageFormat.HTML,
            globalSiteTag:
              "<!-- Global site tag (gtag.js) - Google Ads: 741508461 -->\n<script async src=\"https://www.googletagmanager.com/gtag/js?id=AW-741508461\"></script>\n<script>\n  window.dataLayer = window.dataLayer || [];\n  function gtag(){dataLayer.push(arguments);}\n  gtag('js', new Date());\n\n  gtag('config', 'AW-741508461');\n</script>\n",
            eventSnippet: `<!-- Event snippet for gekko-25dc9f1dee9eebb8 conversion page -->\n<script>\n  gtag('event', 'conversion', {\n      'send_to': '${adwordsAccountId}/${conversionTrackingId}',\n      'value': 0.0,\n      'currency': 'USD'\n  });\n</script>\n`,
          },
          {
            type: TrackingCodeType.WEBPAGE,
            pageFormat: TrackingCodePageFormat.AMP,
            globalSiteTag:
              '<!-- Global site tag (gtag) - Google Ads: 741508461 -->\n<amp-analytics type="gtag" data-credentials="include">\n<script type="application/json">\n{\n  "vars": {\n    "gtag_id": "AW-741508461",\n    "config": {\n      "AW-741508461": {\n        "groups": "default"\n      }\n    }\n  },\n  "triggers": {\n  }\n}\n</script>\n</amp-analytics>\n',
            eventSnippet: `\"C_dhkw47fQ3-A\": {\n  \"on\": \"visible\",\n  \"vars\": {\n    \"event_name\": \"conversion\",\n    \"value\": 0.0,\n    \"currency\": \"USD\",\n    \"send_to\": [\"${adwordsAccountId}/${conversionTrackingId}\"]\n  }\n}\n`,
          },
        ];

        return { tagSnippets };
      default:
        return {};
    }
  }
}
