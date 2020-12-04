import * as ec2 from '@aws-cdk/aws-ec2';
import * as efs from '@aws-cdk/aws-efs';
import * as eks from '@aws-cdk/aws-eks';
// import * as iam from '@aws-cdk/aws-iam';
import * as kms from '@aws-cdk/aws-kms';
import { App, CfnOutput, Construct, Stack, StackProps } from '@aws-cdk/core';

export class EksEfsStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'Vpc');

    const secretsEncryptionKey = new kms.Key(this, 'SecretsEncryptionKey', {
      alias: '/eks/secrets',
    });

    const efsKey = new kms.Key(this, 'EfsKey', {
      alias: '/efs/key',
    });
    // efsKey.addToResourcePolicy(new iam.PolicyStatement({
    //   principals: [new iam.ArnPrincipal('arn:aws:sts::642928367768:assumed-role/Admin/dwsung-Isengard')],
    //   actions: [
    //     'kms:Encrypt',
    //     'kms:Decrypt',
    //     'kms:ReEncrypt',
    //     'kms:GenerateDataKey*',
    //     'kms:CreateGrant',
    //     'kms:DescribeKey',
    //     'kms:ListAliases',
    //   ],
    //   resources: ['*'],
    // }));

    const cluster = new eks.Cluster(this, 'Cluster', {
      version: eks.KubernetesVersion.V1_15,
      vpc,
      secretsEncryptionKey,
      defaultCapacity: 1,
    });

    const fileSystem = new efs.FileSystem(this, 'FileSystem', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE },
      encrypted: true,
      kmsKey: efsKey,
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
    });
    const clusterSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(this, 'ClusterSecurityGroup', cluster.clusterSecurityGroupId);
    fileSystem.connections.allowFrom(clusterSecurityGroup, ec2.Port.tcp(efs.FileSystem.DEFAULT_PORT));

    new CfnOutput(this, 'ClusterName', {
      value: cluster.clusterName,
    });
    new CfnOutput(this, 'ClusterSecurityGroupId', {
      value: cluster.clusterSecurityGroupId,
    });
    new CfnOutput(this, 'EfsSystemId', {
      value: fileSystem.fileSystemId,
    });

  }
}

// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

new EksEfsStack(app, 'eks-efs-stack-dev', { env: devEnv });
// new MyStack(app, 'my-stack-prod', { env: prodEnv });

app.synth();
