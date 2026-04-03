# Host Transfer Failure

## Symptoms
- Host disconnects but no new host is assigned
- Players cannot start new rounds or end the game
- "Only the host can..." errors for all remaining players

## Detection
- Alert: game in 'playing' status where created_by player has last_seen_at > 5 minutes ago
- Check presence-scan job health
  ```sql
  SELECT * FROM job_health WHERE job_name = 'presence-scan';
  ```
- Find orphaned games:
  ```sql
  SELECT gs.id, gs.created_by, gp.last_seen_at
  FROM game_sessions gs
  JOIN game_players gp ON gs.id = gp.game_id AND gs.created_by = gp.player_id
  WHERE gs.status = 'playing'
    AND gp.last_seen_at < NOW() - interval '5 minutes';
  ```

## Recovery Steps
1. Check if presence-scan is running (job_health table)
2. Manual host transfer via SQL:
   ```sql
   -- Pick the longest-tenured active player
   UPDATE game_sessions SET created_by = (
     SELECT player_id FROM game_players
     WHERE game_id = '<game_id>'
       AND last_seen_at > NOW() - interval '60 seconds'
     ORDER BY joined_at ASC
     LIMIT 1
   ) WHERE id = '<game_id>';
   ```
3. Broadcast host_changed event to game channel
4. If no active players remain, end the game:
   ```sql
   UPDATE game_sessions SET status = 'finished', finished_at = NOW() WHERE id = '<game_id>';
   UPDATE rooms SET status = 'finished' WHERE id = '<room_id>';
   ```

## Prevention
- presence-scan runs every 60 seconds
- Host transfer triggers after 60 seconds of host disconnection
- Players see "host disconnected" announcement with countdown
