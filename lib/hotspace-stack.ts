import * as cdk from "aws-cdk-lib";
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

    const { backendGroup, denoDeployKvBackupUser } = new Identity(
      this,
      "Identity"
    );

    const { fileNodesBucket } = new FileNodesStorage(this, "FileNodesStorage", {
      isProd,
      backendGroup,
    });

    new DenoKvBackup(this, "DenoKvBackup", {
      denoDeployKvBackupUser,
    });

    if (isProd) new AssetsCdn(this, "AssetsCdn");

    new FileNodesCdn(this, "FileNodesCdn", {
      isProd,
      fileNodesBucket,
    });

    new FileNodesTranscode(this, "FileNodesTranscode", {
      isProd,
      fileNodesBucket,
      backendGroup,
    });
  }
}
