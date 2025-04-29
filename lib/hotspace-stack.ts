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
import { VideoProcessor } from "./video-processor";
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

    new VideoProcessor(this, "VideoProcessor", {
      fileNodesBucket: fileNodesStorage.bucket,
      webhookEventTarget: webhook.eventTarget,
      backendGroup: identity.backendGroup,
    });

    new MediaProcessor(this, "SharpProcessor", {
      lambdaPath: path.join(__dirname, "/media-processors/sharp/lambda"),
      lambdaLayerPath: path.join(
        __dirname,
        "/media-processors/sharp/lambda-layer.zip"
      ),
      lambdaMemorySize: 2048,
      lambdaTimeout: 1,
      sqsVisibilityTimeout: 1.5,
      eventSource: "hotspace.sharp-processor",
      eventRuleTarget: webhook.eventTarget,
      eventBus: appEventBus,
      bucket: fileNodesStorage.bucket,
      backendGroup: identity.backendGroup,
    });

    new MediaProcessor(this, "LibreProcessor", {
      lambdaDockerPath: path.join(__dirname, "/media-processors/libre"),
      lambdaMemorySize: 3000,
      lambdaEphemeralStorageSize: 1000,
      lambdaTimeout: 1.5,
      sqsVisibilityTimeout: 2,
      eventSource: "hotspace.libre-processor",
      eventRuleTarget: webhook.eventTarget,
      eventBus: appEventBus,
      bucket: fileNodesStorage.bucket,
      backendGroup: identity.backendGroup,
    });

    new MediaProcessor(this, "PandocProcessor", {
      lambdaPath: path.join(__dirname, "/media-processors/pandoc/lambda"),
      lambdaLayerPath: path.join(
        __dirname,
        "/media-processors/pandoc/lambda-layer.zip"
      ),
      lambdaMemorySize: 2048,
      lambdaTimeout: 1,
      sqsVisibilityTimeout: 1.5,
      eventSource: "hotspace.pandoc-processor",
      eventRuleTarget: webhook.eventTarget,
      eventBus: appEventBus,
      bucket: fileNodesStorage.bucket,
      backendGroup: identity.backendGroup,
    });
  }
}
