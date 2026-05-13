{
  description = "Development shell for niuniu-zoo-chat";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_20
            git
            curl
          ];

          shellHook = ''
            export NEXT_TELEMETRY_DISABLED=1
            echo "Nix dev shell ready for niuniu-zoo-chat"
            echo "Run: npm install && npm run dev"
          '';
        };
      });
}
