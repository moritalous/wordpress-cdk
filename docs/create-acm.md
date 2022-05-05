## 構成図

![](images/architectuture-acm.drawio.svg)

## Certificate Manager作成

Certificate ManagerでSSL証明書を作成し、ELBにセットすることでHTTPS化を行います。

```typescript title="wordpress-cdk/lib/wordpress-cdk-stack.ts" linenums="1"
import { aws_autoscaling, aws_certificatemanager, aws_ec2, aws_efs, aws_elasticloadbalancingv2, aws_elasticloadbalancingv2_targets, aws_iam, aws_rds, aws_route53, aws_route53_targets, CfnOutput, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
```
```typescript linenums="174"
    // *****
    // Certificate Manager
    // *****

    const elb_cert = new aws_certificatemanager.Certificate(this, 'elb_cert', {
      domainName: 'elb.wordpress-cdk.tk',
      validation: aws_certificatemanager.CertificateValidation.fromDns(hostedzone)
    })
```
```typescript linenums="214"
    const listener_https = elb.addListener('Listener_https', {
      port: 443,
      open: true,
      certificates: [elb_cert],
      defaultTargetGroups: [elb_targetgroup],
    })
```
```typescript linenums="233"
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
```

* 178-181行目
    * SSL証明書を作成
* 214-219行目
    * ELBにHTTPSリスナーを追加
* 233-243行目
    * 独自ドメインの追加で行ったAWS生成ドメインへのアクセスを防ぐと同様、AWS生成ドメインでのアクセスの場合の転送設定

## CDK Deploy

デプロイしましょう。

```terminal title="ターミナル"
cdk deploy
```

AWSがSSL証明書を無料で発行してくれるので簡単にHTTPS化ができました。
HTTPS化した場合、WordPressに設定が必要ですので、次の手順を行ってください。


## ソースコード

??? abstract "ソースコード"

    ```typescript title="wordpress-cdk/lib/wordpress-cdk-stack.ts"
    --8<-- "step/8_acm/lib/wordpress-cdk-stack.ts"
    ```
