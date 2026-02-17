# 資料模型 (Data Model)

## DB Schema

### boards

白板。登入使用者可擁有多個。

| 欄位         | 型別                     | 說明                                                       |
| :----------- | :----------------------- | :--------------------------------------------------------- |
| `id`         | `uuid` (PK)              | 預設 `gen_random_uuid()`                                   |
| `user_id`    | `uuid` (FK → auth.users) | NOT NULL，RLS 依據                                         |
| `title`      | `text`                   | NOT NULL，白板名稱                                         |
| `deleted_at` | `timestamptz`            | Soft delete 標記（nullable）                               |
| `created_at` | `timestamptz`            | NOT NULL，預設 `now()`                                     |
| `updated_at` | `timestamptz`            | NOT NULL，預設 `now()`，由 DB trigger 自動設定 server 時間 |

### nodes

卡片（文字 / 圖片）。單表設計，透過 `type` 區分。詳見 ADR-B02。

| 欄位           | 型別                     | 說明                                                                 |
| :------------- | :----------------------- | :------------------------------------------------------------------- |
| `id`           | `uuid` (PK)              | 預設 `gen_random_uuid()`                                             |
| `board_id`     | `uuid` (FK → boards)     | NOT NULL，所屬白板                                                   |
| `user_id`      | `uuid` (FK → auth.users) | NOT NULL，RLS 依據                                                   |
| `type`         | `text`                   | NOT NULL，`'text'` 或 `'image'`（CHECK constraint）                  |
| `x`            | `float8`                 | NOT NULL，畫布座標                                                   |
| `y`            | `float8`                 | NOT NULL，畫布座標                                                   |
| `width`        | `float8`                 | NOT NULL，卡片寬度                                                   |
| `height`       | `float8`                 | NOT NULL，卡片高度                                                   |
| `content`      | `text`                   | Markdown 內容（文字卡片的主要內容；圖片卡片的底部說明）              |
| `color`        | `text`                   | 卡片顏色，對應 Obsidian Canvas 的 6 種顏色（nullable）               |
| `image_path`   | `text`                   | 圖片在 Supabase Storage 的路徑（僅 `type = 'image'` 使用，nullable） |
| `source_url`   | `text`                   | 來源網址（從收件匣拖入或 Extension 剪藏時保留，nullable）            |
| `source_title` | `text`                   | 來源標題（nullable）                                                 |
| `deleted_at`   | `timestamptz`            | Soft delete 標記，離線同步用（nullable）。詳見 ADR-B03。             |
| `created_at`   | `timestamptz`            | NOT NULL，預設 `now()`                                               |
| `updated_at`   | `timestamptz`            | NOT NULL，預設 `now()`，由 DB trigger 自動設定 server 時間           |

> [!note] Polymorphic 設計決策
> 文字卡片與圖片卡片差異僅 `image_path` 一個欄位，分表的複雜度不值得。前端用 TypeScript discriminated union 做型別區分。詳見 ADR-B02。

### edges

連線。記錄卡片之間的關係。

| 欄位         | 型別                     | 說明                                                                            |
| :----------- | :----------------------- | :------------------------------------------------------------------------------ |
| `id`         | `uuid` (PK)              | 預設 `gen_random_uuid()`                                                        |
| `board_id`   | `uuid` (FK → boards)     | NOT NULL，所屬白板                                                              |
| `user_id`    | `uuid` (FK → auth.users) | NOT NULL，RLS 依據                                                              |
| `from_node`  | `uuid` (FK → nodes)      | NOT NULL，起點卡片                                                              |
| `to_node`    | `uuid` (FK → nodes)      | NOT NULL，終點卡片                                                              |
| `direction`  | `text`                   | NOT NULL，`'none'` / `'forward'` / `'both'`（CHECK constraint）。詳見 ADR-B02。 |
| `label`      | `text`                   | 連線上的文字標籤（如「因果關係」、「反對」，nullable）                          |
| `deleted_at` | `timestamptz`            | Soft delete 標記（nullable）                                                    |
| `created_at` | `timestamptz`            | NOT NULL，預設 `now()`                                                          |
| `updated_at` | `timestamptz`            | NOT NULL，預設 `now()`，由 DB trigger 自動設定 server 時間                      |

> [!note] direction 與 Obsidian 匯出的對應
> | direction | Obsidian fromEnd | Obsidian toEnd |
> |:----------|:-----------------|:---------------|
> | `none` | none | none |
> | `forward` | none | arrow |
> | `both` | arrow | arrow |

### groups

群組。框選多張卡片建立的群組。

| 欄位         | 型別                     | 說明                                                       |
| :----------- | :----------------------- | :--------------------------------------------------------- |
| `id`         | `uuid` (PK)              | 預設 `gen_random_uuid()`                                   |
| `board_id`   | `uuid` (FK → boards)     | NOT NULL，所屬白板                                         |
| `user_id`    | `uuid` (FK → auth.users) | NOT NULL，RLS 依據                                         |
| `label`      | `text`                   | 群組名稱（nullable）                                       |
| `color`      | `text`                   | 群組顏色（nullable）                                       |
| `deleted_at` | `timestamptz`            | Soft delete 標記（nullable）                               |
| `created_at` | `timestamptz`            | NOT NULL，預設 `now()`                                     |
| `updated_at` | `timestamptz`            | NOT NULL，預設 `now()`，由 DB trigger 自動設定 server 時間 |

