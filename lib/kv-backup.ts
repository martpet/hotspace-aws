import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export class KvBackup extends Construct {
  policy: iam.Policy;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const bucket = new s3.Bucket(this, "Bucket");

    this.policy = new iam.Policy(this, "Policy", {
      policyName: "kv-backup-policy",
      statements: [
        new iam.PolicyStatement({
          actions: ["s3:PutObject"],
          resources: [bucket.bucketArn, `${bucket.bucketArn}/*`],
        }),
      ],
    });
  }
}
