## 構成図

![](images/architectuture-route53.drawio.svg)

## ドメイン作成

独自ドメインを設定します。

私は[Freenom](https://www.freenom.com/)で`wordpress-cdk.tk`というドメインを取得しました。  
（ドメインの取得は済んでいるものとして進めます。）

## ドメインのRoute 53への登録

ドメインの登録はCDKではなくAWS CLIで行います。

!!! note

    `--caller-reference`は毎回ランダムな文字列を指定する必要があります。

```terminal title="ターミナル"
aws route53 create-hosted-zone \
    --name wordpress-cdk.tk \
    --caller-reference `date +%s`
```
```
{
    "Location": ".....",
    "HostedZone": {
        "Id": ".....",
        "Name": "wordpress-cdk.tk.",
        "CallerReference": "1651588600",
        "Config": {
            "PrivateZone": false
        },
        "ResourceRecordSetCount": 2
    },
    "ChangeInfo": {
        "Id": ".....",
        "Status": ".....",
        "SubmittedAt": "....."
    },
    "DelegationSet": {
        "NameServers": [
            "ns-1111.awsdns-66.net",
            "ns-2222.awsdns-77.org",
            "ns-3333.awsdns-88.com",
            "ns-4444.awsdns-99.co.uk"
        ]
    }
}
```

NameServersの値をFreenomに登録し、ドメインの管理をRoute 53で行うようにします。

## ELB用のサブドメインの作成

CDKで作成します。

```typescript title="wordpress-cdk/lib/wordpress-cdk-stack.ts" linenums="1"
import { aws_autoscaling, aws_ec2, aws_efs, aws_elasticloadbalancingv2, aws_elasticloadbalancingv2_targets, aws_iam, aws_rds, aws_route53, aws_route53_targets, CfnOutput, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
```
```typescript linenums="165"
    // *****
    // Route 53
    // *****

    const hostedzone = aws_route53.HostedZone.fromHostedZoneAttributes(this, 'hostedzone', {
      hostedZoneId: 'Z0364500207RRL1KGDBUZ',
      zoneName: 'wordpress-cdk.tk'
    })
```
```typescript linenums="205"
    // *****
    // Route 53
    // *****

    new aws_route53.ARecord(this, 'elb-domain', {
      zone: hostedzone,
      recordName: 'elb',
      target: aws_route53.RecordTarget.fromAlias(new aws_route53_targets.LoadBalancerTarget(elb)),
    });
```

* 169-172行目
    * Route 53ホストゾーンの取得  
      リソースの新規作成ではなく既存のリソースからオブジェクトを取得します。（newが不要です）
* 209-213行目
    * ELBへのエイリアスのAレコードを作成

## CDK Deploy

デプロイしましょう。

```terminal title="ターミナル"
cdk deploy
```

## AWS生成ドメインへのアクセスを防ぐ

ここまでの設定で、独自ドメインでのアクセスができるようになりましたが、AWSが生成するELBのドメインでも引き続きアクセスできる状態となります。  
ELBのドメインへのアクセスの場合に、`elb.wordpress-cdk.tk`にリダイレクトする設定を追加します。

```typescript title="wordpress-cdk/lib/wordpress-cdk-stack.ts" linenums="205"
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
```

HTTPヘッダーの`host`がELB発行のドメインの場合に`elb.wordpress-cdk.tk`へリダイレクトする設定です。

!!! note

    `permanent`が`true`の場合はステータスコードが`301`に、falseの場合は`302`になります。

## CDK Deploy

デプロイしましょう。

```terminal title="ターミナル"
cdk deploy
```