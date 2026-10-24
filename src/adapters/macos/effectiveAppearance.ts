import { CString, dlopen, FFIType, type Pointer } from "bun:ffi";

// Auto appearance no longer sets `AppleInterfaceStyle`, so ask AppKit itself.
const read = () => {
  dlopen("/System/Library/Frameworks/AppKit.framework/AppKit", {
    NSApplicationMain: { args: [], returns: FFIType.void },
  });
  const { symbols: objc } = dlopen("/usr/lib/libobjc.dylib", {
    objc_getClass: { args: [FFIType.cstring], returns: FFIType.ptr },
    sel_registerName: { args: [FFIType.cstring], returns: FFIType.ptr },
    objc_msgSend: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.ptr },
  });
  const c = (s: string) => Buffer.from(`${s}\0`);
  const send = (o: Pointer | null, sel: string) =>
    objc.objc_msgSend(o, objc.sel_registerName(c(sel))) as Pointer | null;

  const app = send(
    objc.objc_getClass(c("NSApplication")) as Pointer,
    "sharedApplication",
  );
  const name = send(send(app, "effectiveAppearance"), "name");
  const text = String(new CString(send(name, "UTF8String") as Pointer));
  return text.includes("Dark") ? "dark" : "light";
};

// A fresh process sees the current appearance; a long-lived one may not.
if (import.meta.main) console.log(read());
