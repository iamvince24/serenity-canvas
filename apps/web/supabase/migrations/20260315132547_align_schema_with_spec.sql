-- =============================================================
-- 1. Column renames (metadata-only, no data rewrite)
-- =============================================================

-- boards: owner_id -> user_id
ALTER TABLE boards RENAME COLUMN owner_id TO user_id;

-- edges: source_id -> from_node, target_id -> to_node
ALTER TABLE edges RENAME COLUMN source_id TO from_node;
ALTER TABLE edges RENAME COLUMN target_id TO to_node;

-- edges: source_anchor -> from_anchor, target_anchor -> to_anchor
ALTER TABLE edges RENAME COLUMN source_anchor TO from_anchor;
ALTER TABLE edges RENAME COLUMN target_anchor TO to_anchor;

-- =============================================================
-- 2. edges: add missing columns
-- =============================================================

-- updated_at: required for sync LWW guard
ALTER TABLE edges ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

-- user_id: direct RLS without JOIN
ALTER TABLE edges ADD COLUMN user_id uuid REFERENCES auth.users(id);
UPDATE edges SET user_id = boards.user_id
  FROM boards WHERE edges.board_id = boards.id;
ALTER TABLE edges ALTER COLUMN user_id SET NOT NULL;

-- color
ALTER TABLE edges ADD COLUMN color text;

-- =============================================================
-- 3. nodes: add missing columns
-- =============================================================

ALTER TABLE nodes ADD COLUMN user_id uuid REFERENCES auth.users(id);
UPDATE nodes SET user_id = boards.user_id
  FROM boards WHERE nodes.board_id = boards.id;
ALTER TABLE nodes ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE nodes ADD COLUMN source_url text;
ALTER TABLE nodes ADD COLUMN source_title text;

-- =============================================================
-- 4. sync_guard function + triggers
-- =============================================================

CREATE OR REPLACE FUNCTION sync_guard()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  IF OLD IS NOT NULL AND NEW.updated_at <= OLD.updated_at THEN
    RETURN NULL;  -- cancel stale update
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_guard_boards BEFORE INSERT OR UPDATE ON boards
  FOR EACH ROW EXECUTE FUNCTION sync_guard();
CREATE TRIGGER sync_guard_nodes BEFORE INSERT OR UPDATE ON nodes
  FOR EACH ROW EXECUTE FUNCTION sync_guard();
CREATE TRIGGER sync_guard_edges BEFORE INSERT OR UPDATE ON edges
  FOR EACH ROW EXECUTE FUNCTION sync_guard();
CREATE TRIGGER sync_guard_groups BEFORE INSERT OR UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION sync_guard();

-- =============================================================
-- 5. Update RLS policies (use direct user_id)
-- =============================================================

-- boards
DROP POLICY IF EXISTS "owner can do all on boards" ON boards;
CREATE POLICY "users_own_boards" ON boards
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- nodes
DROP POLICY IF EXISTS "owner can do all on nodes" ON nodes;
CREATE POLICY "users_own_nodes" ON nodes
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- edges
DROP POLICY IF EXISTS "owner can do all on edges" ON edges;
CREATE POLICY "users_own_edges" ON edges
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- files: drop old JOIN-based policies, create simplified one
DROP POLICY IF EXISTS "files_select_owner" ON files;
DROP POLICY IF EXISTS "files_insert_owner" ON files;
DROP POLICY IF EXISTS "files_update_owner" ON files;
DROP POLICY IF EXISTS "files_delete_owner" ON files;
CREATE POLICY "files_owner" ON files
  FOR ALL USING (board_id IN (SELECT id FROM boards WHERE user_id = auth.uid()))
  WITH CHECK (board_id IN (SELECT id FROM boards WHERE user_id = auth.uid()));

-- =============================================================
-- 6. Create inbox_items table
-- =============================================================

CREATE TABLE inbox_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  content text NOT NULL,
  source_url text,
  source_title text,
  target_board_id uuid REFERENCES boards(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE inbox_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_inbox" ON inbox_items
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
