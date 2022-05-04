import { aws_autoscaling, aws_certificatemanager, aws_cloudfront, aws_cloudfront_origins, aws_ec2, aws_efs, aws_elasticloadbalancingv2, aws_elasticloadbalancingv2_targets, aws_iam, aws_rds, aws_route53, aws_route53_targets, CfnOutput, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
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
    // EFS
    // *****

    const efs = new aws_efs.FileSystem(this, 'efs', {
      vpc: vpc,
      removalPolicy: RemovalPolicy.DESTROY,
    })

    // *****
    // EC2
    // *****

    const ec2_sg = new aws_ec2.SecurityGroup(this, 'ec2-sg', {
      vpc: vpc,
    })
    // ec2_sg.addIngressRule(aws_ec2.Peer.anyIpv4(), aws_ec2.Port.tcp(80))

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
      // efs
      "yum install -y amazon-efs-utils",
      "yum install -y nfs-utils",
      "file_system_id_1=" + efs.fileSystemId,
      "efs_mount_point_1=/var/www/html",
      "mkdir -p \"${efs_mount_point_1}\"",
      "test -f \"/sbin/mount.efs\" && echo \"${file_system_id_1}:/ ${efs_mount_point_1} efs defaults,_netdev\" >> /etc/fstab || " +
      "echo \"${file_system_id_1}.efs." + Stack.of(this).region + ".amazonaws.com:/ ${efs_mount_point_1} nfs4 nfsvers=4.1,rsize=1048576,wsize=1048576,hard,timeo=600,retrans=2,noresvport,_netdev 0 0\" >> /etc/fstab",
      "mount -a -t efs,nfs4 defaults",
      // efs
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

    efs.connections.allowDefaultPortFrom(ec2)

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

    // *****
    // EC2 Auto Scaling
    // *****

    const asg_user_data = new aws_ec2.MultipartUserData()
    const asg_command = aws_ec2.UserData.forLinux()
    asg_user_data.addUserDataPart(asg_command, aws_ec2.MultipartBody.SHELL_SCRIPT, true)
    asg_command.addCommands(
      "#!/bin/bash",
      "",
      "yum update -y",
      "amazon-linux-extras install -y lamp-mariadb10.2-php7.2 php7.2",
      "yum install -y httpd",
      // efs
      "yum install -y amazon-efs-utils",
      "yum install -y nfs-utils",
      "file_system_id_1=" + efs.fileSystemId,
      "efs_mount_point_1=/var/www/html",
      "mkdir -p \"${efs_mount_point_1}\"",
      "test -f \"/sbin/mount.efs\" && echo \"${file_system_id_1}:/ ${efs_mount_point_1} efs defaults,_netdev\" >> /etc/fstab || " +
      "echo \"${file_system_id_1}.efs." + Stack.of(this).region + ".amazonaws.com:/ ${efs_mount_point_1} nfs4 nfsvers=4.1,rsize=1048576,wsize=1048576,hard,timeo=600,retrans=2,noresvport,_netdev 0 0\" >> /etc/fstab",
      "mount -a -t efs,nfs4 defaults",
      // efs
      "systemctl enable httpd",
      "systemctl start httpd",
      "chown -R apache /var/www",
      "chgrp -R apache /var/www",
      "chmod 2775 /var/www",
      "find /var/www -type d -exec sudo chmod 2775 {} \;",
      "find /var/www -type f -exec sudo chmod 0644 {} \;",
    )

    const asg = new aws_autoscaling.AutoScalingGroup(this, 'asg', {
      vpc: vpc,
      vpcSubnets: { subnetType: aws_ec2.SubnetType.PUBLIC },
      securityGroup: ec2_sg,

      instanceType: aws_ec2.InstanceType.of(aws_ec2.InstanceClass.T3, aws_ec2.InstanceSize.SMALL),
      machineImage: new aws_ec2.AmazonLinuxImage({ generation: aws_ec2.AmazonLinuxGeneration.AMAZON_LINUX_2 }),

      role: ec2_role,

      userData: asg_user_data,

      minCapacity: 1,
      maxCapacity: 2,
      desiredCapacity: 2,

      spotPrice: "0.01"
    })

    efs.connections.allowDefaultPortFrom(asg)

    // *****
    // Route 53
    // *****

    const hostedzone = aws_route53.HostedZone.fromHostedZoneAttributes(this, 'hostedzone', {
      hostedZoneId: 'Z0364500207RRL1KGDBUZ',
      zoneName: 'wordpress-cdk.tk'
    })

    // *****
    // Certificate Manager
    // *****

    const cloudfront_cert = new aws_certificatemanager.DnsValidatedCertificate(this, 'cloudfront_cert', {
      hostedZone: hostedzone,
      domainName: 'www.wordpress-cdk.tk',
      region: 'us-east-1'
    })

    const elb_cert = new aws_certificatemanager.Certificate(this, 'elb_cert', {
      domainName: 'elb.wordpress-cdk.tk',
      validation: aws_certificatemanager.CertificateValidation.fromDns(hostedzone)
    })

    // *****
    // CloudFront
    // *****

    const cloudfront = new aws_cloudfront.Distribution(this, 'cloudfront', {
      defaultBehavior: {
        origin: new aws_cloudfront_origins.HttpOrigin("elb.wordpress-cdk.tk"),
        allowedMethods: aws_cloudfront.AllowedMethods.ALLOW_ALL,
        cachedMethods: aws_cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        viewerProtocolPolicy: aws_cloudfront.ViewerProtocolPolicy.ALLOW_ALL,
        cachePolicy: aws_cloudfront.CachePolicy.CACHING_OPTIMIZED,
        originRequestPolicy: aws_cloudfront.OriginRequestPolicy.ALL_VIEWER,
      },
      domainNames: ['www.wordpress-cdk.tk'],
      certificate: cloudfront_cert
    })

    // *****
    // Elastic Load Balancing
    // *****

    const elb_sg = new aws_ec2.SecurityGroup(this, 'elb-sg', {
      vpc: vpc,
    })

    const elb = new aws_elasticloadbalancingv2.ApplicationLoadBalancer(this, 'elb', {
      vpc: vpc,
      securityGroup: elb_sg,
      internetFacing: true,
    })

    const elb_targetgroup = new aws_elasticloadbalancingv2.ApplicationTargetGroup(this, 'targetgroup', {
      vpc: vpc,
      targets: [new aws_elasticloadbalancingv2_targets.InstanceTarget(ec2)],
      port: 80,
      healthCheck: { enabled: true, healthyHttpCodes: "200-399" },
    })

    asg.attachToApplicationTargetGroup(elb_targetgroup)

    ec2_sg.addIngressRule(aws_ec2.Peer.securityGroupId(elb_sg.securityGroupId), aws_ec2.Port.tcp(80))

    const listener_http = elb.addListener('Listener_http', {
      port: 80,
      open: true,
      defaultTargetGroups: [elb_targetgroup],
    })

    const listener_https = elb.addListener('Listener_https', {
      port: 443,
      open: true,
      certificates: [elb_cert],
      defaultTargetGroups: [elb_targetgroup],
    })

    new aws_elasticloadbalancingv2.ApplicationListenerRule(this, 'listener_http_rule', {
      listener: listener_http,
      priority: 10,
      conditions: [
        aws_elasticloadbalancingv2.ListenerCondition.hostHeaders([elb.loadBalancerDnsName])
      ],
      action: aws_elasticloadbalancingv2.ListenerAction.redirect({
        host: 'elb.wordpress-cdk.tk',
        permanent: true,
      })
    })

    new aws_elasticloadbalancingv2.ApplicationListenerRule(this, 'listener_https_rule', {
      listener: listener_https,
      priority: 10,
      conditions: [
        aws_elasticloadbalancingv2.ListenerCondition.hostHeaders([elb.loadBalancerDnsName])
      ],
      action: aws_elasticloadbalancingv2.ListenerAction.redirect({
        host: 'elb.wordpress-cdk.tk',
        permanent: true,
      })
    })

    // *****
    // Route 53
    // *****

    new aws_route53.ARecord(this, 'elb-domain', {
      zone: hostedzone,
      recordName: 'elb',
      target: aws_route53.RecordTarget.fromAlias(new aws_route53_targets.LoadBalancerTarget(elb)),
    });

    new aws_route53.ARecord(this, 'cloudfront-domain', {
      zone: hostedzone,
      recordName: 'www',
      target: aws_route53.RecordTarget.fromAlias(new aws_route53_targets.CloudFrontTarget(cloudfront)),
    });

    new CfnOutput(this, 'ec2-output', {
      value: ec2.instancePublicIp
    })
    new CfnOutput(this, 'rds-output', {
      value: rds.dbInstanceEndpointAddress,
    })
    new CfnOutput(this, 'secretsmanager-output', {
      value: rds.secret!.secretName
    })
    new CfnOutput(this, 'elb-output', {
      value: elb.loadBalancerDnsName
    })
    new CfnOutput(this, 'cloudfront-output', {
      value: cloudfront.distributionDomainName
    })

  }
}
