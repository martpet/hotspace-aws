import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export class InodesBucket extends Construct {
  policy: iam.Policy;
  bucket: s3.Bucket;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const isProd = cdk.Stage.of(this)?.stageName === "Prod";

    const bucketName = isProd
      ? "uploads-hotspace-lol"
      : "uploads-dev-hotspace-lol";

    const allowedOrigins = isProd
      ? ["https://hotspace.lol"]
      : ["https://hotspace.local"];

    this.bucket = new s3.Bucket(this, "Bucket", {
      bucketName,
      enforceSSL: true,
      transferAcceleration: true,
      cors: [
        {
          allowedOrigins,
          allowedHeaders: ["*"],
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.DELETE,
            s3.HttpMethods.HEAD,
          ],
          exposedHeaders: ["ETag"],
        },
      ],
      lifecycleRules: [
        {
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
        },
      ],
    });

    this.policy = new iam.Policy(this, "Policy", {
      policyName: "inodes-upload-policy",
      statements: [
        new iam.PolicyStatement({
          actions: [
            "s3:PutObject",
            "s3:GetObject",
            "s3:ListBucket",
            "s3:DeleteObject",
          ],
          resources: [this.bucket.bucketArn, `${this.bucket.bucketArn}/*`],
        }),
      ],
    });
  }
}
