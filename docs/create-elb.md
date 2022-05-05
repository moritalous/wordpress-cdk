## 構成図

![](images/architectuture-elb.drawio.svg)

## ELB作成

次はロードバランサーです。

```typescript title="wordpress-cdk/lib/wordpress-cdk-stack.ts" linenums="1"
import { aws_ec2, aws_elasticloadbalancingv2, aws_elasticloadbalancingv2_targets, aws_iam, aws_rds, CfnOutput, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
```
```typescript linenums="91"
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

    ec2_sg.addIngressRule(aws_ec2.Peer.securityGroupId(elb_sg.securityGroupId), aws_ec2.Port.tcp(80))

    const listener_http = elb.addListener('Listener_http', {
      port: 80,
      open: true,
      defaultTargetGroups: [elb_targetgroup],
    })
```
```typescript linenums="129"
    new CfnOutput(this, 'elb-output', {
      value: elb.loadBalancerDnsName
    })
```

* 95-103行目
    * ELBの作成
* 105-110行目
    * ターゲットグループの作成。  
      ヘルスチェックはデフォルトだとステータスコードが200かどうかのチェックを行います。WordPressは初期設定前だとレスポンスコード301を返したりするので、ステータスコードの範囲を200-399に変更しています。
* 112行目
    * EC2のセキュリティグループのインバウンドルールにELBのセキュリティグループからの通信を追加
* 114-118行目
    * リスナーの作成

## CDK Deploy

デプロイしましょう。

```terminal title="ターミナル"
cdk deploy
```

ELBのドメイン名でアクセスでき、EC2のパブリックIPアドレスでアクセスできないことを確認します。

!!! info

    WordPressは初期設定時のドメイン名を記憶するようなので、IPアドレスやドメインが変わると再度セットアップが必要になります。`cdk destroy`で削除の後、再度`cdk deploy`するのが確実です。（データベースのデータが消えるので、WordPressの初期設定が必要です）


## ソースコード

??? abstract "ソースコード"

    ```typescript title="wordpress-cdk/lib/wordpress-cdk-stack.ts"
    --8<-- "step/4_elb/lib/wordpress-cdk-stack.ts"
    ```
