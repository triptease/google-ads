# google-ads

This is a triptease managed google ads library because google doen't have their own. It is generated using google protobuff files.

## How to upgrade

1. Update the hash to the latest google build. See: https://github.com/triptease/google-ads/blob/master/compile-lib.sh#L14
1. Update GOOGLE_ADS_VERSION in client.ts
1. Run `yarn build` which will run compile-lib then compiles the ts.
1. Commit all of the files, including the compiled ones
1. Update any repo that uses this library.
