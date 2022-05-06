import { aws_certificatemanager, aws_ec2, aws_ecs, aws_ecs_patterns, aws_efs, aws_elasticloadbalancingv2, aws_rds, aws_route53, aws_secretsmanager, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class WordpressDockerCdkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = new aws_ec2.Vpc(this, 'vpc', { natGateways: 0 })

    const cluster = new aws_ecs.Cluster(this, 'cluster', {
      vpc: vpc,
      enableFargateCapacityProviders: true,
      defaultCloudMapNamespace: {
        name: 'my-wordpress'
      }
    })

    // *****
    // MySQL
    // *****

    const mysql_secret = new aws_secretsmanager.Secret(this, 'secret', {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'admin', dbname: 'wordpress' }),
        generateStringKey: 'password',
        excludePunctuation: true,
      }
    })

    const mysql_service = new aws_ecs.FargateService(this, 'mysql-service', {
      cluster: cluster,
      serviceName: 'mysql_service',

      taskDefinition: new aws_ecs.FargateTaskDefinition(this, 'mysql-task'),

      assignPublicIp: true,

      cloudMapOptions: {
        name: 'mysql'
      },

      capacityProviderStrategies: [
        {
          capacityProvider: "FARGATE_SPOT",
          base: 1,
          weight: 1,
        }
      ]
    })

    const mysql_container = mysql_service.taskDefinition.addContainer('mysql-container', {
      image: aws_ecs.ContainerImage.fromRegistry('mysql'),
      environment: {
        "MYSQL_RANDOM_ROOT_PASSWORD": 'yes',
      },
      secrets: {
        "MYSQL_USER": aws_ecs.Secret.fromSecretsManager(mysql_secret, 'username'),
        "MYSQL_PASSWORD": aws_ecs.Secret.fromSecretsManager(mysql_secret, 'password'),
        "MYSQL_DATABASE": aws_ecs.Secret.fromSecretsManager(mysql_secret, 'dbname'),
      },
      logging: aws_ecs.LogDriver.awsLogs({ streamPrefix: 'mysql-service' })
    })

    const mysql_efs = new aws_efs.FileSystem(this, 'mysql-efs', {
      vpc: vpc,
      removalPolicy: RemovalPolicy.DESTROY
    })

    mysql_service.taskDefinition.addVolume({
      name: 'mysql-efs',
      efsVolumeConfiguration: {
        fileSystemId: mysql_efs.fileSystemId
      }
    })

    mysql_container.addMountPoints({
      containerPath: '/var/lib/mysql',
      sourceVolume: 'mysql-efs',
      readOnly: false
    })

    mysql_efs.connections.allowDefaultPortFrom(mysql_service)

    // *****
    // WordPress
    // *****

    const hostedZone = aws_route53.HostedZone.fromHostedZoneAttributes(this, 'hostedzone', {
      hostedZoneId: 'Z0364500207RRL1KGDBUZ',
      zoneName: 'wordpress-cdk.tk'
    })

    const wordpress_service = new aws_ecs_patterns.ApplicationLoadBalancedFargateService(this, 'wordpress-service', {
      cluster: cluster,
      serviceName: 'wordpress-service',

      taskImageOptions: {
        image: aws_ecs.ContainerImage.fromRegistry('wordpress'),
        containerName: 'wordpress',
        containerPort: 80,

        environment: {
          "WORDPRESS_TABLE_PREFIX": "wp_",
          "WORDPRESS_DB_HOST": 'mysql.my-wordpress',
        },

        secrets: {
          "WORDPRESS_DB_USER": aws_ecs.Secret.fromSecretsManager(mysql_secret, 'username'),
          "WORDPRESS_DB_PASSWORD": aws_ecs.Secret.fromSecretsManager(mysql_secret, 'password'),
          "WORDPRESS_DB_NAME": aws_ecs.Secret.fromSecretsManager(mysql_secret, 'dbname'),
        },
      },

      domainZone: hostedZone,
      domainName: 'fargate.wordpress-cdk.tk',

      certificate: new aws_certificatemanager.Certificate(this, 'cert', {
        domainName: 'fargate.wordpress-cdk.tk',
        validation: aws_certificatemanager.CertificateValidation.fromDns(hostedZone)
      }),

      protocol: aws_elasticloadbalancingv2.ApplicationProtocol.HTTPS,
      redirectHTTP: true,

      assignPublicIp: true,

      cloudMapOptions: {
        name: 'wordpress',
      },
    })

    const autoscale_task = wordpress_service.service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 10
    })

    autoscale_task.scaleOnCpuUtilization('cpu_scaling', {
      targetUtilizationPercent: 50
    })

    autoscale_task.scaleOnRequestCount('request_scaling', {
      targetGroup: wordpress_service.targetGroup,
      requestsPerTarget: 1000
    })

    const wordpress_efs = new aws_efs.FileSystem(this, 'efs', {
      vpc: vpc,
      removalPolicy: RemovalPolicy.DESTROY
    })

    wordpress_service.taskDefinition.addVolume({
      name: 'wordpress-efs',
      efsVolumeConfiguration: {
        fileSystemId: wordpress_efs.fileSystemId
      }
    })

    const container = wordpress_service.taskDefinition.findContainer('wordpress')
    if (container) {
      container.addMountPoints({
        containerPath: '/var/www/html',
        sourceVolume: 'wordpress-efs',
        readOnly: false
      })
    }

    wordpress_efs.connections.allowDefaultPortFrom(wordpress_service.service)

    wordpress_service.targetGroup.configureHealthCheck({ healthyHttpCodes: "200-399" })

    wordpress_service.loadBalancer.listeners.forEach(listener => {
      new aws_elasticloadbalancingv2.ApplicationListenerRule(this, 'redirect_rule_' + listener.connections.defaultPort!.toString(), {
        listener: listener,
        priority: 10,
        conditions: [
          aws_elasticloadbalancingv2.ListenerCondition.hostHeaders(
            [wordpress_service.loadBalancer.loadBalancerDnsName])
        ],
        action: aws_elasticloadbalancingv2.ListenerAction.redirect({
          host: 'fargate.wordpress-cdk.tk',
        })
      })
    })

    mysql_service.connections.allowFrom(wordpress_service.service, aws_ec2.Port.allTcp())

  }
}
