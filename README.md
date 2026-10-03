# React ToDo アプリ ＆ 太陽系ビューア

React + Vite で作成した 2 つのページからなる Web アプリです。

- **ToDo アプリ**（`/`）: シンプルな ToDo 管理
- **太陽系ビューア**（`/solar/`）: three.js で描いた 3D の太陽系

## 太陽系ビューア

three.js（`@react-three/fiber` / `@react-three/drei`）で、太陽と 8 つの惑星の公転を 3D で表示します。

- ドラッグで回転、ホイールやピンチで拡大縮小
- 天体をクリック、または一覧から選ぶと、その天体へ近づいて直径・距離・自転/公転周期・解説を表示（Esc で全体表示に戻る）
- 再生／一時停止、速さ（1 秒 = 1 日〜約 1 年）、今日に戻す、軌道線・名前の表示切り替え
- 惑星の模様は画像を使わず Canvas で生成
- 大きさと距離は見やすさのために縮めて表示（数値は NASA Planetary Fact Sheet を丸めた値）
- `prefers-reduced-motion` が有効なら一時停止で始まり、カメラの移動アニメーションも省略
- 3D 表示には説明文（`role="img"` と `aria-label`）を付け、天体の選択はすべてボタンからも操作可能

## ToDo アプリ

### 機能

- タスクの追加・完了切り替え・削除（削除は「元に戻す」で取り消し可能）
- 完了の割合を示す進捗バー
- 「すべて / 未完了 / 完了」の表示切り替え（件数付き）
- 完了済みタスクの一括削除
- `localStorage` によるデータの保存
- ライト / ダークモード、スマホ表示に対応

### Web 標準・アクセシビリティへの配慮

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
