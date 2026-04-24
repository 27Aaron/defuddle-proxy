self:
{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.services.defuddle-proxy;
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
      default = "/var/lib/defuddle-proxy";
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

    user = lib.mkOption {
      type = lib.types.str;
      default = "defuddle-proxy";
      description = "User to run the service as.";
    };

    group = lib.mkOption {
      type = lib.types.str;
      default = "defuddle-proxy";
      description = "Group to run the service as.";
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

  config = lib.mkIf cfg.enable {
    users.users.${cfg.user} = {
      group = cfg.group;
      isSystemUser = true;
      home = cfg.dataDir;
      createHome = false;
    };

    users.groups.${cfg.group} = { };

    systemd.tmpfiles.rules = [ "d ${cfg.dataDir} 0750 ${cfg.user} ${cfg.group} -" ];

    systemd.services.defuddle-proxy = {
      description = "Defuddle Proxy self-hosted parsing service";
      wantedBy = [ "multi-user.target" ];
      after = [ "network.target" ];

      environment =
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

      serviceConfig = {
        Type = "simple";
        User = cfg.user;
        Group = cfg.group;
        WorkingDirectory = cfg.dataDir;
        ExecStart = "${cfg.package}/bin/defuddle-proxy";
        Restart = "on-failure";
        RestartSec = 5;
        EnvironmentFile = lib.mkIf (cfg.environmentFile != null) cfg.environmentFile;

        # Security hardening
        ProtectHome = true;
        ProtectSystem = "strict";
        PrivateTmp = true;
        NoNewPrivileges = true;
        ReadWritePaths = cfg.dataDir;
      };
    };
  };
}
