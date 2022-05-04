# CDKプロジェクトの作成

## プロジェクト用ディレクトリの作成

```terminal title="ターミナル"
mkdir wordpress-cdk
cd wordpress-cdk
```

## CDK Init

Type Scriptで進めます。

```terminal title="ターミナル"
cdk init app --language typescript
```
```
# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template

Executing npm install...
npm WARN deprecated source-map-url@0.4.1: See https://github.com/lydell/source-map-url#deprecated
npm WARN deprecated urix@0.1.0: Please see https://github.com/lydell/urix#deprecated
npm WARN deprecated resolve-url@0.2.1: https://github.com/lydell/resolve-url#deprecated
npm WARN deprecated source-map-resolve@0.5.3: See https://github.com/lydell/source-map-resolve#deprecated
npm WARN deprecated sane@4.1.0: some dependency vulnerabilities fixed, support for node < 10 dropped, and newer ECMAScript syntax/features added
✅ All done!
```

以下のファイルが作成されます

```terminal title="ターミナル"
tree ./ -I node_modules
```
```
./
├── bin
│   └── wordpress-cdk.ts
├── cdk.json
├── jest.config.js
├── lib
│   └── wordpress-cdk-stack.ts
├── package.json
├── package-lock.json
├── README.md
├── test
│   └── wordpress-cdk.test.ts
└── tsconfig.json

3 directories, 9 files
```

## CDK Bootstrap

AWSリージョンごとにBootstrapスタックが必要ですので作成します。  
（1アカウント、1リージョンあたり1回実行）

```terminal title="ターミナル"
cdk bootstrap
```