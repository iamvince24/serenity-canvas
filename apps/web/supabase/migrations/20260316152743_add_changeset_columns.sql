-- Add changeset columns for MCP Server integration
-- Nodes: changeset_id + change_status
ALTER TABLE nodes ADD COLUMN changeset_id uuid DEFAULT NULL;
ALTER TABLE nodes ADD COLUMN change_status text DEFAULT 'accepted'
  CHECK (change_status IN ('accepted', 'pending'));

-- Edges: changeset_id + change_status
ALTER TABLE edges ADD COLUMN changeset_id uuid DEFAULT NULL;
ALTER TABLE edges ADD COLUMN change_status text DEFAULT 'accepted'
  CHECK (change_status IN ('accepted', 'pending'));

-- Indexes: speed up frontend queries for pending changesets
CREATE INDEX idx_nodes_changeset ON nodes (changeset_id) WHERE changeset_id IS NOT NULL;
CREATE INDEX idx_edges_changeset ON edges (changeset_id) WHERE changeset_id IS NOT NULL;
