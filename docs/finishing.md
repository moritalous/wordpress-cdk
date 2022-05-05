## 独自ドメインからのアクセスのみに限定する

これまでの設定で、WordPressへアクセスする宛先が複数出てきました。
最終的にはCloudFrontに設定した独自ドメイン以外からのアクセスを以下のルールで防ぎます。

| No. | AWSサービス | 宛先 | アクセス可否ルール |
| --: | --- | --- | --- |
| 1 | EC2 | パブリックIPアドレス | ブロック |
| 2 | EC2 | AWS生成ドメイン | ブロック |
| 3 | ELB | AWS生成ドメイン | CloudFrontの独自ドメインにリダイレクト |
| 4 | ELB | 独自ドメイン | CloudFrontの独自ドメインにリダイレクト |
| 5 | CloudFront | AWS生成ドメイン | CloudFrontの独自ドメインにリダイレクト |
| 6 | CloudFront | 独自ドメイン | アクセス許可 |


1. EC2への直接アクセスをブロック（No.1,2）

    EC2のセキュリティグループで許可しない（＝禁止する）

    ```typescript title="wordpress-cdk/lib/wordpress-cdk-stack.ts" linenums="32"
    // ec2_sg.addIngressRule(aws_ec2.Peer.anyIpv4(), aws_ec2.Port.tcp(80))
    ```

2. CloudFront独自ドメインにリダイレクト（No.3,4,5）

    ELBのリスナールールを設定  
    HOSTヘッダーが一致したらリダイレクト

    ```typescript title="wordpress-cdk/lib/wordpress-cdk-stack.ts" hl_lines="17-24 30-37" linenums="32"
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
        aws_elasticloadbalancingv2.ListenerCondition.hostHeaders(
          [elb.loadBalancerDnsName, 'elb.wordpress-cdk.tk', cloudfront.domainName])
      ],
      action: aws_elasticloadbalancingv2.ListenerAction.redirect({
        host: 'www.wordpress-cdk.tk',
        permanent: true,
      })
    })

    new aws_elasticloadbalancingv2.ApplicationListenerRule(this, 'listener_https_rule', {
      listener: listener_https,
      priority: 10,
      conditions: [
        aws_elasticloadbalancingv2.ListenerCondition.hostHeaders(
          [elb.loadBalancerDnsName, 'elb.wordpress-cdk.tk', cloudfront.domainName])
      ],
      action: aws_elasticloadbalancingv2.ListenerAction.redirect({
        host: 'www.wordpress-cdk.tk',
        permanent: true,
      })
    })
    ```

確認

=== "ELB AWS生成ドメイン"

    ```terminal
    curl -v http://Wordp-elb83-1TT135MDVLZ3N-1130701054.ap-northeast-1.elb.amazonaws.com
    ```
    ```
    *   Trying 35.75.128.36:80...
    * TCP_NODELAY set
    * Connected to Wordp-elb83-1TT135MDVLZ3N-1130701054.ap-northeast-1.elb.amazonaws.com (35.75.128.36) port 80 (#0)
    > GET / HTTP/1.1
    > Host: Wordp-elb83-1TT135MDVLZ3N-1130701054.ap-northeast-1.elb.amazonaws.com
    > User-Agent: curl/7.68.0
    > Accept: */*
    > 
    * Mark bundle as not supporting multiuse
    < HTTP/1.1 301 Moved Permanently
    < Server: awselb/2.0
    < Date: Wed, 04 May 2022 05:21:44 GMT
    < Content-Type: text/html
    < Content-Length: 134
    < Connection: keep-alive
    < Location: http://www.wordpress-cdk.tk:80/
    < 
    <html>
    <head><title>301 Moved Permanently</title></head>
    <body>
    <center><h1>301 Moved Permanently</h1></center>
    </body>
    </html>
    * Connection #0 to host Wordp-elb83-1TT135MDVLZ3N-1130701054.ap-northeast-1.elb.amazonaws.com left intact
    ```

=== "ELB 独自ドメイン"

    ```
    curl -v http://elb.wordpress-cdk.tk
    ```
    ```
    *   Trying 54.250.174.110:80...
    * TCP_NODELAY set
    * Connected to elb.wordpress-cdk.tk (54.250.174.110) port 80 (#0)
    > GET / HTTP/1.1
    > Host: elb.wordpress-cdk.tk
    > User-Agent: curl/7.68.0
    > Accept: */*
    > 
    * Mark bundle as not supporting multiuse
    < HTTP/1.1 301 Moved Permanently
    < Server: awselb/2.0
    < Date: Wed, 04 May 2022 05:22:32 GMT
    < Content-Type: text/html
    < Content-Length: 134
    < Connection: keep-alive
    < Location: http://www.wordpress-cdk.tk:80/
    < 
    <html>
    <head><title>301 Moved Permanently</title></head>
    <body>
    <center><h1>301 Moved Permanently</h1></center>
    </body>
    </html>
    * Connection #0 to host elb.wordpress-cdk.tk left intact
    ```

