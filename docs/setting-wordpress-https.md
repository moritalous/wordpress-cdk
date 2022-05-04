
AWSの設定を行っただけではcssやjsのファイルが`http`指定のまま残ってしまい、いわゆる`Mixed content(混在コンテンツ)`の状態となります。

!!! note

    混在コンテンツの危険性や詳細についてはこちらを参照ください。  
    [混在コンテンツのブロック | Firefox ヘルプ ](https://support.mozilla.org/ja/kb/mixed-content-blocking-firefox) 

WordPressのプラグインを使い、HTTPS対応を行います。

## WordPressの初期設定

1. `http://[ELBにセットしたドメイン名]`に接続  
   ここではまだhttpでアクセスします。
    ![](images/wordpress-https-01.png)
2. WordPressの初期設定を進めます
    ![](images/wordpress-https-02.png)
    RDSの認証情報を入力します
    ![](images/wordpress-https-03.png)
    ![](images/wordpress-https-04.png)
    ![](images/wordpress-https-05.png)
    ![](images/wordpress-https-06.png)

## プラグインのインストールと有効化

3. 初期設定が終わったら、ログインします
    ![](images/wordpress-https-07.png)
    ![](images/wordpress-https-08.png)
4. `Really Simple SSL`というプラグインをインストールします
    ![](images/wordpress-https-09.png)
5. 有効化します
    ![](images/wordpress-https-10.png)
6. `SSLを有効化`ボタンをクリックします
    ![](images/wordpress-https-11.png)
7. 設定が終わるとログイン画面に遷移します
    ![](images/wordpress-https-12.png)

以上で設定は完了です。`https`でアクセスできることを確認してください。