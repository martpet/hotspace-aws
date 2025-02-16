import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { InodesBucket } from "./inodes-bucket";
import { InodesCdn } from "./inodes-cdn";
import { KvBackup } from "./kv-backup";
import { UsersAndGroups } from "./users-and-groups";

export class HotspaceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const inodesBucket = new InodesBucket(this, "InodesBucket");
    const kvBackup = new KvBackup(this, "KvBackup");
    new InodesCdn(this, "InodesCdn", { inodesBucket });
    new UsersAndGroups(this, "UsersAndGroups", { inodesBucket, kvBackup });
  }
}
