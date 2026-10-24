import addon from "@gpuix/native-darwin-arm64/gpuix-native.darwin-arm64.node" with {
  type: "file",
};

// A compiled binary can't discover the addon at runtime, so it is embedded and pointed to.
process.env.NAPI_RS_NATIVE_LIBRARY_PATH = addon;
