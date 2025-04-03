import * as events from "aws-cdk-lib/aws-events";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { APP_DOMAIN, WEBHOOKS_PATH } from "./consts";

export class Webhook extends Construct {
  destination: events.ApiDestination;
  secret: secretsmanager.Secret;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const secret = new secretsmanager.Secret(this, "Secret");

    const connection = new events.Connection(this, "Connection", {
      authorization: events.Authorization.apiKey(
        "x-api-key",
        secret.secretValue
      ),
    });

    const destination = new events.ApiDestination(this, "Destination", {
      connection,
      endpoint: `https://${APP_DOMAIN}${WEBHOOKS_PATH}`,
      httpMethod: events.HttpMethod.POST,
    });

    this.destination = destination;
    this.secret = secret;
  }
}
