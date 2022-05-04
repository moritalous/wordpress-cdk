## 構成図

![](images/architectuture-cloudfront.drawio.svg)

## CloudFront作成

CDNを追加します。

```typescript title="wordpress-cdk/lib/wordpress-cdk-stack.ts" linenums="1"
import { aws_autoscaling, aws_cloudfront, aws_cloudfront_origins, aws_ec2, aws_efs, aws_elasticloadbalancingv2, aws_elasticloadbalancingv2_targets, aws_iam, aws_rds, aws_route53, aws_route53_targets, CfnOutput, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
```
```typescript linenums="183"
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
    })
```
```typescript linenums="282"
    new CfnOutput(this, 'cloudfront-output', {
      value: cloudfront.distributionDomainName
    })
```

* 183-196行目
    * CloudFrontの作成
        * オリジンはelbのドメイン
        * 対応するHTTPメソッドの設定（allowedMethods、cachedMethods）
        * ビューワープロトコルポリシーは`HTTP and HTTPS`、`Redirect HTTP to HTTPS`、`HTTPS only`から選択
        * キャッシュポリシーはAWSが用意している`CacheOptimized`
        * オリジンリクエストポリシーはオリジンに転送するパラメーターの設定（AllViewerはすべてを転送）

## CDK Deploy

デプロイしましょう。

```terminal title="ターミナル"
cdk deploy
```

CloudFront発行のドメインでアクセスできることを確認してください。

