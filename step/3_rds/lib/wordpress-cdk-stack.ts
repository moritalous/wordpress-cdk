import { aws_ec2, aws_iam, aws_rds, CfnOutput, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class WordpressCdkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // *****
    // VPC
    // *****

    const vpc = new aws_ec2.Vpc(this, 'VPC', {
      natGateways: 0
    })

    // *****
    // EC2
    // *****

    const ec2_sg = new aws_ec2.SecurityGroup(this, 'ec2-sg', {
      vpc: vpc,
    })
    ec2_sg.addIngressRule(aws_ec2.Peer.anyIpv4(), aws_ec2.Port.tcp(80))

    const ec2_role = new aws_iam.Role(this, 'wordpress-role', {
      assumedBy: new aws_iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    })

    const ec2_user_data = new aws_ec2.MultipartUserData()
    const ec2_command = aws_ec2.UserData.forLinux()
    ec2_user_data.addUserDataPart(ec2_command, aws_ec2.MultipartBody.SHELL_SCRIPT, true)
    ec2_command.addCommands(
      "#!/bin/bash",
      "",
      "yum update -y",
      "amazon-linux-extras install -y lamp-mariadb10.2-php7.2 php7.2",
      "yum install -y httpd",
      "systemctl enable httpd",
      "systemctl start httpd",
      "wget https://wordpress.org/latest.tar.gz",
      "tar -xzf latest.tar.gz",
      "cp -r wordpress/* /var/www/html/",
      "chown -R apache /var/www",
      "chgrp -R apache /var/www",
      "chmod 2775 /var/www",
      "find /var/www -type d -exec sudo chmod 2775 {} \;",
      "find /var/www -type f -exec sudo chmod 0644 {} \;",
    )

    const ec2 = new aws_ec2.Instance(this, 'wordpress', {
      vpc: vpc,
      vpcSubnets: { subnetType: aws_ec2.SubnetType.PUBLIC },
      securityGroup: ec2_sg,

      instanceType: aws_ec2.InstanceType.of(aws_ec2.InstanceClass.T3, aws_ec2.InstanceSize.SMALL),
      machineImage: new aws_ec2.AmazonLinuxImage({ generation: aws_ec2.AmazonLinuxGeneration.AMAZON_LINUX_2 }),

      role: ec2_role,

      userData: ec2_user_data
    })

    // *****
    // RDS
    // *****

    const rds = new aws_rds.DatabaseInstance(this, 'Database', {
      vpc: vpc,
      vpcSubnets: {
        subnetType: aws_ec2.SubnetType.PRIVATE_ISOLATED
      },

      multiAz: true,

      engine: aws_rds.DatabaseInstanceEngine.mysql({
        version: aws_rds.MysqlEngineVersion.VER_8_0_28
      }),
      instanceType: aws_ec2.InstanceType.of(aws_ec2.InstanceClass.BURSTABLE4_GRAVITON, aws_ec2.InstanceSize.LARGE),

      databaseName: "wordpress",

      allocatedStorage: 20
    })

    rds.connections.allowDefaultPortFrom(ec2_sg)
    rds.applyRemovalPolicy(RemovalPolicy.DESTROY)

    new CfnOutput(this, 'ec2-output', {
      value: ec2.instancePublicIp
    })
    new CfnOutput(this, 'rds-output', {
      value: rds.dbInstanceEndpointAddress,
    })
    new CfnOutput(this, 'secretsmanager-output', {
      value: rds.secret!.secretName
    })

  }
}
