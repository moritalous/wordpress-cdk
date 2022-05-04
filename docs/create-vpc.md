## 構成図

![](images/architectuture-vpc.drawio.svg)

## VPC作成

VPCを作成します。

```typescript title="wordpress-cdk/lib/wordpress-cdk-stack.ts" hl_lines="1 12" linenums="1"
import { aws_ec2, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class WordpressCdkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // *****
    // VPC
    // *****

    const vpc = new aws_ec2.Vpc(this, 'VPC', {})

  }
}

```

## CDK Diff

ファイル保存後、作成されるリソースを確認してみましょう

```terminal title="ターミナル"
cdk diff
```
```
Stack WordpressCdkStack
Parameters
[+] Parameter BootstrapVersion BootstrapVersion: {"Type":"AWS::SSM::Parameter::Value<String>","Default":"/cdk-bootstrap/hnb659fds/version","Description":"Version of the CDK Bootstrap resources in this environment, automatically retrieved from SSM Parameter Store. [cdk:skip]"}

Conditions
[+] Condition CDKMetadata/Condition CDKMetadataAvailable: {"Fn::Or":[{"Fn::Or":[{"Fn::Equals":[{"Ref":"AWS::Region"},"af-south-1"]},{"Fn::Equals":[{"Ref":"AWS::Region"},"ap-east-1"]},{"Fn::Equals":[{"Ref":"AWS::Region"},"ap-northeast-1"]},{"Fn::Equals":[{"Ref":"AWS::Region"},"ap-northeast-2"]},{"Fn::Equals":[{"Ref":"AWS::Region"},"ap-south-1"]},{"Fn::Equals":[{"Ref":"AWS::Region"},"ap-southeast-1"]},{"Fn::Equals":[{"Ref":"AWS::Region"},"ap-southeast-2"]},{"Fn::Equals":[{"Ref":"AWS::Region"},"ca-central-1"]},{"Fn::Equals":[{"Ref":"AWS::Region"},"cn-north-1"]},{"Fn::Equals":[{"Ref":"AWS::Region"},"cn-northwest-1"]}]},{"Fn::Or":[{"Fn::Equals":[{"Ref":"AWS::Region"},"eu-central-1"]},{"Fn::Equals":[{"Ref":"AWS::Region"},"eu-north-1"]},{"Fn::Equals":[{"Ref":"AWS::Region"},"eu-south-1"]},{"Fn::Equals":[{"Ref":"AWS::Region"},"eu-west-1"]},{"Fn::Equals":[{"Ref":"AWS::Region"},"eu-west-2"]},{"Fn::Equals":[{"Ref":"AWS::Region"},"eu-west-3"]},{"Fn::Equals":[{"Ref":"AWS::Region"},"me-south-1"]},{"Fn::Equals":[{"Ref":"AWS::Region"},"sa-east-1"]},{"Fn::Equals":[{"Ref":"AWS::Region"},"us-east-1"]},{"Fn::Equals":[{"Ref":"AWS::Region"},"us-east-2"]}]},{"Fn::Or":[{"Fn::Equals":[{"Ref":"AWS::Region"},"us-west-1"]},{"Fn::Equals":[{"Ref":"AWS::Region"},"us-west-2"]}]}]}

Resources
[+] AWS::EC2::VPC VPC VPCB9E5F0B4 
[+] AWS::EC2::Subnet VPC/PublicSubnet1/Subnet VPCPublicSubnet1SubnetB4246D30 
[+] AWS::EC2::RouteTable VPC/PublicSubnet1/RouteTable VPCPublicSubnet1RouteTableFEE4B781 
[+] AWS::EC2::SubnetRouteTableAssociation VPC/PublicSubnet1/RouteTableAssociation VPCPublicSubnet1RouteTableAssociation0B0896DC 
[+] AWS::EC2::Route VPC/PublicSubnet1/DefaultRoute VPCPublicSubnet1DefaultRoute91CEF279 
[+] AWS::EC2::EIP VPC/PublicSubnet1/EIP VPCPublicSubnet1EIP6AD938E8 
[+] AWS::EC2::NatGateway VPC/PublicSubnet1/NATGateway VPCPublicSubnet1NATGatewayE0556630 
[+] AWS::EC2::Subnet VPC/PublicSubnet2/Subnet VPCPublicSubnet2Subnet74179F39 
[+] AWS::EC2::RouteTable VPC/PublicSubnet2/RouteTable VPCPublicSubnet2RouteTable6F1A15F1 
[+] AWS::EC2::SubnetRouteTableAssociation VPC/PublicSubnet2/RouteTableAssociation VPCPublicSubnet2RouteTableAssociation5A808732 
[+] AWS::EC2::Route VPC/PublicSubnet2/DefaultRoute VPCPublicSubnet2DefaultRouteB7481BBA 
[+] AWS::EC2::EIP VPC/PublicSubnet2/EIP VPCPublicSubnet2EIP4947BC00 
[+] AWS::EC2::NatGateway VPC/PublicSubnet2/NATGateway VPCPublicSubnet2NATGateway3C070193 
[+] AWS::EC2::Subnet VPC/PrivateSubnet1/Subnet VPCPrivateSubnet1Subnet8BCA10E0 
[+] AWS::EC2::RouteTable VPC/PrivateSubnet1/RouteTable VPCPrivateSubnet1RouteTableBE8A6027 
[+] AWS::EC2::SubnetRouteTableAssociation VPC/PrivateSubnet1/RouteTableAssociation VPCPrivateSubnet1RouteTableAssociation347902D1 
[+] AWS::EC2::Route VPC/PrivateSubnet1/DefaultRoute VPCPrivateSubnet1DefaultRouteAE1D6490 
[+] AWS::EC2::Subnet VPC/PrivateSubnet2/Subnet VPCPrivateSubnet2SubnetCFCDAA7A 
[+] AWS::EC2::RouteTable VPC/PrivateSubnet2/RouteTable VPCPrivateSubnet2RouteTable0A19E10E 
[+] AWS::EC2::SubnetRouteTableAssociation VPC/PrivateSubnet2/RouteTableAssociation VPCPrivateSubnet2RouteTableAssociation0C73D413 
[+] AWS::EC2::Route VPC/PrivateSubnet2/DefaultRoute VPCPrivateSubnet2DefaultRouteF4F5CFD2 
[+] AWS::EC2::InternetGateway VPC/IGW VPCIGWB7E252D3 
[+] AWS::EC2::VPCGatewayAttachment VPC/VPCGW VPCVPCGW99B986DC 

Other Changes
[+] Unknown Rules: {"CheckBootstrapVersion":{"Assertions":[{"Assert":{"Fn::Not":[{"Fn::Contains":[["1","2","3","4","5"],{"Ref":"BootstrapVersion"}]}]},"AssertDescription":"CDK bootstrap stack version 6 required. Please run 'cdk bootstrap' with a recent version of the CDK CLI."}]}}
```

