import * as cdk from "aws-cdk-lib";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { AssetsCdn } from "./assets-cdn";
import { DenoKvBackup } from "./deno-kv-backup";
import { FileNodesCdn } from "./file-nodes-cdn";
import { FileNodesStorage } from "./file-nodes-storage";
import { FileNodesTranscode } from "./file-nodes-transcode";
import { Identity } from "./identity";

export class HotspaceStack extends cdk.Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const isProd = cdk.Stage.of(this)?.stageName === "Prod";

    const webhooksSecret = new secretsmanager.Secret(this, "WebhooksApiKey");

    const identity = new Identity(this, "Identity");

    const fileNodesStorage = new FileNodesStorage(this, "FileNodesStorage", {
      isProd,
      backendGroup: identity.backendGroup,
    });

    new DenoKvBackup(this, "DenoKvBackup", {
      denoDeployKvBackupUser: identity.denoDeployKvBackupUser,
    });

    if (isProd) new AssetsCdn(this, "AssetsCdn");

    new FileNodesCdn(this, "FileNodesCdn", {
      isProd,
      fileNodesBucket: fileNodesStorage.bucket,
      fileNodesBucketCors: fileNodesStorage.bucketCors,
    });

    new FileNodesTranscode(this, "FileNodesTranscode", {
      isProd,
      fileNodesBucket: fileNodesStorage.bucket,
      backendGroup: identity.backendGroup,
      webhooksSecretValue: webhooksSecret.secretValue,
    });
  }
}
