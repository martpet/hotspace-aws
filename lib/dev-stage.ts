import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { Stage } from "aws-cdk-lib";
import { HotspaceStack } from "./hotspace-stack";

export class DevStage extends Stage {
  constructor(scope: Construct, id: string, props?: cdk.StageProps) {
    super(scope, id, props);

    new HotspaceStack(this, "HotspaceStack");
  }
}