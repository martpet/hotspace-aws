import * as cdk from "aws-cdk-lib";
import * as events from "aws-cdk-lib/aws-events";
import { Construct } from "constructs";
import { AssetsCdn } from "./assets-cdn";
import { DenoKvBackup } from "./deno-kv-backup";
import { FileNodesCdn } from "./file-nodes-cdn";
import { FileNodesStorage } from "./file-nodes-storage";
import { FileNodesTranscode } from "./file-nodes-transcode";
import { Identity } from "./identity";
import { ImageProcessing } from "./image-processing/image-processing";
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

    new FileNodesTranscode(this, "FileNodesTranscode", {
      fileNodesBucket: fileNodesStorage.bucket,
      webhookEventTarget: webhook.eventTarget,
      backendGroup: identity.backendGroup,
    });

    new ImageProcessing(this, "ImageProcessing", {
      fileNodesBucket: fileNodesStorage.bucket,
      appEventBus,
      webhookEventTarget: webhook.eventTarget,
      backendGroup: identity.backendGroup,
    });
  }
}
