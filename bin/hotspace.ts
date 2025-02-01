import * as cdk from "aws-cdk-lib";
import "source-map-support/register";
import { DevStage } from "../lib/dev-stage";
import { ProdStage } from "../lib/prod-stage";

const app = new cdk.App();

new ProdStage(app, "Prod", {
  env: {
    account: process.env.AWS_PROD_ACCOUNT,
  },
});

new DevStage(app, "Dev", {
  env: {
    account: process.env.AWS_DEV_ACCOUNT,
  },
});
