self:
{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.services.defuddle-proxy;

  envVars =
    {
      NODE_ENV = "production";
      PORT = toString cfg.port;
      HOST = cfg.host;
      DB_PATH = "${cfg.dataDir}/defuddle.db";
      ADMIN_USERNAME = cfg.adminUsername;
      ADMIN_PASSWORD = cfg.adminPassword;
      COOKIE_SECURE = if cfg.cookieSecure then "true" else "false";
      TZ = cfg.timezone;
    }
    // (lib.optionalAttrs (cfg.sessionSecret != null) { SESSION_SECRET = cfg.sessionSecret; })
    // cfg.environment;
in
{
  options.services.defuddle-proxy = {
    enable = lib.mkEnableOption "Defuddle Proxy self-hosted parsing service";

    package = lib.mkOption {
      type = lib.types.package;
      default = self.packages.${pkgs.stdenv.hostPlatform.system}.defuddle-proxy;
      defaultText = "self.packages.<system>.defuddle-proxy";
      description = "Defuddle Proxy package to use.";
    };

    port = lib.mkOption {
      type = lib.types.port;
      default = 3000;
      description = "Port to listen on.";
    };

    host = lib.mkOption {
      type = lib.types.str;
      default = "127.0.0.1";
      description = "Host to bind to. Use \"0.0.0.0\" to listen on all interfaces.";
    };

    dataDir = lib.mkOption {
      type = lib.types.path;
      default = "${config.xdg.dataHome}/defuddle-proxy";
      defaultText = "\${config.xdg.dataHome}/defuddle-proxy";
      description = "Data directory for database and runtime files.";
    };

    adminUsername = lib.mkOption {
      type = lib.types.str;
      default = "admin";
      description = "Admin dashboard username.";
    };

    adminPassword = lib.mkOption {
      type = lib.types.str;
      default = "changeme";
      description = "Admin dashboard password. WARNING: stored in Nix store. Prefer environmentFile for secrets.";
    };

    sessionSecret = lib.mkOption {
      type = lib.types.nullOr lib.types.str;
      default = null;
      description = "Session encryption secret. WARNING: stored in Nix store. Prefer environmentFile for secrets.";
    };

    cookieSecure = lib.mkOption {
      type = lib.types.bool;
      default = false;
      description = "Set to true when using HTTPS.";
    };

    timezone = lib.mkOption {
      type = lib.types.str;
      default = "UTC";
      description = "Timezone, e.g. \"Asia/Shanghai\".";
    };

    environment = lib.mkOption {
      type = lib.types.attrsOf lib.types.str;
      default = { };
      example = lib.literalExpression ''
        {
          TZ = "Asia/Shanghai";
        }
      '';
      description = "Extra environment variables for the service.";
    };

    environmentFile = lib.mkOption {
      type = lib.types.nullOr lib.types.path;
      default = null;
      example = "/run/secrets/defuddle-proxy.env";
      description = "File with environment variables (KEY=VALUE). Use for secrets like ADMIN_PASSWORD and SESSION_SECRET.";
    };
  };

  config = lib.mkIf cfg.enable (lib.mkMerge [
    # --- Linux: systemd user service ---
    (lib.mkIf pkgs.stdenv.isLinux {
      systemd.user.services.defuddle-proxy = {
        Unit = {
          Description = "Defuddle Proxy self-hosted parsing service";
          After = [ "network.target" ];
        };

        Service =
          {
            Type = "simple";
            ExecStart = "${cfg.package}/bin/defuddle-proxy";
            Restart = "on-failure";
            RestartSec = 5;
            Environment = lib.mapAttrsToList (k: v: "${k}=${v}") envVars;
          }
          // lib.optionalAttrs (cfg.environmentFile != null) {
            EnvironmentFile = cfg.environmentFile;
          };

        Install = {
          WantedBy = [ "default.target" ];
        };
      };
    })

    # --- macOS: launchd agent ---
    (lib.mkIf pkgs.stdenv.isDarwin {
      launchd.agents.defuddle-proxy = {
        enable = true;
        config = {
          ProgramArguments =
            if cfg.environmentFile != null then
              [
                "${
                  pkgs.writeShellScript "defuddle-proxy-launchd" ''
                    set -a
                    . ${cfg.environmentFile}
                    set +a
                    exec ${cfg.package}/bin/defuddle-proxy
                  ''
                }"
              ]
            else
              [ "${cfg.package}/bin/defuddle-proxy" ];
          EnvironmentVariables = envVars;
          RunAtLoad = true;
          KeepAlive.Crashed = true;
          StandardOutPath = "${cfg.dataDir}/defuddle-proxy.log";
          StandardErrorPath = "${cfg.dataDir}/defuddle-proxy.err";
        };
      };
    })
  ]);
}
