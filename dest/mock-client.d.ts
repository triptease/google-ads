import { ClientSearchParams, IGoogleAdsClient } from "./client";
export declare class MockGoogleAdsClient implements IGoogleAdsClient {
    private services;
    private resources;
    private idCounter;
    getMccAccountId(): string;
    private makeMutator;
    private makeGetter;
    findOne(customerId: string, resource: string, resourceId: number): Promise<any>;
    getService(serviceName: string): any;
    search(params: ClientSearchParams<any>): Promise<any>;
    private getNewIdentifer;
    private getServerGeneratedOptions;
}
