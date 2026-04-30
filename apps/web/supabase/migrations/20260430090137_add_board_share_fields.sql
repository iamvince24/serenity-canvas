-- boards 表新增分享欄位
-- 不加 UNIQUE，由下方 partial unique index 處理（避免 redundant b-tree）
ALTER TABLE boards
  ADD COLUMN share_mode text NOT NULL DEFAULT 'private'
    CHECK (share_mode IN ('private', 'public')),
  ADD COLUMN share_id text,
  ADD COLUMN share_assets_status text NOT NULL DEFAULT 'pending'
    CHECK (share_assets_status IN ('pending', 'ready', 'partial', 'failed'));

-- DB-level invariant：
-- 1. share_id 必須符合 nanoid 10 字元格式（防 owner / bug 寫入過短 / 含 slash / 注入字串）
-- 2. share_mode = 'public' 時 share_id 不可 NULL（否則 is_public_board() 會把無效連結當公開）
ALTER TABLE boards
  ADD CONSTRAINT boards_share_id_format
    CHECK (share_id IS NULL OR share_id ~ '^[A-Za-z0-9_-]{10}$'),
  ADD CONSTRAINT boards_public_requires_share_id
    CHECK (share_mode = 'private' OR share_id IS NOT NULL);

-- share_id 反查 board 用：partial unique index（NULL 友善 + 不會 redundant）
CREATE UNIQUE INDEX idx_boards_share_id
  ON boards (share_id)
  WHERE share_id IS NOT NULL;

-- 子表 board_id indexes
-- get_public_board_by_share_id() RPC 的 public_version 子查詢對四張子表各跑
-- scalar subquery max(updated_at)；節點 RLS（階段 05）也走 board_id。
CREATE INDEX IF NOT EXISTS idx_nodes_board_id ON nodes (board_id);
CREATE INDEX IF NOT EXISTS idx_edges_board_id ON edges (board_id);
CREATE INDEX IF NOT EXISTS idx_files_board_id ON files (board_id);
CREATE INDEX IF NOT EXISTS idx_files_board_asset ON files (board_id, asset_id);

-- SECURITY DEFINER helper：判斷 board 是否為公開
CREATE OR REPLACE FUNCTION public.is_public_board(p_board_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM boards
    WHERE id = p_board_id
      AND share_mode = 'public'
  );
$$;
REVOKE ALL ON FUNCTION public.is_public_board(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_public_board(uuid) TO anon, authenticated;

-- shareId-scoped 公開讀取 RPC：由 share_id 取得 public board metadata
CREATE OR REPLACE FUNCTION public.get_public_board_by_share_id(p_share_id text)
RETURNS TABLE (
  id uuid,
  title text,
  share_id text,
  share_mode text,
  share_assets_status text,
  updated_at timestamptz,
  created_at timestamptz,
  node_count integer,
  public_version bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    b.id,
    b.title,
    b.share_id,
    b.share_mode,
    b.share_assets_status,
    b.updated_at,
    b.created_at,
    COALESCE(jsonb_array_length(b.node_order), 0)::integer AS node_count,
    EXTRACT(EPOCH FROM greatest(
      b.updated_at,
      COALESCE(
        (SELECT max(n.updated_at) FROM nodes n WHERE n.board_id = b.id),
        b.updated_at
      ),
      COALESCE(
        (SELECT max(e.updated_at) FROM edges e WHERE e.board_id = b.id),
        b.updated_at
      ),
      COALESCE(
        (SELECT max(g.updated_at) FROM groups g WHERE g.board_id = b.id),
        b.updated_at
      ),
      COALESCE(
        (SELECT max(f.updated_at) FROM files f WHERE f.board_id = b.id),
        b.updated_at
      )
    ))::bigint AS public_version
  FROM boards b
  WHERE b.share_mode = 'public'
    AND b.share_id = p_share_id
    AND p_share_id ~ '^[A-Za-z0-9_-]{10}$';
$$;
REVOKE ALL ON FUNCTION public.get_public_board_by_share_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_board_by_share_id(text) TO anon, authenticated;

-- shareId-scoped 公開讀取 RPC：由 board_id 取得該 public board 的 file metadata
CREATE OR REPLACE FUNCTION public.get_public_files_by_board_id(p_board_id uuid)
RETURNS TABLE (
  id uuid,
  board_id uuid,
  asset_id text,
  mime_type text,
  original_width int,
  original_height int,
  public_image_path text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    f.id,
    f.board_id,
    f.asset_id,
    f.mime_type,
    f.original_width,
    f.original_height,
    (f.board_id::text || '/' || f.asset_id) AS public_image_path
  FROM files f
  WHERE public.is_public_board(p_board_id)
    AND f.board_id = p_board_id;
$$;
REVOKE ALL ON FUNCTION public.get_public_files_by_board_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_files_by_board_id(uuid) TO anon, authenticated;

-- 公開圖片 bucket（與既有 board-images 隔離）
INSERT INTO storage.buckets (id, name, public)
VALUES ('public-images', 'public-images', true)
ON CONFLICT (id) DO NOTHING;
