import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { APP_DOMAIN, ASSET_CACHE_PARAM } from "./consts";
import { FileNodesStorage } from "./file-nodes-storage";

interface Props {
  isProd: boolean;
  fileNodesBucket: s3.Bucket;
  fileNodesBucketCors: FileNodesStorage["bucketCors"];
}

export class FileNodesCdn extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const { fileNodesBucket, fileNodesBucketCors, isProd } = props;

    const encodedKey = process.env.CLOUDFRONT_SIGNER_PUBKEY;

    if (!encodedKey) {
      throw new Error("Missing CLOUDFRONT_SIGNER_PUBKEY");
    }

    const domainName = isProd
      ? `uploads.${APP_DOMAIN}`
      : `uploads.dev.${APP_DOMAIN}`;

    const pubKey = new cloudfront.PublicKey(this, "PubKey", { encodedKey });
    const keyGroup = new cloudfront.KeyGroup(this, "KeyGroup", {
      items: [pubKey],
    });

    const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(
      this,
      "RespHeadersPolicy",
      {
        corsBehavior: {
          accessControlAllowCredentials: false,
          accessControlAllowMethods: fileNodesBucketCors.allowedMethods,
          accessControlAllowOrigins: fileNodesBucketCors.allowedOrigins,
          accessControlAllowHeaders: fileNodesBucketCors.allowedHeaders,
          originOverride: true,
        },
        customHeadersBehavior: {
          customHeaders: [
            {
              header: "No-Vary-Search", // https://chromestatus.com/feature/5808599110254592
              value: `params, except=("${ASSET_CACHE_PARAM}")`,
              override: true,
            },
          ],
        },
      }
    );

    const certificate = new acm.Certificate(this, "Certificate", {
      domainName,
      validation: acm.CertificateValidation.fromDns(),
    });

    new cloudfront.Distribution(this, "Distribution", {
      domainNames: [domainName],
      certificate,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(fileNodesBucket),
        // trustedKeyGroups: [keyGroup],
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        responseHeadersPolicy,
      },
    });
  }
}
