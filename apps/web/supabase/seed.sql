-- =============================================================
-- Seed data for local development
-- Login: test@example.com / password123
-- =============================================================

-- Test user
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'authenticated', 'authenticated',
  'test@example.com',
  crypt('password123', gen_salt('bf')),
  now(),
  '', '', '', '',
  '{"provider":"email","providers":["email"]}',
  '{}', now(), now()
);

-- Identity record (required for Supabase Auth login)
INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  '11111111-1111-1111-1111-111111111111',
  'test@example.com',
  jsonb_build_object('sub', '11111111-1111-1111-1111-111111111111', 'email', 'test@example.com'),
  'email',
  now(), now(), now()
);

-- Storage bucket (matches production setup)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('board-images', 'board-images', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- Board
-- =============================================================

INSERT INTO boards (id, user_id, title, node_order, created_at, updated_at)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  'Welcome Board',
  '["bbbbbbbb-0001-0000-0000-000000000000","bbbbbbbb-0002-0000-0000-000000000000","bbbbbbbb-0003-0000-0000-000000000000","bbbbbbbb-0004-0000-0000-000000000000"]'::jsonb,
  now(), now()
);

-- =============================================================
-- Nodes
-- =============================================================

-- Text node 1
INSERT INTO nodes (id, board_id, user_id, type, x, y, width, height, color, content, created_at, updated_at)
VALUES (
  'bbbbbbbb-0001-0000-0000-000000000000',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  'text', 100, 100, 280, 200, NULL,
  '{"content_markdown": "# Welcome\nThis is your first card.", "height_mode": "auto"}',
  now(), now()
);

-- Text node 2
INSERT INTO nodes (id, board_id, user_id, type, x, y, width, height, color, content, created_at, updated_at)
VALUES (
  'bbbbbbbb-0002-0000-0000-000000000000',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  'text', 500, 100, 280, 150, '1',
  '{"content_markdown": "## Ideas\n- Brainstorm here\n- Add connections", "height_mode": "auto"}',
  now(), now()
);

-- Text node 3
INSERT INTO nodes (id, board_id, user_id, type, x, y, width, height, color, content, created_at, updated_at)
VALUES (
  'bbbbbbbb-0003-0000-0000-000000000000',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  'text', 300, 400, 280, 120, '4',
  '{"content_markdown": "A connected thought", "height_mode": "auto"}',
  now(), now()
);

-- Image node (placeholder, no actual image file)
INSERT INTO nodes (id, board_id, user_id, type, x, y, width, height, color, content, created_at, updated_at)
VALUES (
  'bbbbbbbb-0004-0000-0000-000000000000',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  'image', 700, 350, 300, 200, NULL,
  '{"caption": "Sample image", "asset_id": "seed-placeholder", "height_mode": "fixed"}',
  now(), now()
);

-- =============================================================
-- Edges
-- =============================================================

-- Edge: node1 -> node2
INSERT INTO edges (id, board_id, user_id, from_node, to_node, from_anchor, to_anchor, direction, line_style, label, color, created_at, updated_at)
VALUES (
  'cccccccc-0001-0000-0000-000000000000',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  'bbbbbbbb-0001-0000-0000-000000000000',
  'bbbbbbbb-0002-0000-0000-000000000000',
  'right', 'left', 'forward', 'solid', '', NULL,
  now(), now()
);

-- Edge: node1 -> node3
INSERT INTO edges (id, board_id, user_id, from_node, to_node, from_anchor, to_anchor, direction, line_style, label, color, created_at, updated_at)
VALUES (
  'cccccccc-0002-0000-0000-000000000000',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  'bbbbbbbb-0001-0000-0000-000000000000',
  'bbbbbbbb-0003-0000-0000-000000000000',
  'bottom', 'top', 'forward', 'solid', 'related', NULL,
  now(), now()
);

-- Edge: node2 -> node3
INSERT INTO edges (id, board_id, user_id, from_node, to_node, from_anchor, to_anchor, direction, line_style, label, color, created_at, updated_at)
VALUES (
  'cccccccc-0003-0000-0000-000000000000',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  'bbbbbbbb-0002-0000-0000-000000000000',
  'bbbbbbbb-0003-0000-0000-000000000000',
  'bottom', 'top', 'both', 'solid', '', NULL,
  now(), now()
);

-- =============================================================
-- Group + members
-- =============================================================

INSERT INTO groups (id, board_id, user_id, label, color, created_at, updated_at)
VALUES (
  'dddddddd-0001-0000-0000-000000000000',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  'Main Ideas', '1',
  now(), now()
);

INSERT INTO group_members (group_id, node_id) VALUES
  ('dddddddd-0001-0000-0000-000000000000', 'bbbbbbbb-0001-0000-0000-000000000000'),
  ('dddddddd-0001-0000-0000-000000000000', 'bbbbbbbb-0002-0000-0000-000000000000');
