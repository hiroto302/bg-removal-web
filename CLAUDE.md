# Background Removal Web App — プロジェクトガイド

## プロジェクト概要

ブラウザ完結型の画像背景除去 Web アプリ。サーバーへの画像送信不要で、プライバシーを完全に保護しつつ、AI による背景除去を無料・無制限で提供する。

参考: [debackground.com](https://debackground.com)

## 技術スタック

| カテゴリ | 技術 |
|----------|------|
| 言語 | TypeScript 5.x |
| ビルドツール | Vite 6.x (`vanilla-ts` テンプレート) |
| AI ライブラリ | `@huggingface/transformers` v3 (Transformers.js) |
| 推論バックエンド | WebGPU (優先, fp16) → WASM (フォールバック, q8) |
| モデル | briaai/RMBG-1.4 (IS-Net ベース, 44.1M パラメータ) |
| 並列処理 | Web Worker |
| パッケージマネージャ | npm |

## アーキテクチャ

```
bg_removal_web/
├── index.html                  # エントリ HTML
├── package.json
├── tsconfig.json
├── vite.config.ts
├── public/
│   └── checkerboard.svg        # 透明背景パターン
└── src/
    ├── main.ts                 # エントリポイント: UI統合 + Worker管理 + 状態管理
    ├── style.css               # 全スタイル (CSS Custom Properties)
    ├── worker.ts               # Web Worker: モデルロード + 推論
    ├── types.ts                # Worker メッセージプロトコル型定義
    ├── ui/
    │   ├── dropzone.ts         # ドラッグ&ドロップ + ファイル選択
    │   ├── progress.ts         # 2段階プログレス (DL進捗 + 推論スピナー)
    │   ├── slider.ts           # ビフォーアフタースライダー (clip-path)
    │   └── download.ts         # PNG ダウンロード + 新しい画像ボタン
    └── utils/
        ├── image.ts            # 画像処理 (マスク適用, リサイズ, PNG変換)
        └── device.ts           # WebGPU 対応チェック
```

## Worker メッセージプロトコル

```
Main → Worker:
  { type: 'init' }                          モデルロード開始
  { type: 'process', imageUrl: string }     背景除去処理

Worker → Main:
  { type: 'init_progress', data: ProgressData }  DL進捗
  { type: 'init_complete', device: 'webgpu' | 'wasm' }  ロード完了
  { type: 'processing' }                    推論開始
  { type: 'result', maskData: ImageData }   結果マスク
  { type: 'error', message: string }        エラー
```

## コーディング規約

- UI モジュール (`src/ui/`) は `init*` 関数をエクスポートし、DOM 要素とコールバックを受け取るパターン
- Worker はシングルトンパターンで Pipeline を管理
- 状態管理は `main.ts` に集約 (`idle` → `loading_model` → `processing` → `result` → `error`)
- CSS は Custom Properties を使用したテーマシステム
- 画像は Blob URL で Worker に送信 (`RawImage.fromURL` を使用)
- 大画像 (4096px超) はリサイズして処理

## Vite 設定の重要事項

- `optimizeDeps.exclude: ['@huggingface/transformers']` — ONNX Runtime WASM が Vite の依存関係最適化と競合するため必須
- `worker.format: 'es'` — Worker 内で ES module import を使用するため必須
- `build.target: 'esnext'` — top-level await サポート

## 開発コマンド

```bash
npm run dev      # 開発サーバー起動
npm run build    # プロダクションビルド
npm run preview  # ビルド結果プレビュー
```