以下のリソースが作成されます。

* VPC
    * PublicSubnet1
        * Subnet
        * RouteTable
        * RouteTableAssociation
        * DefaultRoute
        * EIP
        * NATGateway
    * PublicSubnet2
        * Subnet
        * RouteTable
        * RouteTableAssociation
        * DefaultRoute
        * EIP
        * NATGateway
    * PrivateSubnet1
        * Subnet
        * RouteTable
        * RouteTableAssociation
        * DefaultRoute
    * PrivateSubnet2
        * Subnet
        * RouteTable
        * RouteTableAssociation
        * DefaultRoute
    * IGW
    * VPCGatewayAttachment

## 少しカスタマイズ

上記はデフォルト設定でしたが、細かな設定を指定するときはこのようになります。

```typescript title="wordpress-cdk/lib/wordpress-cdk-stack.ts" hl_lines="2" linenums="12"
    const vpc = new aws_ec2.Vpc(this, 'VPC', {
      natGateways: 0
    })
```

こうすると、NATゲートウェイが作成されず、Privateサブネットが独立します。  
名称もIsolatedSubnet1/IsolatedSubnet2に変更になります。

## CDK Deploy

CDKで定義したリソースをAWS環境にデプロイしてみましょう。

```terminal title="ターミナル"
cdk deploy
```

!!! Warning

    NATゲートウェイあり状態でdeployしたのち、NATゲートウェイなしに変更するとサブネットの重複が発生し、デプロイに失敗します。こういった場合は一度`cdk destroy`でリソースをすべて削除した後、再度`cdk deploy`を実行します。