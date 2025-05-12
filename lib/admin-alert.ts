import * as iam from "aws-cdk-lib/aws-iam";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import { Construct } from "constructs";

interface Props {
  backendGroup: iam.Group;
}

export class AdminAlert extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const { backendGroup } = props;

    if (!process.env.ADMIN_PHONE) {
      throw new Error("Missing ADMIN_PHONE env var");
    }

    const topic = new sns.Topic(this, "Topic");

    topic.grantPublish(backendGroup);

    topic.addSubscription(
      new subscriptions.SmsSubscription(process.env.ADMIN_PHONE)
    );
  }
}
