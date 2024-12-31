import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { InodesUpload } from "./inodes-upload";

interface Props {
  inodesUpload: InodesUpload;
}

export class UsersAndGroups extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const githubCdkDeploymentUser = new iam.User(
      this,
      "GithubCdkDeploymentUser",
      {
        userName: "github-cdk-deployment-user",
      }
    );

    const defaultBackendUser = new iam.User(this, "DefaultBackendUser", {
      userName: "default-backend-user",
    });

    const cdkDeploymentGroup = new iam.Group(this, "CdkDeploymentGroup", {
      groupName: "cdk-deployment",
    });

    cdkDeploymentGroup.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AdministratorAccess")
    );

    cdkDeploymentGroup.addUser(githubCdkDeploymentUser);

    const backendGroup = new iam.Group(this, "BackendGroup", {
      groupName: "backend",
    });

    backendGroup.attachInlinePolicy(props.inodesUpload.policy);

    backendGroup.addUser(defaultBackendUser);
  }
}
