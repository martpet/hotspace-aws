import { SecretValue, Stack } from "aws-cdk-lib";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { APP_DOMAIN, WEBHOOKS_PATH } from "./consts";

interface Props {
  isProd: boolean;
  fileNodesBucket: s3.Bucket;
  backendGroup: iam.Group;
  webhooksSecretValue: SecretValue;
}

export class FileNodesTranscode extends Construct {
  policy: iam.Policy;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const { isProd, fileNodesBucket, backendGroup, webhooksSecretValue } =
      props;
    const { region, account } = Stack.of(this);

    backendGroup.addToPolicy(
      new iam.PolicyStatement({
        actions: ["mediaconvert:CreateJob"],
        resources: [`arn:aws:mediaconvert:${region}:${account}:queues/Default`],
      })
    );

    backendGroup.addToPolicy(
      new iam.PolicyStatement({
        actions: ["mediaconvert:CancelJob"],
        resources: [`arn:aws:mediaconvert:${region}:${account}:jobs/*`],
      })
    );

    const mediaConvertRole = new iam.Role(this, "MediaConvertRole", {
      assumedBy: new iam.ServicePrincipal("mediaconvert.amazonaws.com"),
    });

    mediaConvertRole.grantPassRole(backendGroup);
    fileNodesBucket.grantReadWrite(mediaConvertRole);

    // =====================
    // Event Notification
    // =====================

    let eventTarget;

    if (isProd) {
      const connection = new events.Connection(this, "BackendConnection", {
        authorization: events.Authorization.apiKey(
          "x-api-key",
          webhooksSecretValue
        ),
      });

      const destination = new events.ApiDestination(
        this,
        "BackendDestination",
        {
          connection,
          endpoint: `https://${APP_DOMAIN}${WEBHOOKS_PATH}`,
          httpMethod: events.HttpMethod.POST,
        }
      );

      eventTarget = new targets.ApiDestination(destination);
    } else {
      const lambdaProxy = new lambda.Function(this, "NotificationLambdaProxy", {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: "index.handler",
        environment: { API_KEY: webhooksSecretValue.unsafeUnwrap() },
        code: lambda.Code.fromInline(`
          exports.handler = async function(event) {
            const resp = await fetch(event.detail.userMetadata.devUrl + "${WEBHOOKS_PATH}", {
              body: JSON.stringify(event),
              method: "post",
              headers: { 'x-api-key': process.env.API_KEY }
            })
            if (resp.status >= 500) throw new Error();
          };
        `),
      });
      eventTarget = new targets.LambdaFunction(lambdaProxy);
    }

    new events.Rule(this, "ProgressEventRule", {
      targets: [eventTarget],
      eventPattern: {
        source: ["aws.mediaconvert"],
        detailType: ["MediaConvert Job State Change"],
        detail: { status: ["STATUS_UPDATE"] },
      },
    });

    new events.Rule(this, "CompleteEventRule", {
      targets: [eventTarget],
      eventPattern: {
        source: ["aws.mediaconvert"],
        detailType: ["MediaConvert Job State Change"],
        detail: { status: ["COMPLETE"] },
      },
    });

    new events.Rule(this, "ErrorEventRule", {
      targets: [eventTarget],
      eventPattern: {
        source: ["aws.mediaconvert"],
        detailType: ["MediaConvert Job State Change"],
        detail: { status: ["ERROR"] },
      },
    });
  }
}
