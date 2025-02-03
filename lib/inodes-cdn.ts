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

    const bucket = props.inodesBucket.bucket;
    const encodedKey = process.env.CLOUDFRONT_SIGNER_PUBKEY;

    if (!encodedKey) throw new Error("Missing CLOUDFRONT_SIGNER_PUBKEY");

    const pubKey = new cloudfront.PublicKey(this, "PubKey", { encodedKey });

    const keyGroup = new cloudfront.KeyGroup(this, "KeyGroup", {
      items: [pubKey],
    });

    new cloudfront.Distribution(this, "Distribution", {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        trustedKeyGroups: [keyGroup],
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
      },
    });
  }
}
