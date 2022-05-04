import { aws_ec2, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class WordpressCdkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // *****
    // VPC
    // *****

    const vpc = new aws_ec2.Vpc(this, 'VPC', {
      natGateways: 0
    })

  }
}
