# color-discord-bot

Discord 用のカラーロールパネルボット。`/panel` コマンドでパネルを作成し、セレクトメニューからロールを付け外しできます。

## セットアップ

```sh
npm install
```


| 変数 | 必須 | 説明 |
| --- | --- | --- |
| `DISCORD_TOKEN` | ✅ | Bot のトークン |
| `CLIENT_ID` | ✅ | アプリケーション ID |
| `GUILD_ID` | - | 指定するとギルド限定コマンドとして登録（即時反映） |
| `DB_PATH` | - | パネル状態の保存先（デフォルト: `bot.db`） |

## 必要な権限

- Manage Roles
- View Channels
- Send Messages
- Embed Links
- Read Message History

## 開発

```sh
npm run dev    # tsx watch で起動
npm run build  # dist/ へビルド
npm start      # ビルド済みボットを起動
```

## Nix

```sh
nix develop            # 開発シェル
nix run .              # ボットを起動
nix build .#container  # コンテナイメージをビルド（Linux のみ）
```

## コマンド

- `/panel create channel:<#チャンネル> title:<タイトル> role:<ロール>` — パネルを作成
- `/panel add-role message_id:<id> role:<ロール> label:<表示名>` — パネルにロールを追加
- `/panel delete message_id:<id>` — パネルを削除
