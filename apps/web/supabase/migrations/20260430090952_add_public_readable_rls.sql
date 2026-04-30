-- nodes: anon can read nodes of public boards
CREATE POLICY "Public board nodes readable by anyone"
  ON nodes FOR SELECT
  USING (public.is_public_board(board_id));

-- edges: anon can read edges of public boards
CREATE POLICY "Public board edges readable by anyone"
  ON edges FOR SELECT
  USING (public.is_public_board(board_id));

-- groups: anon can read groups of public boards
CREATE POLICY "Public board groups readable by anyone"
  ON groups FOR SELECT
  USING (public.is_public_board(board_id));

-- group_members: two-hop join (group_members -> groups -> boards)
CREATE POLICY "Public board group_members readable by anyone"
  ON group_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_members.group_id
        AND public.is_public_board(g.board_id)
    )
  );
