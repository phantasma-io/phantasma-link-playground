{ pkgs ? import <nixpkgs> { } }:

pkgs.mkShell {
  packages = [ pkgs.nodejs_24 ];

  # usb / node-hid (pulled in via phantasma-sdk-ts -> @ledgerhq/hw-transport-node-hid)
  # ship prebuilt .node addons that dlopen libudev / libusb-1.0. Without them on
  # the library path `npm install` rejects the prebuild and falls back to node-gyp.
  LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath (with pkgs; [ systemdLibs libusb1 ]);
}
