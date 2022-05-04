## 構成図

![](images/architectuture-efs.drawio.svg)

## EFS作成

WordPressのコンテンツを複数のEC2インスタンスで共有するため、EFSを作成します。  
AWSのサービスとしてのプロビジョニングだけでなく、OS上の設定も必要です。  
OSの設定はUser dataで行います。

```typescript title="wordpress-cdk/lib/wordpress-cdk-stack.ts" linenums="1"
import { aws_ec2, aws_efs, aws_elasticloadbalancingv2, aws_elasticloadbalancingv2_targets, aws_iam, aws_rds, CfnOutput, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
```
```typescript linenums="16"
    // *****
    // EFS
    // *****

    const efs = new aws_efs.FileSystem(this, 'efs', {
      vpc: vpc,
      removalPolicy: RemovalPolicy.DESTROY,
    })
```
```typescript hl_lines="10-19" linenums="41"
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
```
```typescript linenums="85"
    efs.connections.allowDefaultPortFrom(ec2)
```

* 20-23行目
    * EFSの作成
* 50-59行目
    * EFSのストレージをOSにマウント
* 85行目
    * EFSのセキュリティグループにEC2からの接続を許可するよう設定

## CDK Deploy

デプロイしましょう。

```terminal title="ターミナル"
cdk destroy
cdk deploy
```

!!! note

    WordPressの再インストールになるので、`cdk destroy`した後でdeployします。