=== "CloudFront AWS生成ドメイン"

    ```
    curl -v http://d2rgr0fwcf5dr7.cloudfront.net
    ```
    ```
    *   Trying 18.65.123.50:80...
    * TCP_NODELAY set
    * Connected to d2rgr0fwcf5dr7.cloudfront.net (18.65.123.50) port 80 (#0)
    > GET / HTTP/1.1
    > Host: d2rgr0fwcf5dr7.cloudfront.net
    > User-Agent: curl/7.68.0
    > Accept: */*
    > 
    * Mark bundle as not supporting multiuse
    < HTTP/1.1 301 Moved Permanently
    < Content-Type: text/html
    < Content-Length: 134
    < Connection: keep-alive
    < Server: awselb/2.0
    < Date: Wed, 04 May 2022 05:23:03 GMT
    < Location: https://www.wordpress-cdk.tk:443/
    < X-Cache: Miss from cloudfront
    < Via: 1.1 a9715fbde86b226b6436617aa33710cc.cloudfront.net (CloudFront)
    < X-Amz-Cf-Pop: KIX50-P3
    < X-Amz-Cf-Id: -H8dpDTFP4ZjsNbpsrtW7UkRKwjolKLPKpzmVm0qTTYfimI5ujZSXA==
    < 
    <html>
    <head><title>301 Moved Permanently</title></head>
    <body>
    <center><h1>301 Moved Permanently</h1></center>
    </body>
    </html>
    * Connection #0 to host d2rgr0fwcf5dr7.cloudfront.net left intact
    ```

=== "CloudFront 独自ドメイン"

    ```
    curl -v http://www.wordpress-cdk.tk
    ```
    ```
    *   Trying 13.32.50.103:80...
    * TCP_NODELAY set
    * Connected to www.wordpress-cdk.tk (13.32.50.103) port 80 (#0)
    > GET / HTTP/1.1
    > Host: www.wordpress-cdk.tk
    > User-Agent: curl/7.68.0
    > Accept: */*
    > 
    * Mark bundle as not supporting multiuse
    < HTTP/1.1 302 Found
    < Content-Type: text/html; charset=UTF-8
    < Content-Length: 0
    < Connection: keep-alive
    < Date: Wed, 04 May 2022 05:25:39 GMT
    < Server: Apache/2.4.53 ()
    < X-Powered-By: PHP/7.2.34
    < Location: http://www.wordpress-cdk.tk/wp-admin/setup-config.php
    < X-Cache: Miss from cloudfront
    < Via: 1.1 a2447ed6669558ff303af177568ddb72.cloudfront.net (CloudFront)
    < X-Amz-Cf-Pop: NRT57-C1
    < X-Amz-Cf-Id: sPrq1LoZtFYma4tCKAdSa_ci7Od9hudO7PTtW0kh0T12axvUllaeGA==
    < 
    * Connection #0 to host www.wordpress-cdk.tk left intact
    ```

    !!! info

        この場合も302で転送されていますが、初期設定前なのでWordPressの初期設定画面に転送されています。

## HTTPS接続のみに限定する

せっかくSSL対応したので、HTTPでアクセスが来た場合にHTTPSにリダイレクトするように設定しましょう

!!! danger

    WordPressのSSL化設定が完了してからHTTPSのみに限定しましょう。

```typescript title="wordpress-cdk/lib/wordpress-cdk-stack.ts" hl_lines="6" linenums="193"
    const cloudfront = new aws_cloudfront.Distribution(this, 'cloudfront', {
      defaultBehavior: {
        origin: new aws_cloudfront_origins.HttpOrigin("elb.wordpress-cdk.tk"),
        allowedMethods: aws_cloudfront.AllowedMethods.ALLOW_ALL,
        cachedMethods: aws_cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        viewerProtocolPolicy: aws_cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS
        cachePolicy: aws_cloudfront.CachePolicy.CACHING_OPTIMIZED,
        originRequestPolicy: aws_cloudfront.OriginRequestPolicy.ALL_VIEWER,
      },
      domainNames: ['www.wordpress-cdk.tk'],
      certificate: cloudfront_cert
    })
```

ViewerProtocolPolicyを`ALLOW_ALL`から`REDIRECT_TO_HTTPS`に変更するだけです。

