# TODO — 背景除去 Web アプリ 実装チェックリスト

## Phase 1: プロジェクトセットアップ

- [x] Vite プロジェクト初期化 (`npm create vite@latest . -- --template vanilla-ts`)
- [x] テンプレートの不要ファイル削除 (`counter.ts`, `typescript.svg`, デフォルト内容)
- [x] `@huggingface/transformers` インストール
- [x] `vite.config.ts` 設定 (optimizeDeps.exclude, worker.format, build.target)
- [x] `tsconfig.json` に `"WebWorker"` を lib に追加
- [x] `index.html` に HTML スケルトン構築 (header, dropzone-section, progress-section, result-section, footer)
- [x] `src/style.css` に CSS Custom Properties + グローバルスタイル
- [x] `src/main.ts` に最小エントリポイント
- [x] **検証**: `npm run dev` でページが表示される

## Phase 2: Web Worker + Transformers.js 統合

- [x] `src/types.ts` — WorkerRequest, WorkerResponse, ProgressData 型定義
- [x] `src/worker.ts` — SegmentationPipeline シングルトン + メッセージハンドラ
  - [x] WebGPU 事前チェック (`navigator.gpu.requestAdapter()`)
  - [x] WebGPU → WASM 自動フォールバック
  - [x] `'init'` メッセージでモデルロード + progress 転送
  - [x] `'process'` メッセージで `RawImage.fromURL()` → 推論 → mask 返却
- [x] `src/utils/image.ts` — 画像処理ユーティリティ
  - [x] `fileToImageData()`: File → ObjectURL → Image → Canvas → ImageData
  - [x] `applyMask()`: マスクの R チャンネルを alpha に適用 (リサイズ含む)
  - [x] `imageDataToBlobUrl()`: ImageData → Canvas → Blob → ObjectURL
  - [x] 大画像リサイズ (4096px 上限)
- [x] `src/utils/device.ts` — `checkWebGPU()` 情報表示用
- [x] `main.ts` に Worker 起動 + メッセージハンドラ追加
- [x] **検証**: テスト画像で背景除去結果がコンソール/canvas に表示される

## Phase 3: UI 実装

- [x] `src/ui/dropzone.ts`
  - [x] dragenter/dragover/dragleave/drop イベント
  - [x] ファイル選択ボタン (hidden input)
  - [x] バリデーション (JPG/PNG/WebP, 20MB 上限)
  - [x] ペースト対応 (Ctrl+V)
  - [x] ドラッグオーバー時アクティブスタイル
- [x] `src/ui/slider.ts`
  - [x] 左=オリジナル / 右=背景除去済み (市松模様背景)
  - [x] `clip-path: inset()` によるクリッピング
  - [x] マウス + タッチドラッグ対応
  - [x] キーボードアクセシビリティ (矢印キー)
  - [x] 初期位置 50%
- [x] `src/ui/download.ts`
  - [x] 「ダウンロード (PNG)」ボタン (`{元ファイル名}_no_bg.png`)
  - [x] 「新しい画像」ボタン (状態リセット)
  - [x] 処理統計表示 (バックエンド, 処理時間)
- [x] `public/checkerboard.svg` — 透明背景パターン
- [x] `main.ts` で全モジュール統合
- [x] コンポーネント CSS (dropzone, slider, buttons, etc.)
- [x] **検証**: 画像ドロップ → スライダー比較 → PNG ダウンロードの完全フロー

## Phase 4: プログレス表示 + エラーハンドリング

- [x] `src/ui/progress.ts`
  - [x] モデル DL 進捗バー (複数ファイルの合計進捗計算)
  - [x] 推論中スピナー
  - [x] エラー表示 + リトライボタン
- [x] `main.ts` メッセージハンドラを progress モジュールに接続
- [x] Worker エラーハンドラ (`worker.onerror`, `worker.onmessageerror`)
- [x] ファイルバリデーションエラー表示
- [x] フッターにバックエンドバッジ (WebGPU / WASM) + 処理時間
- [x] **検証**: 初回ロードでプログレスバー動作、エラー時に適切なメッセージ

## Phase 5: 仕上げ

- [ ] 複数画像の連続処理 (ObjectURL revoke, 状態リセット)
- [ ] 処理競合ハンドリング (`processingId` カウンター)
- [ ] レスポンシブ CSS 調整 (375px / 768px / 1280px)
- [ ] ファビコン + meta タグ
- [ ] メモリリークチェック (連続アップロードテスト)
- [ ] **検証**: 完成品として公開可能な状態
