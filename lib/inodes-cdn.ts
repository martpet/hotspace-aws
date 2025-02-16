import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import { Construct } from "constructs";
import { InodesBucket } from "./inodes-bucket";

interface Props {
  inodesBucket: InodesBucket;
}

export class InodesCdn extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const isProd = cdk.Stage.of(this)?.stageName === "Prod";
    const bucket = props.inodesBucket.bucket;
    const encodedKey = process.env.CLOUDFRONT_SIGNER_PUBKEY;

    if (!encodedKey) {
      throw new Error("Missing CLOUDFRONT_SIGNER_PUBKEY");
    }

    const domainName = isProd
      ? "uploads.hotspace.lol"
      : "uploads.dev.hotspace.lol";

    const pubKey = new cloudfront.PublicKey(this, "PubKey", { encodedKey });
    const keyGroup = new cloudfront.KeyGroup(this, "KeyGroup", {
      items: [pubKey],
    });

    const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(
      this,
      "RespHeadersPolicy",
      {
        customHeadersBehavior: {
          customHeaders: [
            {
              header: "No-Vary-Search",
              value: "params",
              override: false,
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
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        // Uncomment to disable public access:
        // trustedKeyGroups: [keyGroup],
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
        responseHeadersPolicy,
      },
      domainNames: [domainName],
      certificate,
    });
  }
}
