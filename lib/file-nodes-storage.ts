import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { APP_DOMAIN } from "./consts";

interface Props {
  isProd: boolean;
  backendGroup: iam.Group;
}

export class FileNodesStorage extends Construct {
  fileNodesBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const { isProd, backendGroup } = props;

    const bucketName = isProd
      ? "uploads-hotspace-lol"
      : "uploads-dev-hotspace-lol";

    const bucket = new s3.Bucket(this, "Bucket", {
      bucketName,
      enforceSSL: true,
      transferAcceleration: true,
    });

    const allowedOrigins = isProd
      ? [`https://${APP_DOMAIN}`]
      : ["https://hotspace.local"];

    bucket.addCorsRule({
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
    });

    bucket.addLifecycleRule({
      abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
    });

    bucket.grantReadWrite(backendGroup);

    this.fileNodesBucket = bucket;
  }
}
