import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { HotspaceStack } from "./hotspace-stack";

export class ProdStage extends cdk.Stage {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    new HotspaceStack(this, "Hotspace");
  }
}
