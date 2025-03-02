import { Duration } from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import { Construct } from "constructs";
import { APP_DOMAIN } from "./consts";

export class AssetsCdn extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const domainName = `assets.${APP_DOMAIN}`;
    const originDomainName = APP_DOMAIN;

    const certificate = new acm.Certificate(this, "Certificate", {
      domainName,
      validation: acm.CertificateValidation.fromDns(),
    });

    const httpOrigin = new origins.HttpOrigin(originDomainName, {
      originPath: "/static",
    });

    const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(
      this,
      "RespHeaders",
      {
        corsBehavior: {
          accessControlAllowCredentials: false,
          accessControlAllowOrigins: [`https://${originDomainName}`],
          accessControlAllowHeaders: ["*"],
          accessControlAllowMethods: ["GET", "OPTIONS"],
          accessControlExposeHeaders: ["*"],
          accessControlMaxAge: Duration.seconds(600),
          originOverride: true,
        },
      }
    );

    const cachePolicy = new cloudfront.CachePolicy(this, "CachePolicy", {
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
      enableAcceptEncodingBrotli: true,
    });

    new cloudfront.Distribution(this, "Distribution", {
      domainNames: [domainName],
      certificate,
      defaultBehavior: {
        origin: httpOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        responseHeadersPolicy,
        cachePolicy,
      },
    });
  }
}