=== "CloudFront 独自ドメインへHTTP接続"

    ```
    curl -v http://www.wordpress-cdk.tk
    ```
    ```
    *   Trying 13.35.49.75:80...
    * TCP_NODELAY set
    * Connected to www.wordpress-cdk.tk (13.35.49.75) port 80 (#0)
    > GET / HTTP/1.1
    > Host: www.wordpress-cdk.tk
    > User-Agent: curl/7.68.0
    > Accept: */*
    > 
    * Mark bundle as not supporting multiuse
    < HTTP/1.1 301 Moved Permanently
    < Server: CloudFront
    < Date: Wed, 04 May 2022 05:35:34 GMT
    < Content-Type: text/html
    < Content-Length: 183
    < Connection: keep-alive
    < Location: https://www.wordpress-cdk.tk/
    < X-Cache: Redirect from cloudfront
    < Via: 1.1 4da2bc835e000996f0b384c9db0412cc.cloudfront.net (CloudFront)
    < X-Amz-Cf-Pop: NRT20-C1
    < X-Amz-Cf-Id: fYs-ClGPQl6YUaZrkAe8h30z83xkw7yf1skElwdShSSqcb6hb14luA==
    < 
    <html>
    <head><title>301 Moved Permanently</title></head>
    <body bgcolor="white">
    <center><h1>301 Moved Permanently</h1></center>
    <hr><center>CloudFront</center>
    </body>
    </html>
    * Connection #0 to host www.wordpress-cdk.tk left intact
    ```

=== "CloudFront 独自ドメインへHTTPS接続"

    ```
    curl -v https://www.wordpress-cdk.tk
    ```
    ```
    *   Trying 13.35.49.75:443...
    * TCP_NODELAY set
    * Connected to www.wordpress-cdk.tk (13.35.49.75) port 443 (#0)
    * ALPN, offering h2
    * ALPN, offering http/1.1
    * successfully set certificate verify locations:
    *   CAfile: /etc/ssl/certs/ca-certificates.crt
    CApath: /etc/ssl/certs
    * TLSv1.3 (OUT), TLS handshake, Client hello (1):
    * TLSv1.3 (IN), TLS handshake, Server hello (2):
    * TLSv1.3 (IN), TLS handshake, Encrypted Extensions (8):
    * TLSv1.3 (IN), TLS handshake, Certificate (11):
    * TLSv1.3 (IN), TLS handshake, CERT verify (15):
    * TLSv1.3 (IN), TLS handshake, Finished (20):
    * TLSv1.3 (OUT), TLS change cipher, Change cipher spec (1):
    * TLSv1.3 (OUT), TLS handshake, Finished (20):
    * SSL connection using TLSv1.3 / TLS_AES_128_GCM_SHA256
    * ALPN, server accepted to use h2
    * Server certificate:
    *  subject: CN=www.wordpress-cdk.tk
    *  start date: May  4 00:00:00 2022 GMT
    *  expire date: Jun  3 23:59:59 2023 GMT
    *  subjectAltName: host "www.wordpress-cdk.tk" matched cert's "www.wordpress-cdk.tk"
    *  issuer: C=US; O=Amazon; OU=Server CA 1B; CN=Amazon
    *  SSL certificate verify ok.
    * Using HTTP2, server supports multi-use
    * Connection state changed (HTTP/2 confirmed)
    * Copying HTTP/2 data in stream buffer to connection buffer after upgrade: len=0
    * Using Stream ID: 1 (easy handle 0x5556c248fe10)
    > GET / HTTP/2
    > Host: www.wordpress-cdk.tk
    > user-agent: curl/7.68.0
    > accept: */*
    > 
    * Connection state changed (MAX_CONCURRENT_STREAMS == 128)!
    < HTTP/2 302 
    < content-type: text/html; charset=UTF-8
    < content-length: 0
    < location: http://www.wordpress-cdk.tk/wp-admin/setup-config.php
    < date: Wed, 04 May 2022 05:36:05 GMT
    < server: Apache/2.4.53 ()
    < x-powered-by: PHP/7.2.34
    < x-cache: Miss from cloudfront
    < via: 1.1 d8d967e8190a369930c2613d498c9db8.cloudfront.net (CloudFront)
    < x-amz-cf-pop: NRT20-C1
    < x-amz-cf-id: F4zOC-9FsS3sA7SDAMHHseItlrbShmyzUCgxCtbzYJgDGXlU1nAqqQ==
    < 
    * Connection #0 to host www.wordpress-cdk.tk left intact
    ```


## ソースコード

??? abstract "ソースコード"

    === "bin/wordpress-cdk.ts"
        ```typescript
        --8<-- "step/11_finish/bin/wordpress-cdk.ts"
        ```

    === "lib/wordpress-cdk-stack.ts"
        ```typescript
        --8<-- "step/11_finish/lib/wordpress-cdk-stack.ts"
        ```

    === "lib/wordpress-cdk-stack-us-east-1.ts"
        ```typescript
        --8<-- "step/11_finish/lib/wordpress-cdk-stack-us-east-1.ts"
        ```
