import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import { Policy } from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export class InodesUpload extends Construct {
  policy: Policy;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const bucket = new s3.Bucket(this, "Bucket", {
      enforceSSL: true,
      transferAcceleration: true,
      cors: [
        {
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
          ],
          exposedHeaders: ["ETag"],
        },
      ],
      lifecycleRules: [
        {
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
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
            "s3:AbortMultipartUpload",
            "s3:ListMultipartUploadParts",
          ],
          resources: [bucket.bucketArn, `${bucket.bucketArn}/*`],
        }),
      ],
    });
  }
}
