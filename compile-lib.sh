set -ex

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)

DEFINITIONS_DIR="$SCRIPT_DIR/definitions"
PROTO_DIR="$DEFINITIONS_DIR/proto"

GOOGLE_ADS_VERSION=v14
fetch_and_format_protobuf_definitions () {
  # https://buf.build/docs/format/style
  yarn buf format https://github.com/googleapis/googleapis.git \
    --path google/ads/googleads/$GOOGLE_ADS_VERSION \
    --path google/api \
    --path google/logging \
    --path google/longrunning \
    --path google/rpc \
    -o "$PROTO_DIR"
}

generate_static_code_and_typescript_definitions () {
  # https://github.com/protobufjs/protobuf.js/tree/master/cli#protobufjs-cli
  yarn pbjs -t static-module -w commonjs -o "$DEFINITIONS_DIR"/googleads.js "$PROTO_DIR"/**/*.proto
  yarn pbts -o "$DEFINITIONS_DIR"/googleads.d.ts "$DEFINITIONS_DIR"/googleads.js
}

fetch_and_format_protobuf_definitions
generate_static_code_and_typescript_definitions