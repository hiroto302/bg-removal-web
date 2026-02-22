# WebGPU/WASM ブラウザベース背景除去アプリ — 要件定義

## 1. プロジェクト概要

### 目的

ブラウザ完結型の画像背景除去 Web アプリを構築する。サーバーへの画像送信が不要で、プライバシーを完全に保護しつつ、スタジオグレードの背景除去を無料・無制限で提供する。

### 参考サイト

[debackground.com](https://debackground.com) — 同等のブラウザベース背景除去アプリ。以下の特徴を踏襲する:

- 1画面完結のシンプル UI
- ドラッグ&ドロップ + ファイル選択によるアップロード
- ビフォーアフタースライダーによるプレビュー
- 100% ブラウザ処理（サーバー不要）
- 無料・無制限・アカウント不要

### 技術選定の理由

| 選択肢 | 採用 | 理由 |
|--------|------|------|
| Transformers.js (WebGPU/WASM) | **採用** | MIT ライセンス、ブラウザ完結、WebGPU で高速 |
| @imgly/background-removal | 不採用 | AGPL ライセンス（商用利用に制約） |
| クラウド API (remove.bg 等) | 不採用 | 有料、プライバシー懸念、サーバー依存 |
| Python + rembg | 不採用 | サーバーサイド処理が必要 |

---

## 2. 技術スタック

| カテゴリ | 技術 | バージョン |
|----------|------|-----------|
| 言語 | TypeScript | 5.x |
| ビルドツール | Vite | 6.x (`vanilla-ts` テンプレート) |
| AI ライブラリ | @huggingface/transformers | 3.x (Transformers.js v3) |
| 推論バックエンド | WebGPU（優先）→ WASM（フォールバック） | — |
| 推奨モデル | briaai/RMBG-1.4 | — |
| 並列処理 | Web Worker | — |
| パッケージマネージャ | npm | — |

### モデル仕様 (briaai/RMBG-1.4)

- **アーキテクチャ**: IS-Net ベース
- **パラメータ数**: 44.1M
- **入力サイズ**: 1024×1024px
- **ライセンス**: bria-rmbg-1.4 (non-commercial)。商用利用時は RMBG-2.0 (Apache-2.0) を検討
- **ONNX モデルサイズ**:
  - FP32: ~176MB
  - FP16: ~88MB（推奨）
  - INT8 (q8): ~44MB（品質とサイズのバランス）
  - INT4 (q4): ~22MB（最小サイズ、品質低下あり）

> **推奨**: FP16 または q8 を使用。FP16 は品質を維持しつつサイズを半減できる。

---

## 3. 機能要件

### 3.1 画像アップロード

- ドラッグ&ドロップゾーン（視覚的にわかりやすい破線ボーダー + アイコン）
- ファイル選択ボタン（`<input type="file">` のラッパー）
- 対応フォーマット: JPG, PNG, WebP
- 最大ファイルサイズ: 20MB（メモリ制約を考慮）
- 画像プレビュー（アップロード直後に表示）

### 3.2 背景除去処理

- WebGPU バックエンドを優先使用
- WebGPU 非対応時は自動的に WASM にフォールバック
- Web Worker 内で処理（メインスレッドをブロックしない）
- 処理結果: 透明背景の PNG 画像

### 3.3 プログレス表示

2段階のプログレスを表示:

1. **モデルダウンロード進捗**: 初回のみ。ファイル名と進捗率を表示
2. **推論処理進捗**: 処理中のスピナーまたはプログレスバー

### 3.4 ビフォーアフタープレビュー

- スライダー式の左右比較ビュー
- 左: オリジナル画像 / 右: 背景除去済み画像
- ドラッグでスライダーを左右に動かして比較
- 市松模様の透明背景表示

### 3.5 結果ダウンロード

- PNG 形式（透明背景）でダウンロード
- オリジナル解像度を維持
- ファイル名: `{元のファイル名}_no_bg.png`

### 3.6 複数画像の連続処理

- 1枚処理完了後、追加の画像をアップロード可能
- モデルは初回ロード後にキャッシュされ、2枚目以降は即座に処理開始

### 3.7 モデルキャッシュ

- ブラウザの Cache API を使用してモデルファイルをキャッシュ
- 2回目以降のアクセスではダウンロード不要（即座に処理開始）
- Transformers.js の組み込みキャッシュ機能を利用

---

## 4. 非機能要件

### パフォーマンス目標

| 指標 | WebGPU | WASM フォールバック |
|------|--------|-------------------|
| 推論時間（キャッシュ後） | ~100ms | ~2000ms |
| 初回モデル DL | 5-15秒 (FP16: ~88MB) | 同左 |
| メモリ使用量（ピーク） | 300-500MB | 300-500MB |

### ブラウザ対応

| ブラウザ | WebGPU | WASM |
|----------|--------|------|
| Chrome / Edge | v113+ | v113+ |
| Firefox | v141+ | v52+ |
| Safari | v18+ | v11+ |

### デプロイ

- 静的ファイルのみ（サーバーサイド処理なし）
- 任意の静的ホスティング（GitHub Pages, Cloudflare Pages, Vercel 等）にデプロイ可能
- Cross-Origin Isolation ヘッダーは不要（SharedArrayBuffer 未使用時）

---

## 5. アーキテクチャ設計

### 5.1 ディレクトリ構成

```
bg-removal-app/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── public/
│   └── checkerboard.svg        # 透明背景パターン
└── src/
    ├── main.ts                 # エントリポイント（UI 初期化）
    ├── style.css               # スタイル
    ├── worker.ts               # Web Worker（推論処理）
    ├── ui/
    │   ├── dropzone.ts         # ドラッグ&ドロップ UI
    │   ├── progress.ts         # プログレス表示
    │   ├── slider.ts           # ビフォーアフタースライダー
    │   └── download.ts         # ダウンロード機能
    └── utils/
        ├── image.ts            # 画像処理ユーティリティ
        └── device.ts           # WebGPU 対応チェック
```

### 5.2 Web Worker による非同期処理パターン

メインスレッドと Worker 間のメッセージプロトコル:

```typescript
// types.ts — メッセージ型定義

/** メインスレッド → Worker */
type WorkerRequest =
  | { type: 'init' }
  | { type: 'process'; imageData: ImageData };

/** Worker → メインスレッド */
type WorkerResponse =
  | { type: 'init_progress'; data: ProgressEvent }
  | { type: 'init_complete'; device: 'webgpu' | 'wasm' }
  | { type: 'processing' }
  | { type: 'result'; maskData: ImageData }
  | { type: 'error'; message: string };

interface ProgressEvent {
  status: 'download' | 'loading';
  file?: string;
  progress?: number;  // 0-100
  loaded?: number;
  total?: number;
}
```

### 5.3 Worker 実装 (worker.ts)

```typescript
// src/worker.ts
import {
  env,
  pipeline,
  RawImage,
  type ImageSegmentationPipeline,
} from '@huggingface/transformers';

// リモートモデルを許可、ローカルモデルは無効
env.allowLocalModels = false;

/** Singleton パターンで Pipeline を管理 */
class SegmentationPipeline {
  static instance: Promise<ImageSegmentationPipeline> | null = null;

  static async getInstance(
    progressCallback?: (data: unknown) => void,
  ): Promise<ImageSegmentationPipeline> {
    if (!this.instance) {
      this.instance = this.createPipeline(progressCallback);
    }
    return this.instance;
  }

  private static async createPipeline(
    progressCallback?: (data: unknown) => void,
  ): Promise<ImageSegmentationPipeline> {
    // WebGPU → WASM 自動フォールバック
    try {
      const pipe = await pipeline(
        'image-segmentation',
        'briaai/RMBG-1.4',
        {
          device: 'webgpu',
          dtype: 'fp16',
          progress_callback: progressCallback,
        },
      );
      self.postMessage({ type: 'init_complete', device: 'webgpu' });
      return pipe;
    } catch {
      console.warn('WebGPU not available, falling back to WASM');
      const pipe = await pipeline(
        'image-segmentation',
        'briaai/RMBG-1.4',
        {
          dtype: 'q8',
          progress_callback: progressCallback,
        },
      );
      self.postMessage({ type: 'init_complete', device: 'wasm' });
      return pipe;
    }
  }
}

// メインスレッドからのメッセージを処理
self.addEventListener('message', async (event: MessageEvent) => {
  const { type } = event.data;

  if (type === 'init') {
    await SegmentationPipeline.getInstance((data) => {
      self.postMessage({ type: 'init_progress', data });
    });
    return;
  }

  if (type === 'process') {
    try {
      self.postMessage({ type: 'processing' });

      const segmenter = await SegmentationPipeline.getInstance();
      const image = new RawImage(
        new Uint8ClampedArray(event.data.imageData.data),
        event.data.imageData.width,
        event.data.imageData.height,
        4, // RGBA channels
      );

      const result = await segmenter(image);

      // result[0].mask が背景除去マスク
      self.postMessage({
        type: 'result',
        maskData: result[0].mask.toImageData(),
      });
    } catch (error) {
      self.postMessage({
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
});
```

### 5.4 メインスレッド側の Worker 管理

```typescript
// src/main.ts（Worker 管理部分の抜粋）

const worker = new Worker(
  new URL('./worker.ts', import.meta.url),
  { type: 'module' },
);

/** Worker へ初期化リクエスト送信 */
function initModel(): void {
  worker.postMessage({ type: 'init' });
}

/** 画像を Worker へ送信して処理 */
function processImage(imageData: ImageData): void {
  worker.postMessage({ type: 'process', imageData });
}

/** Worker からの応答を処理 */
worker.addEventListener('message', (event: MessageEvent) => {
  const msg = event.data;

  switch (msg.type) {
    case 'init_progress':
      updateProgressUI(msg.data);
      break;
    case 'init_complete':
      showReadyState(msg.device);
      break;
    case 'processing':
      showProcessingState();
      break;
    case 'result':
      displayResult(msg.maskData);
      break;
    case 'error':
      showError(msg.message);
      break;
  }
});
```

### 5.5 マスクの適用（背景を透明にする処理）

```typescript
// src/utils/image.ts

/**
 * オリジナル画像にマスクを適用して背景を透明にする
 */
export function applyMask(
  original: ImageData,
  mask: ImageData,
): ImageData {
  const canvas = new OffscreenCanvas(original.width, original.height);
  const ctx = canvas.getContext('2d')!;

  // オリジナル画像を描画
  ctx.putImageData(original, 0, 0);

  // マスクを元のサイズにリサイズ（モデル出力は 1024x1024 の場合がある）
  const maskCanvas = new OffscreenCanvas(mask.width, mask.height);
  const maskCtx = maskCanvas.getContext('2d')!;
  maskCtx.putImageData(mask, 0, 0);

  const resizedMaskCanvas = new OffscreenCanvas(original.width, original.height);
  const resizedMaskCtx = resizedMaskCanvas.getContext('2d')!;
  resizedMaskCtx.drawImage(maskCanvas, 0, 0, original.width, original.height);
  const resizedMask = resizedMaskCtx.getImageData(
    0, 0, original.width, original.height,
  );

  // マスクを alpha チャンネルに適用
  const result = ctx.getImageData(0, 0, original.width, original.height);
  for (let i = 0; i < result.data.length; i += 4) {
    // マスクの R チャンネルを alpha として使用
    result.data[i + 3] = resizedMask.data[i];
  }

  return result;
}
```

### 5.6 WebGPU → WASM 自動フォールバック戦略

```
┌─────────────┐
│  アプリ起動   │
└──────┬──────┘
       ▼
┌──────────────────┐     ┌────────────────┐
│ WebGPU で Pipeline │──→ │ 成功: WebGPU 使用 │
│     を初期化       │     └────────────────┘
└──────┬───────────┘
       │ 失敗（例外）
       ▼
┌──────────────────┐     ┌───────────────────┐
│ WASM で Pipeline  │──→ │ 成功: WASM 使用     │
│     を初期化       │     └───────────────────┘
└──────┬───────────┘
       │ 失敗
       ▼
┌──────────────────┐
│ エラー表示        │
│「お使いのブラウザは│
│ 非対応です」       │
└──────────────────┘
```

フォールバックは Worker 内の `SegmentationPipeline.createPipeline()` で自動的に行われる。UI にはどちらのバックエンドが使用されているかを表示する。

### 5.7 モデルキャッシュ戦略

Transformers.js v3 は内部で Cache API を使用してモデルファイルを自動キャッシュする。追加の実装は不要。

```
初回アクセス:
  HuggingFace Hub → ダウンロード → Cache API に保存 → 推論

2回目以降:
  Cache API から読み込み → 推論（ダウンロード不要）
```

- キャッシュは `transformers-cache` という名前の Cache Storage に保存される
- ブラウザの「サイトデータを削除」でキャッシュもクリアされる

---

## 6. UI/UX 仕様

### 6.1 画面レイアウト（1画面完結）

```
┌────────────────────────────────────────┐
│  ヘッダー: アプリ名 + 説明             │
├────────────────────────────────────────┤
│                                        │
│  ┌────────────────────────────────┐    │
│  │                                │    │
│  │   ドラッグ&ドロップゾーン       │    │
│  │   [アイコン]                   │    │
│  │   画像をドロップまたは          │    │
│  │   [ファイルを選択] ボタン       │    │
│  │                                │    │
│  └────────────────────────────────┘    │
│                                        │
│  ┌────────────────────────────────┐    │
│  │  プログレスバー（処理中のみ）    │    │
│  │  「モデルをダウンロード中... 45%」│    │
│  └────────────────────────────────┘    │
│                                        │
│  ┌──────────┬──────────┐              │
│  │ Original │ Removed  │ ← スライダー  │
│  │          │          │              │
│  │          │          │              │
│  └──────────┴──────────┘              │
│                                        │
│  [ダウンロード (PNG)]  [新しい画像]     │
│                                        │
│  バックエンド: WebGPU ✓ | 処理時間: 95ms│
├────────────────────────────────────────┤
│  フッター: プライバシー説明             │
└────────────────────────────────────────┘
```

### 6.2 状態遷移

```
アイドル状態
  │
  ├─→ [画像アップロード] ─→ モデルロード中（初回のみ）
  │                           │
  │                           ▼
  │                        処理中（スピナー表示）
  │                           │
  │                           ▼
  │                        結果表示（スライダー + ダウンロードボタン）
  │                           │
  └───── [新しい画像] ←───────┘
```

### 6.3 ドラッグ&ドロップゾーン

- デフォルト: 破線ボーダー、薄いグレー背景、アップロードアイコン
- ホバー/ドラッグオーバー: ボーダーがアクセントカラーに変化、背景がやや濃くなる
- アップロード中: 画像のサムネイルプレビューに切り替え

### 6.4 プログレスバー

| 状態 | 表示 |
|------|------|
| モデル DL 中 | 「モデルをダウンロード中... {進捗}%」（プログレスバー） |
| モデルロード中 | 「モデルを読み込み中...」（インジケーター） |
| 処理中 | 「背景を除去中...」（スピナー） |
| 完了 | プログレスバー非表示、結果を表示 |
| エラー | エラーメッセージを赤で表示 |

### 6.5 ビフォーアフタースライダー

- 中央にドラッグハンドル（縦線 + 左右矢印アイコン）
- 左側: オリジナル画像
- 右側: 背景除去済み画像（市松模様の透明背景上に表示）
- マウスドラッグまたはタッチでスライダーを移動
- 初期位置: 中央（50%）

実装方針:
```typescript
// src/ui/slider.ts

export function createSlider(
  container: HTMLElement,
  originalSrc: string,
  resultSrc: string,
): void {
  container.innerHTML = `
    <div class="slider-container">
      <div class="slider-image slider-original">
        <img src="${originalSrc}" alt="Original" />
      </div>
      <div class="slider-image slider-result" style="clip-path: inset(0 50% 0 0)">
        <img src="${resultSrc}" alt="Background removed" />
      </div>
      <div class="slider-handle" style="left: 50%">
        <div class="slider-line"></div>
        <div class="slider-grip">⇔</div>
      </div>
    </div>
  `;

  const handle = container.querySelector('.slider-handle') as HTMLElement;
  const resultDiv = container.querySelector('.slider-result') as HTMLElement;

  let isDragging = false;

  const onMove = (clientX: number) => {
    if (!isDragging) return;
    const rect = container.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    handle.style.left = `${x * 100}%`;
    resultDiv.style.clipPath = `inset(0 ${(1 - x) * 100}% 0 0)`;
  };

  handle.addEventListener('mousedown', () => (isDragging = true));
  handle.addEventListener('touchstart', () => (isDragging = true));
  window.addEventListener('mousemove', (e) => onMove(e.clientX));
  window.addEventListener('touchmove', (e) => onMove(e.touches[0].clientX));
  window.addEventListener('mouseup', () => (isDragging = false));
  window.addEventListener('touchend', () => (isDragging = false));
}
```

### 6.6 レスポンシブ対応

- モバイル（~768px）: シングルカラム、フルワイドのドロップゾーン
- デスクトップ（768px~）: max-width: 800px で中央配置
- 画像プレビュー: `object-fit: contain` で比率維持

---

## 7. 実装ステップ（推奨順序）

### Phase 1: プロジェクトセットアップ + 最小動作確認

```bash
npm create vite@latest bg-removal-app -- --template vanilla-ts
cd bg-removal-app
npm install @huggingface/transformers
npm install -D vite
```

**Vite 設定**:

```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],
  },
  worker: {
    format: 'es',
  },
});
```

> `@huggingface/transformers` を `optimizeDeps.exclude` に追加する必要がある。これは ONNX Runtime の WASM ファイルが Vite の依存関係最適化と競合するため。

**ゴール**: `npm run dev` で起動し、コンソールに「Hello」が出る状態

### Phase 2: Web Worker + Transformers.js 統合

- `src/worker.ts` を作成（セクション 5.3 のコード）
- メインスレッドから Worker を起動
- テスト画像で背景除去が動作することを確認
- WebGPU / WASM フォールバックの動作確認

**ゴール**: ハードコードした画像 URL で背景除去結果がコンソールに出る

### Phase 3: UI 実装

- ドラッグ&ドロップゾーン
- 画像プレビュー
- ビフォーアフタースライダー
- ダウンロードボタン

**ゴール**: 画像をドロップして結果をスライダーで確認し、ダウンロードできる

### Phase 4: プログレス表示 + エラーハンドリング

- モデル DL 進捗バー
- 処理中スピナー
- エラーメッセージ表示
- WebGPU / WASM バックエンド表示

**ゴール**: 初回ロードでプログレスバーが動き、エラー時に適切なメッセージが出る

### Phase 5: 複数画像対応 + 仕上げ

- 「新しい画像」ボタンで状態リセット
- 2枚目以降はモデルキャッシュにより即座に処理
- レスポンシブ CSS 調整
- 処理時間表示
- ファビコン設定

**ゴール**: 完成品として公開可能な状態

---

## 8. 参考リソース

### 公式ドキュメント

- [Transformers.js v3 公式ドキュメント](https://huggingface.co/docs/transformers.js)
- [Transformers.js GitHub リポジトリ](https://github.com/huggingface/transformers.js)
- [Transformers.js v3 リリースブログ](https://huggingface.co/blog/transformersjs-v3)
- [WebGPU ガイド (Transformers.js)](https://huggingface.co/docs/transformers.js/guides/webgpu)

### モデル

- [briaai/RMBG-1.4 (Hugging Face)](https://huggingface.co/briaai/RMBG-1.4)
- [briaai/RMBG-2.0 (Apache-2.0 ライセンス)](https://huggingface.co/briaai/RMBG-2.0)
- [RMBG-1.4 デモ (Hugging Face Space)](https://huggingface.co/spaces/briaai/BRIA-RMBG-1.4)

### 実装例

- [Transformers.js Web Worker チュートリアル (React)](https://github.com/huggingface/transformers.js/blob/main/docs/source/tutorials/react.md)
- [Transformers.js Web Worker チュートリアル (Next.js)](https://github.com/huggingface/transformers.js/blob/main/docs/source/tutorials/next.md)

### WebGPU

- [WebGPU ブラウザサポート状況](https://caniuse.com/webgpu)
- [Chrome WebGPU ドキュメント](https://developer.chrome.com/docs/web-platform/webgpu)

---

## 9. 制約・リスク

### 技術的制約

| リスク | 影響度 | 対策 |
|--------|--------|------|
| Linux の WebGPU サポートが限定的 | 中 | WASM フォールバックで対応 |
| モデルサイズ (FP16: ~88MB) の初回 DL 時間 | 中 | プログレスバー表示 + Cache API |
| 4K 画像等でのブラウザメモリ制限 | 中 | 大きな画像はリサイズしてから処理 |
| iOS Safari の WebGPU 対応が限定的 | 低 | WASM フォールバック |
| Web Worker 内での WebGPU デバイスアクセス | 低 | Worker 内で `navigator.gpu` が利用可能か確認 |

### ライセンスに関する注意

- **briaai/RMBG-1.4**: bria-rmbg-1.4 ライセンス（非商用）。商用利用する場合は RMBG-2.0 (Apache-2.0) への切り替えを検討
- **@huggingface/transformers**: Apache-2.0 ライセンス
- **@imgly/background-removal**: AGPL-3.0（本プロジェクトでは不採用）

### パフォーマンス考慮事項

- 初回モデル DL に 5-15 秒かかるため、UX 上プログレス表示が必須
- WebGPU 対応ブラウザでは ~100ms で処理完了するが、WASM では ~2秒かかる
- メモリ使用量はピーク時 300-500MB に達するため、低スペック端末では注意が必要
