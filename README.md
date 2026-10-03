# React ToDo アプリ

React + Vite で作成したシンプルな ToDo 管理アプリです。

## 機能

- タスクの追加・完了切り替え・削除（削除は「元に戻す」で取り消し可能）
- 完了の割合を示す進捗バー
- 「すべて / 未完了 / 完了」の表示切り替え（件数付き）
- 完了済みタスクの一括削除
- `localStorage` によるデータの保存
- ライト / ダークモード、スマホ表示に対応

## Web 標準・アクセシビリティへの配慮

- `lang="ja"` の指定、`header` / `main` / `nav` / `section` / `footer` によるセマンティックなマークアップ
- すべての入力欄に `label` を関連付け
- フィルタボタンは `aria-pressed`、件数表示は `role="status"` で支援技術に状態を通知
- 進捗はネイティブの `<progress>` 要素、削除の通知は `role="status"` のトーストで伝達
- `:focus-visible` によるキーボードフォーカスの可視化、タップ領域 44px 以上
- `prefers-reduced-motion` でアニメーションを停止
- 色・余白・角丸などは `:root` のデザイントークンで一元管理

## 公開 URL

https://uniqueseaweb.github.io/ReactApp/

`main` ブランチへのプッシュで GitHub Actions（`.github/workflows/deploy.yml`）により GitHub Pages へ自動デプロイされます。

## 使い方

```bash
npm install
npm run dev      # 開発サーバー起動
npm run build    # 本番ビルド（dist/ に出力）
npm run preview  # ビルド結果のプレビュー
npm run lint     # Lint
```
