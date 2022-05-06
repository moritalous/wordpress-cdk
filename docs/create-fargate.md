EC2とRDSを使わず、Fargateで構成してみます。

## 構成図

![](images/architectuture-fargate.drawio.svg)

## ECSクラスターの作成

まずはECSのクラスターを作成します。  

```typescript title="wordpress-docker-cdk/lib/wordpress-docker-cdk-stack.ts" linenums="1"
    const vpc = new aws_ec2.Vpc(this, 'vpc', { natGateways: 0 })

    const cluster = new aws_ecs.Cluster(this, 'cluster', {
      vpc: vpc,
      enableFargateCapacityProviders: true,
      defaultCloudMapNamespace: {
        name: 'my-wordpress'
      }
    })
```

!!! note

    `defaultCloudMapNamespace`は、Cloud Mapで使用するネームスペースの指定です。  
    MySQL用とWordPress用に２つのFargateサービスを作成するのですが、サービス間の名前解決はCloud Mapで行います。サービス検出の詳細は[こちら](https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/bestpracticesguide/networking-connecting-services.html)

!!! note

    `enableFargateCapacityProviders`は、Fargateのキャパシティプロバイダーを有効にしています。キャパシティプロバイダーの詳細は[こちら](https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/fargate-capacity-providers.html)

## MySQLサービスの作成

まずはMySQLの認証情報を作成し、Secrets Managerに登録します。

```typescript title="wordpress-docker-cdk/lib/wordpress-docker-cdk-stack.ts" linenums="22"
    const mysql_secret = new aws_secretsmanager.Secret(this, 'secret', {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'admin', dbname: 'wordpress' }),
        generateStringKey: 'password',
        excludePunctuation: true,
      }
    })
```

MySQLサービスを作成します。

```typescript title="wordpress-docker-cdk/lib/wordpress-docker-cdk-stack.ts" linenums="30"
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
```

* 34行目
    * 空のタスク定義を作成
* 36行目
    * パブリックIPを付与
    !!! note

        コンテナイメージををDocker HubからPullするためにパブリックIPが必要です

* 38-40行目
    * Cloud Mapに登録する名前
* 42-48行目
    * Fargate Spotを使用するように指定

タスク定義にコンテナを追加

```typescript title="wordpress-docker-cdk/lib/wordpress-docker-cdk-stack.ts" linenums="51"
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
```

* 52行目
    * コンテナイメージを指定。この指定の仕方の場合はDocker Hubから取得。
* 53-60行目
    * 環境変数を指定。シークレットマネージャーから取得する値は`secrets`に指定。
* 61行目
    * ログドライバーを指定。`awsLogs`を指定するとCloudWatch Logsに出力。

MySQLデータ永続化のためEFSを追加

```typescript title="wordpress-docker-cdk/lib/wordpress-docker-cdk-stack.ts" linenums="64"
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
```

* 64-67行目
    * EFSを作成
* 69-74行目
    * EFSをタスク定義のボリュームとして指定
* 76-80行目
    * タスク定義として指定したボリュームをコンテナにマウント  
      マウント先はコンテナイメージがVolumeで指定しているパス
* 82行目
    * mysqlサービスからEFSへのアクセスを許可

ここまででMySQLサービスの指定は環境です。

## WordPressサービスの作成

WordPressもMySQL同様に作成するのですが、WordPressはインターネットからELBを介してアクセスするように指定します。このようなよくある構成は`ecs_patterns`として提供されています。[参考](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs_patterns-readme.html)

WordPressは`ecs_patterns`で提供されている`ApplicationLoadBalancedFargateService`を使用して構築します。

まずは、ホストゾーンを定義します。

```typescript title="wordpress-docker-cdk/lib/wordpress-docker-cdk-stack.ts" linenums="88"
    const hostedZone = aws_route53.HostedZone.fromHostedZoneAttributes(this, 'hostedzone', {
      hostedZoneId: 'Z0364500207RRL1KGDBUZ',
      zoneName: 'wordpress-cdk.tk'
    })
```

`ApplicationLoadBalancedFargateService`を使用してWordPressサービスを作成します

```typescript title="wordpress-docker-cdk/lib/wordpress-docker-cdk-stack.ts" linenums="93"
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
```

Fargateサービスの指定だけでなく、ドメイン名やSSL証明書、ロードバランサーの設定もここで行います。

* 97-112行目
    * タスク定義を行います。`taskDefinition`と`taskImageOptions`のどちらか一方で指定
* 114-115行目
    * ドメインの設定（Route 53)
* 117-120行目
    * SSL証明書の設定（Certificate Manager)
* 122-123行目
    * ロードバランサの設定（ELB）
* 127-129行目
    * サービス検出の設定（Cloud Map）

次に、アクセス負荷に合わせて、コンテナの数をスケールする設定を行います。(Auto Scaling)


```typescript title="wordpress-docker-cdk/lib/wordpress-docker-cdk-stack.ts" linenums="132"
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
```

* 132-135行目
    * スケールする台数の上限下限を設定
* 137-144行目
    * スケールする条件を設定（CPU使用率とリクエストカウント）

アップロードしたコンテンツを共有するため、EFSを追加します。

```typescript title="wordpress-docker-cdk/lib/wordpress-docker-cdk-stack.ts" linenums="132"
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
```

* 146-149行目
    * EFSを作成
* 151-156行目
    * EFSをタスク定義のボリュームとして指定
* 158-165行目
    * タスク定義として指定したボリュームをコンテナにマウント  
      マウント先はコンテナイメージがVolumeで指定しているパス
* 167行目
    * wordpressサービスからEFSへのアクセスを許可

ELBの設定を少しだけ追加します。

```typescript title="wordpress-docker-cdk/lib/wordpress-docker-cdk-stack.ts" linenums="169"
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
```

* 169行目
    * WordPressは初期設定が完了するまでレスポンスコードが302になります。そのためヘルスチェックをクリアさせるためにチェック対象のレスポンスコードを変更しています。
* 171-183行目
    * （オプション）AWSが生成するELBの名前の場合に、独自ドメインにリダイレクトする設定を追加

最後にmysqlサービスへwordpressサービスからのアクセスを許可する設定です

```typescript title="wordpress-docker-cdk/lib/wordpress-docker-cdk-stack.ts" linenums="185"
    mysql_service.connections.allowFrom(wordpress_service.service, aws_ec2.Port.allTcp())
```

これで完成です。

CloudFrontの追加もチャレンジしてみてください。

!!! info

    今回はRDSを使わず、データベースもFargateで構成しました。利用用途次第でこのような構成もアリではないでしょうか？

## ソースコード

??? abstract "ソースコード"

    ```typescript title="wordpress-docker-cdk/lib/wordpress-docker-cdk-stack.ts"
    --8<-- "wordpress-docker-cdk/lib/wordpress-docker-cdk-stack.ts"
    ```
