import { aws_certificatemanager, aws_route53, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";

export class WordpressCdkUsEast1Stack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        // *****
        // Route 53
        // *****

        const hostedzone = aws_route53.HostedZone.fromHostedZoneAttributes(this, 'hostedzone', {
            hostedZoneId: 'Z0364500207RRL1KGDBUZ',
            zoneName: 'wordpress-cdk.tk'
        })

        // *****
        // Certificate Manager
        // *****

        const cloudfront_cert = new aws_certificatemanager.Certificate(this, 'cloudfront_cert', {
            domainName: 'www.wordpress-cdk.tk',
            validation: aws_certificatemanager.CertificateValidation.fromDns(hostedzone),
        })
    }
}