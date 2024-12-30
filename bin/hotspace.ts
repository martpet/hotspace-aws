import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { DevStage } from "../lib/dev-stage";
import { ProdStage } from "../lib/prod-stage";

const app = new cdk.App();

new ProdStage(app, "Prod", {
  env: {
    account: process.env.AWS_PROD_ACCOUNT,
    region: process.env.AWS_REGION,
  },
});

new DevStage(app, "Dev", {
  env: {
    account: process.env.AWS_DEV_ACCOUNT,
    region: process.env.AWS_REGION,
  },
});
