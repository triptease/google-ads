set -ex

BASE_EXPORT_PATH="./compiled/google-proto"

rm -rf compiled | true
rm -rf googleapis | true

mkdir -p ./compiled

git clone https://github.com/googleapis/googleapis.git
cd googleapis
# most recent commit to GoogleAds protobuf definitions:
# https://github.com/googleapis/googleapis/tree/master/google/ads/googleads
git checkout 429d35c835fd8509302ca0e8031eab35a99e767e
cd ../

ADS_VERSION=v9
PROTO_ROOT_DIR=googleapis/

PROTO_COMMON_ONLY=$(echo $PROTO_ROOT_DIR)google/ads/googleads/$(echo $ADS_VERSION)/common/*.proto
PROTO_ERRORS_ONLY=$(echo $PROTO_ROOT_DIR)google/ads/googleads/$(echo $ADS_VERSION)/errors/*.proto
PROTO_ENUMS_ONLY=$(echo $PROTO_ROOT_DIR)google/ads/googleads/$(echo $ADS_VERSION)/enums/*.proto
PROTO_RESOURCES_ONLY=$(echo $PROTO_ROOT_DIR)google/ads/googleads/$(echo $ADS_VERSION)/resources/*.proto
PROTO_SERVICES_ONLY=$(echo $PROTO_ROOT_DIR)google/ads/googleads/$(echo $ADS_VERSION)/services/*.proto

PROTO_GOOGLE_DEPENDENCIES="$(echo $PROTO_ROOT_DIR)google/rpc/*.proto $(echo $PROTO_ROOT_DIR)google/longrunning/*.proto"
ALL_PROTOBUFS="$(echo $PROTO_GOOGLE_DEPENDENCIES) $(echo $PROTO_COMMON_ONLY) $(echo $PROTO_ERRORS_ONLY) $(echo $PROTO_ENUMS_ONLY) $(echo $PROTO_RESOURCES_ONLY) $(echo $PROTO_SERVICES_ONLY)"

yarn pbjs -t static-module -w commonjs -o $BASE_EXPORT_PATH.js $ALL_PROTOBUFS
yarn pbts -o $BASE_EXPORT_PATH.d.ts $BASE_EXPORT_PATH.js
