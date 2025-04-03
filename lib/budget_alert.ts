import * as budgets from "aws-cdk-lib/aws-budgets";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as sns from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";

interface Props {
  isProd: boolean;
  webhookDestination: events.ApiDestination;
}

export class BudgetAlert extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const { isProd, webhookDestination } = props;
    const email = process.env.ADMIN_EMAIL;
    const phone = process.env.ADMIN_PHONE;

    if (!email) throw new Error("Missing ADMIN_EMAIL env var");
    if (!phone) throw new Error("Missing ADMIN_PHONE env var");

    if (isProd) {
      const webhookTarget = new targets.ApiDestination(webhookDestination);
      new events.Rule(this, "Rule", {
        targets: [webhookTarget],
        eventPattern: {
          source: ["aws.budgets"],
          detailType: ["AWS Budget Notification"],
        },
      });
    }

    const budgetTopic = new sns.Topic(this, "Topic");

    new sns.Subscription(this, "EmailSub", {
      topic: budgetTopic,
      protocol: sns.SubscriptionProtocol.EMAIL,
      endpoint: email,
    });

    new sns.Subscription(this, "SMSSub", {
      topic: budgetTopic,
      protocol: sns.SubscriptionProtocol.SMS,
      endpoint: phone,
    });

    new budgets.CfnBudget(this, "Budget", {
      budget: {
        budgetName: "AppBudget",
        budgetLimit: {
          amount: 50,
          unit: "USD",
        },
        timeUnit: "MONTHLY",
        budgetType: "COST",
      },
      notificationsWithSubscribers: [
        {
          notification: {
            comparisonOperator: "GREATER_THAN",
            notificationType: "ACTUAL",
            threshold: 100,
            thresholdType: "PERCENTAGE",
          },
          subscribers: [
            {
              subscriptionType: "SNS",
              address: budgetTopic.topicArn,
            },
          ],
        },
      ],
    });
  }
}
