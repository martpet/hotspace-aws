import * as cdk from "aws-cdk-lib";
import * as events from "aws-cdk-lib/aws-events";
import { Construct } from "constructs";
import * as path from "path";
import { AssetsCdn } from "./assets-cdn";
import { DenoKvBackup } from "./deno-kv-backup";
import { FileNodesCdn } from "./file-nodes-cdn";
import { FileNodesStorage } from "./file-nodes-storage";
import { Identity } from "./identity";
import { MediaProcessor } from "./media-processor";
import { VideoProcessing } from "./video-processing";
import { Webhook } from "./webhook";

export class HotspaceStack extends cdk.Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const isProd = cdk.Stage.of(this)?.stageName === "Prod";

    const identity = new Identity(this, "Identity");

    const appEventBus = new events.EventBus(this, "AppEventBus");

    const webhook = new Webhook(this, "Webhook", {
      isProd,
    });

    const fileNodesStorage = new FileNodesStorage(this, "FileNodesStorage", {
      isProd,
      backendGroup: identity.backendGroup,
    });

    new DenoKvBackup(this, "DenoKvBackup", {
      denoDeployKvBackupUser: identity.denoDeployKvBackupUser,
    });

    if (isProd) {
      new AssetsCdn(this, "AssetsCdn");
    }

    new FileNodesCdn(this, "FileNodesCdn", {
      isProd,
      fileNodesBucket: fileNodesStorage.bucket,
      fileNodesBucketCors: fileNodesStorage.bucketCors,
    });

    new VideoProcessing(this, "VideoProcessing", {
      fileNodesBucket: fileNodesStorage.bucket,
      webhookEventTarget: webhook.eventTarget,
      backendGroup: identity.backendGroup,
    });

    new MediaProcessor(this, "ImageProcessor", {
      lambdaPath: path.join(__dirname, "/image-processor/lambda"),
      lambdaLayerPath: path.join(
        __dirname,
        "/image-processor/lambda-layer.zip"
      ),
      lambdaMemorySize: 2048,
      lambdaTimeout: 1,
      sqsVisibilityTimeout: 1.5,
      eventSource: "hotspace.image-processor",
      eventRuleTarget: webhook.eventTarget,
      eventBus: appEventBus,
      bucket: fileNodesStorage.bucket,
      backendGroup: identity.backendGroup,
    });
  }
}
