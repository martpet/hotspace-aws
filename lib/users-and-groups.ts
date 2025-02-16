import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { InodesBucket } from "./inodes-bucket";
import { KvBackup } from "./kv-backup";

interface Props {
  inodesBucket: InodesBucket;
  kvBackup: KvBackup;
}

export class UsersAndGroups extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const cdkDeploymentGroup = new iam.Group(this, "CdkDeploymentGroup", {
      groupName: "cdk-deployment",
    });

    cdkDeploymentGroup.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AdministratorAccess")
    );

    const backendGroup = new iam.Group(this, "BackendGroup", {
      groupName: "backend",
    });

    backendGroup.attachInlinePolicy(props.inodesBucket.policy);

    const githubUser = new iam.User(this, "GithubUser", {
      userName: "github-user",
    });

    const denoDeployUser = new iam.User(this, "DenoDeployUser", {
      userName: "deno-deploy-user",
    });

    const denoDeployKvBackupUser = new iam.User(this, "DenoDeployKvBackup", {
      userName: "deno-deploy-kv-backup-user",
    });

    denoDeployKvBackupUser.attachInlinePolicy(props.kvBackup.policy);

    githubUser.addToGroup(cdkDeploymentGroup);
    denoDeployUser.addToGroup(backendGroup);
  }
}