### group_members

群組與卡片的多對多關聯。一張卡片可屬於多個群組。詳見 ADR-B02。

| 欄位       | 型別                 | 說明         |
| :--------- | :------------------- | :----------- |
| `group_id` | `uuid` (FK → groups) | 複合主鍵之一 |
| `node_id`  | `uuid` (FK → nodes)  | 複合主鍵之一 |

主鍵：`(group_id, node_id)`

### inbox_items

收件匣項目（登入使用者限定）。單一收件匣，可選擇性標記目標白板。拖入白板後刪除此記錄，來源資訊保留在 node 上。詳見 ADR-B02、ADR-B05。

| 欄位              | 型別                     | 說明                                                    |
| :---------------- | :----------------------- | :------------------------------------------------------ |
| `id`              | `uuid` (PK)              | 預設 `gen_random_uuid()`                                |
| `user_id`         | `uuid` (FK → auth.users) | NOT NULL，RLS 依據                                      |
| `content`         | `text`                   | NOT NULL，Markdown 內容                                 |
| `source_url`      | `text`                   | 來源網址（Extension 剪藏時自動擷取，nullable）          |
| `source_title`    | `text`                   | 來源標題（nullable）                                    |
| `target_board_id` | `uuid` (FK → boards)     | 目標白板標記（nullable）。null = 未分類。詳見 ADR-B05。 |
| `created_at`      | `timestamptz`            | NOT NULL，預設 `now()`                                  |

> [!note] 無 `updated_at`
> 收件匣項目是暫存性質，建立後不編輯，直接拖入白板（建立 node + 刪除 inbox_item）。

> [!note] 收件匣模型
> 只有一個收件匣，不分全域 / 專屬。`target_board_id` 是篩選用的標記，不是歸屬關係。側邊欄可依此欄位篩選顯示。

---

## DB Triggers（離線同步用）

詳見 ADR-B03。

### `set_updated_at`：統一使用 server 時間

前端 upsert 時不傳 `updated_at`，由 trigger 自動填入 PostgreSQL `now()`，避免客戶端時鐘不同步問題。

### `lww_guard`：Last-Write-Wins 保護

比較新舊 `updated_at`，如果傳入的資料比現有的舊，自動取消這次更新。

```sql
-- 合併為單一 trigger function（先設 server 時間，再比較 LWW）
CREATE OR REPLACE FUNCTION sync_guard()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  IF OLD IS NOT NULL AND NEW.updated_at <= OLD.updated_at THEN
    RETURN NULL;  -- 取消更新
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 對需要 LWW 保護的表建立 trigger
CREATE TRIGGER sync_guard_boards BEFORE INSERT OR UPDATE ON boards
  FOR EACH ROW EXECUTE FUNCTION sync_guard();
CREATE TRIGGER sync_guard_nodes BEFORE INSERT OR UPDATE ON nodes
  FOR EACH ROW EXECUTE FUNCTION sync_guard();
CREATE TRIGGER sync_guard_edges BEFORE INSERT OR UPDATE ON edges
  FOR EACH ROW EXECUTE FUNCTION sync_guard();
CREATE TRIGGER sync_guard_groups BEFORE INSERT OR UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION sync_guard();
```

---

## RLS Policies

所有表都啟用 RLS，核心原則：`auth.uid() = user_id`。

```sql
-- boards
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_boards" ON boards
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- nodes
ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_nodes" ON nodes
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- edges
ALTER TABLE edges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_edges" ON edges
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- groups
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_groups" ON groups
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- group_members（透過 JOIN groups 確認 ownership）
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_group_members" ON group_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM groups
      WHERE groups.id = group_members.group_id
      AND groups.user_id = auth.uid()
    )
  );

-- inbox_items
ALTER TABLE inbox_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_inbox" ON inbox_items
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

## ER 關係圖

```
auth.users (Supabase 管理)
  │
  ├── 1:N ── boards
  │            │
  │            ├── 1:N ── nodes ──── N:M ── groups (透過 group_members)
  │            │            ▲  ▲
  │            │            │  │
  │            └── 1:N ── edges (from_node, to_node)
  │
  └── 1:N ── inbox_items (全域，不隸屬白板)
```

---

## 資料流

### 一般編輯流程

```
使用者操作（建立卡片/拖曳/連線/...）
  → Zustand state 更新
  → Command 記錄（Undo/Redo）
  → IndexedDB 寫入（即時）
  → 背景同步至 Supabase（登入使用者）
```

### 收件匣 → 白板流程

```
Extension 剪藏 / 手動新增
  → inbox_items 表（Supabase）

使用者拖曳至白板
  → 建立 node（保留 source_url, source_title）
  → 刪除 inbox_item
  → 兩步驟包在同一個 transaction 或前端 Promise.all
```

### 匯出流程

```
boards + nodes + edges + groups
  → 轉換為 Obsidian Canvas JSON (.canvas)
  → nodes content 轉換為 .md 檔案
  → 圖片從 Supabase Storage 下載
  → JSZip 打包為 .zip（Web Worker）
```
