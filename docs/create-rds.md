## 構成図

![](images/architectuture-rds_single.drawio.svg)

## RDS作成

続いてRDSを作成します。（長くなってきたのでコードは該当部分のみ）

```typescript title="wordpress-cdk/lib/wordpress-cdk-stack.ts" linenums="1"
import { aws_ec2, aws_iam, aws_rds, CfnOutput, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
```
```typescript linenums="66"
    // *****
    // RDS
    // *****

    const rds = new aws_rds.DatabaseInstance(this, 'Database', {
      vpc: vpc,
      vpcSubnets: {
        subnetType: aws_ec2.SubnetType.PRIVATE_ISOLATED
      },

      multiAz: false,

      engine: aws_rds.DatabaseInstanceEngine.mysql({
        version: aws_rds.MysqlEngineVersion.VER_8_0_28
      }),
      instanceType: aws_ec2.InstanceType.of(aws_ec2.InstanceClass.BURSTABLE4_GRAVITON, aws_ec2.InstanceSize.LARGE),

      databaseName: "wordpress",

      allocatedStorage: 20
    })

    rds.connections.allowDefaultPortFrom(ec2_sg)
    rds.applyRemovalPolicy(RemovalPolicy.DESTROY)
```
```typescript linenums="94"
    new CfnOutput(this, 'rds-output', {
      value: rds.dbInstanceEndpointAddress,
    })
    new CfnOutput(this, 'secretsmanager-output', {
      value: rds.secret!.secretName
    })
```

* 70-86行目  
    * VPCサブネットはデフォルトでプライベートサブネットになりますが、NATゲートウェイを消した都合上、プライベートサブネットがありません。そのため明示的に`PRIVATE_ISOLATED`を指定しています。
    * エンジンタイプとしてMySQL(8.0.28)を指定
    * インスタンスタイプはt4g.largeを指定
    * ストレージのサイズを20GBに指定
* 88行目  
    * EC2のセキュリティグループからの接続を許可
* 89行目  
    * CloudFormationの削除時にRDSを破棄する設定

!!! danger

    `RemovalPolicy`が`DESTROY`の場合、CloudFormationスタックの変更などでRDSを削除するとデータベースのデータも削除されます。本番運用にあたっては注意してください。

MySQLのユーザー名やパスワードは指定していませんが、自動で生成され設定の上、Secrets Managerに保存されます。
（明示的に指定する方法などもあります）

* 94-99行目 
    * RDSのドメイン名とSecrets Managerの保存先を出力


## WordPressのインストールをUser dataで行うよう変更

手動で行ってもいいのですが、面倒なので、User dataで行うように変更します。  
コマンドの内容は前のページで行ったものからMariaDBの設定を除いたものです。

```typescript title="wordpress-cdk/lib/wordpress-cdk-stack.ts" hl_lines="17-36 48" linenums="16"
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
```

## CDK Deploy

デプロイしましょう。

```terminal title="ターミナル"
cdk destroy
cdk deploy
```

!!! note

        一度リソースを削除したのちデプロイします。  
        何度でも気軽に作り直せるのがCDK！

デプロイが完了すると、RDSのエンドポイント名、Secrets ManagerのシークレットIDが出力されます。

## RDSへの接続情報の取得

Secrets ManagerからRDSへの接続情報を取得します。

```terminal title="AWS SDK"
aws secretsmanager get-secret-value --secret-id [シークレットID]
```
```
{
    "ARN": ".....",
    "Name": ".....",
    "VersionId": ".....",
    "SecretString": "{\"password\":\".....\",\"engine\":\"mysql\",\"port\":3306,\"dbInstanceIdentifier\":\".....\",\"host\":\".....\",\"username\":\".....\"}",
    "VersionStages": [
        "AWSCURRENT"
    ],
    "CreatedDate": "....."
}
```

## WordPressの設定

EC2のパブリックIPアドレスにアクセスし、RDSの接続情報を入力します。
マネージメントコンソールにアクセスすることなく、WordPressのセットアップが完了しました。

## マルチAZ構成にする

![](images/architectuture-rds_multi.drawio.svg)


`multiAz`を`true`に変更するだけで完了です。

```typescript title="wordpress-cdk/lib/wordpress-cdk-stack.ts" hl_lines="7" linenums="70"
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
```

## CDK Deploy

デプロイしましょう。

```terminal title="ターミナル"
cdk deploy
```

マルチAZ化が完了です。


## ソースコード

??? abstract "ソースコード"

    ```typescript title="wordpress-cdk/lib/wordpress-cdk-stack.ts"
    --8<-- "step/3_rds/lib/wordpress-cdk-stack.ts"
    ```
