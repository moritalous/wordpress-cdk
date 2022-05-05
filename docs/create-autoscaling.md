## 構成図

![](images/architectuture-autoscaling.drawio.svg)

## EC2 Auto Scaling作成

仮想サーバーもスケールするよう、Auto Scalingを作成します。  
作成済みのEC2も残し、以下のような構成としました。

* EC2のインスタンスでWordPressのインストールを行う
* Auto ScalingのインスタンスはWordPressのインストールは行わず、EFSのマウントのみを行う


```typescript title="wordpress-cdk/lib/wordpress-cdk-stack.ts" linenums="1"
import { aws_autoscaling, aws_ec2, aws_efs, aws_elasticloadbalancingv2, aws_elasticloadbalancingv2_targets, aws_iam, aws_rds, CfnOutput, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
```
```typescript linenums="112"
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
```
```typescript hl_lines="８" linenums="143"
    const elb_targetgroup = new aws_elasticloadbalancingv2.ApplicationTargetGroup(this, 'targetgroup', {
      vpc: vpc,
      targets: [new aws_elasticloadbalancingv2_targets.InstanceTarget(ec2)],
      port: 80,
      healthCheck: { enabled: true, healthyHttpCodes: "200-399" },
    })

    asg.attachToApplicationTargetGroup(elb_targetgroup)
```

* 116-142行目
    * Auto Scalingグループ用のUser Dataの作成（WordPressのインストール部分がない）
* 144-161行目
    * Auto Scalingグループの作成。基本的にはEC2と同じパラメーターを指定していますが、キャパシティの設定を、スポット価格を追加。
* 163行目
    * EFSのセキュリティグループにAuto Scalingグループからの接続を許可するよう設定
* 150行目
    * ELBのターゲットグループにAuto Scalingグループを追加

## CDK Deploy

デプロイしましょう。

```terminal title="ターミナル"
cdk deploy
```

ここまでできると、マルチAZ構成のWordPressの構築が最低限完了です。:laughing: :laughing: :laughing:


## ソースコード

??? abstract "ソースコード"

    ```typescript title="wordpress-cdk/lib/wordpress-cdk-stack.ts"
    --8<-- "step/6_asg/lib/wordpress-cdk-stack.ts"
    ```
