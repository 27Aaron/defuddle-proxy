{
  description = "Defuddle Proxy - self-hosted Defuddle parsing proxy service";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
  };

  outputs =
    { self, nixpkgs }:
    let
      supportedSystems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
      pkgsFor = system: import nixpkgs { inherit system; };
    in
    {
      packages = forAllSystems (
        system:
        let
          pkgs = pkgsFor system;
        in
        {
          default = self.packages.${system}.defuddle-proxy;

          defuddle-proxy = pkgs.buildNpmPackage rec {
            pname = "defuddle-proxy";
            version = "1.0.0";

            src = builtins.path {
              path = ./.;
              name = "${pname}-${version}-source";
              filter =
                path: type:
                let
                  base = baseNameOf path;
                in
                !(
                  builtins.elem base [
                    ".git"
                    ".DS_Store"
                    "node_modules"
                    "data"
                    "result"
                  ]
                  || builtins.match ".*\\.(db|db-journal)$" base != null
                );
            };

            npmDepsHash = "sha256-roG1oEOFa69T6H8SsIgx14F3OskCfwu9P01EliLngYA=";

            nodejs = pkgs.nodejs_22;

            nativeBuildInputs = with pkgs; [
              python3
              gnumake
              gcc
              makeWrapper
            ];

            buildPhase = ''
              npm run build
            '';

            installPhase = ''
              runHook preInstall

              mkdir -p $out/share/defuddle-proxy
              cp -r dist/. $out/share/defuddle-proxy/
              cp -r views/ $out/share/defuddle-proxy/views/
              cp -r node_modules/ $out/share/defuddle-proxy/node_modules/
              cp package.json $out/share/defuddle-proxy/

              # Wrapper
              mkdir -p $out/bin
              cat > $out/bin/defuddle-proxy << 'WRAPPER'
              #!/bin/sh
              set -e
              export NODE_ENV=''${NODE_ENV:-production}
              export PORT=''${PORT:-3000}
              export HOST=''${HOST:-127.0.0.1}
              cd @out@/share/defuddle-proxy
              exec node index.js
              WRAPPER

              substituteInPlace $out/bin/defuddle-proxy --subst-var out
              chmod +x $out/bin/defuddle-proxy

              wrapProgram $out/bin/defuddle-proxy --prefix PATH : ${pkgs.nodejs_22}/bin

              runHook postInstall
            '';

            meta = with pkgs.lib; {
              description = "Self-hosted Defuddle parsing proxy with API Key auth and admin dashboard";
              homepage = "https://github.com/27Aaron/defuddle-proxy";
              license = licenses.wtfpl;
              mainProgram = "defuddle-proxy";
              platforms = supportedSystems;
            };
          };
        }
      );

      devShells = forAllSystems (
        system:
        let
          pkgs = pkgsFor system;
        in
        {
          default = pkgs.mkShell {
            packages = with pkgs; [
              nodejs_22
              python3
              gcc
              gnumake
            ];
          };
        }
      );

      nixosModules.default = import ./nix/modules/nixos.nix self;
      homeManagerModules.default = import ./nix/modules/home-manager.nix self;
    };
}
