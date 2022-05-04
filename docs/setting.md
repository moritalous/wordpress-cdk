# 事前設定

## AWS CLIのインストール

こちらを参考にインストールします。  
https://docs.aws.amazon.com/ja_jp/cli/latest/userguide/getting-started-install.html

## Node.jsのインストール

こちらを参考にインストールします。  
https://nodejs.org/ja/download/

## CDK SDKのインストール

```terminal title="ターミナル"
npm install -g aws-cdk
```

## AWS認証情報の設定

```terminal title="ターミナル"
aws configure
```
```
AWS Access Key ID [None]: 
AWS Secret Access Key [None]: 
Default region name [None]: 
Default output format [None]: 
```

!!! note

    サンプルコードでは、`~/.aws`ディレクトリとVSCode上の`.aws`ディレクトリのリンクするVSCodeタスク`create symlnk .aws`を用意しています。
