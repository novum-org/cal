package store

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/novum-org/cal/internal/sources"
)

// Source configs hold store secrets and bot tokens. They are per session, so
// two servers on one instance never share credentials, and they are only ever
// read server-side: nothing here is shaped to be sent to a browser.

func (s *Store) SetSourceConfig(spaceID, sourceID string, cfg json.RawMessage) error {
	if sourceID == "" {
		return fmt.Errorf("%w: source", ErrInvalid)
	}
	if !json.Valid(cfg) {
		return fmt.Errorf("%w: config", ErrInvalid)
	}
	_, err := s.DB.Exec(
		`INSERT INTO source_secrets (space_id, source_id, config_json) VALUES (?, ?, ?)
		 ON CONFLICT(space_id, source_id) DO UPDATE SET config_json = excluded.config_json`,
		spaceID, sourceID, string(cfg),
	)
	return err
}

func (s *Store) DeleteSourceConfig(spaceID, sourceID string) error {
	_, err := s.DB.Exec(
		`DELETE FROM source_secrets WHERE space_id = ? AND source_id = ?`, spaceID, sourceID)
	return err
}

func (s *Store) SourceConfig(spaceID, sourceID string) (json.RawMessage, error) {
	var raw string
	err := s.DB.QueryRow(
		`SELECT config_json FROM source_secrets WHERE space_id = ? AND source_id = ?`,
		spaceID, sourceID,
	).Scan(&raw)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return json.RawMessage(raw), nil
}

// SourceConfigs is every source configured for a session, ready to hand to the
// registry.
func (s *Store) SourceConfigs(spaceID string) ([]sources.Config, error) {
	rows, err := s.DB.Query(
		`SELECT source_id, config_json FROM source_secrets WHERE space_id = ? ORDER BY source_id`,
		spaceID,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	out := []sources.Config{}
	for rows.Next() {
		var c sources.Config
		var raw string
		if err := rows.Scan(&c.SourceID, &raw); err != nil {
			return nil, err
		}
		c.Raw = json.RawMessage(raw)
		out = append(out, c)
	}
	return out, rows.Err()
}
