import * as cdk from "aws-cdk-lib";
import * as events from "aws-cdk-lib/aws-events";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import * as path from "path";

const IMAGE_PROCESSING_EVENT_SOURCE = "hotspace.image-processing";
const SQS_QUEUE_MAX_RECEIVE_COUNT = 3;

interface Props {
  fileNodesBucket: s3.Bucket;
  appEventBus: cdk.aws_events.EventBus;
  webhookEventTarget: events.IRuleTarget;
  backendGroup: iam.Group;
}

export class ImageProcessing extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const { appEventBus, webhookEventTarget, fileNodesBucket, backendGroup } =
      props;

    const deadLetterQueue = new sqs.Queue(this, "DeadLetterQueue", {
      retentionPeriod: cdk.Duration.days(14),
    });

    const queue = new sqs.Queue(this, "Queue", {
      visibilityTimeout: cdk.Duration.minutes(1.5),
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: SQS_QUEUE_MAX_RECEIVE_COUNT,
      },
    });

    const sharpLayer = new lambda.LayerVersion(this, "SharpLayer", {
      code: lambda.Code.fromAsset(path.join(__dirname, "sharp-layer.zip")),
    });

    const fn = new lambda.Function(this, "Lambda", {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "/lambda")),
      layers: [sharpLayer],
      timeout: cdk.Duration.minutes(1),
      memorySize: 2048,
      events: [new lambdaEventSources.SqsEventSource(queue, { batchSize: 1 })],
      environment: {
        BUCKET_NAME: fileNodesBucket.bucketName,
        EVENT_BUS_NAME: appEventBus.eventBusName,
        IMAGE_PROCESSING_EVENT_SOURCE,
        SQS_QUEUE_MAX_RECEIVE_COUNT: SQS_QUEUE_MAX_RECEIVE_COUNT.toString(),
      },
    });

    new events.Rule(this, "EventRule", {
      targets: [webhookEventTarget],
      eventBus: appEventBus,
      eventPattern: {
        source: [IMAGE_PROCESSING_EVENT_SOURCE],
      },
    });

    queue.grantSendMessages(backendGroup);
    fileNodesBucket.grantReadWrite(fn);
    appEventBus.grantPutEventsTo(fn);
  }
}
