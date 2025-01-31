import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { HotspaceStack } from "./hotspace-stack";

export class ProdStage extends cdk.Stage {
  constructor(scope: Construct, id: string, props?: cdk.StageProps) {
    super(scope, id, props);

    new HotspaceStack(this, "HotspaceStack");
  }
}
