import * as cdk from "aws-cdk-lib";

import { Construct } from "constructs";
import { InodesUpload } from "./inodes-upload";
import { UsersAndGroups } from "./users-and-groups";

export class HotspaceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const inodesUpload = new InodesUpload(this, "InodesUpload");

    new UsersAndGroups(this, "UsersAndGroups", { inodesUpload });
  }
}
