# google-ads

This is a triptease managed google ads library because google doesn't have their own. It is generated using google protobuff files.

## How to upgrade

1. Update the hash to the latest google build and `ADS_VERSION` to the new version. See: https://github.com/triptease/google-ads/blob/master/compile-lib.sh#L14
2. Update GOOGLE_ADS_VERSION in client.ts
3. Replace the version number in each type that uses it (eg: google.ads.googleads.v11.services -> google.ads.googleads.v12.services )
4. Run `yarn build` which will run compile-lib then compiles the ts.
5. Run `yarn test`
6. Commit all the files, including the compiled ones
7. Update any repo that uses this library.
