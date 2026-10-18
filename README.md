# color-dis-bot

Discord で色ロール(configurable role)をパネルから付与・切り替えできるボットです。

## 機能

- `/panel create` — 指定チャンネルにロール選択パネルを作成
- `/panel add-role` — 既存パネルにロールを追加
- `/panel delete` — パネルを削除(DB 登録のみ解除)
- パネルのセレクトメニューで選択すると、パネル上の他のロールを外して選択ロールを付与(1人1色)

## セットアップ

1. Discord Developer Portal でアプリケーションを作成し、Bot トークンを取得
2. Bot に以下の権限を付けてサーバーに招待
   - Manage Roles(ロール付与)
   - Send Messages / Manage Messages(パネル送信)
   - 対象ロールは Bot の最上位ロールより下に配置すること
3. 環境変数を設定

| 変数 | 必須 | 説明 |
| --- | --- | --- |
| `DISCORD_TOKEN` | ✓ | Bot トークン |
| `CLIENT_ID` | ✓ | アプリケーションの Client ID |
| `GUILD_ID` |  | 指定すると特定サーバーにコマンドを即時登録(未指定はグローバル) |
| `DB_PATH` |  | SQLite DB パス(デフォルト `bot.db`) |

## 開発・実行

```sh
nix develop -c npm run dev    # 開発(tsx watch)
nix develop -c npm run build  # ビルド(dist/)
nix develop -c npm start      # 本番実行
```

Docker イメージ(Linux のみ):

```sh
nix build .#container
```
