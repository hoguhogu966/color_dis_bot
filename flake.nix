{
  description = "Discord color-role bot environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
  };

  outputs = inputs@{ flake-parts, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      systems = [ "aarch64-darwin" "aarch64-linux" ];

      perSystem = { pkgs, lib, ... }:
        let
          nodejs = pkgs.nodejs_24;

          app = pkgs.buildNpmPackage {
            pname = "color-discord-bot";
            version = "0.1.0";
            src = ./.;
            nodejs = nodejs;
            npmDepsHash = "sha256-uH6Rqjr1GT7SqUh9pTfSADoR8lbYAhoS4kCQ7qK9Kcg=";
          };

          entrypoint = pkgs.writeShellApplication {
            name = "color-discord-bot";
            runtimeInputs = [ nodejs ];
            text = ''
              exec node ${app}/lib/node_modules/color-discord-bot/dist/index.js
            '';
          };

          container = pkgs.dockerTools.buildLayeredImage {
            name = "color-discord-bot";
            tag = "latest";
            contents = [ entrypoint pkgs.cacert ];
            config = {
              Cmd = [ "${entrypoint}/bin/color-discord-bot" ];
              WorkingDir = "/data";
              Env = [ "SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt" ];
            };
            extraCommands = "mkdir -p data";
          };
        in
        lib.mkMerge [
          {
            devShells.default = pkgs.mkShell {
              packages = [
                nodejs
                pkgs.typescript
              ];
            };

            packages.default = app;
            packages.app = app;
          }
          (lib.mkIf pkgs.stdenv.hostPlatform.isLinux {
            packages.container = container;
          })
        ];
    };
}
