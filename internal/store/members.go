package store

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
)

// Roles a member can hold in a space. Owners manage the team; editors do
// everything else.
const (
	RoleOwner  = "owner"
	RoleEditor = "editor"
)

type Member struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	Role   string `json:"role"`
}

// Invite is a pending account for someone who has no user yet. The code is the
// whole secret, so it is only ever returned to the space owner who made it and
// to whoever redeems it.
type Invite struct {
	Code      string `json:"code"`
	Email     string `json:"email"`
	SpaceID   string `json:"space_id"`
	SpaceName string `json:"space_name,omitempty"`
	Role      string `json:"role"`
	CreatedAt string `json:"created_at"`
	ExpiresAt string `json:"expires_at"`
}

func normalizeRole(role string) string {
	if strings.EqualFold(role, RoleOwner) {
		return RoleOwner
	}
	return RoleEditor
}

// RequireOwner is the gate on every team change: an editor can run the month,
// but only an owner changes who else gets in.
func (s *Store) RequireOwner(spaceID, userID string) error {
	sp, err := s.SpaceForUser(spaceID, userID)
	if err != nil {
		return err
	}
	if sp.Role != RoleOwner {
		return ErrForbidden
	}
	return nil
}

func (s *Store) ListMembers(spaceID, actorID string) ([]Member, error) {
	if _, err := s.SpaceForUser(spaceID, actorID); err != nil {
		return nil, err
	}
	rows, err := s.DB.Query(`
		SELECT m.user_id, u.email, m.role
		FROM space_members m JOIN users u ON u.id = m.user_id
		WHERE m.space_id = ?
		ORDER BY m.role = 'owner' DESC, u.email`, spaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Member, 0)
	for rows.Next() {
		var m Member
		if err := rows.Scan(&m.UserID, &m.Email, &m.Role); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// AddMemberByEmail joins an existing account to a space. It reports ErrNotFound
// when nobody owns that address, which is the caller's cue to write an invite
// instead.
func (s *Store) AddMemberByEmail(spaceID, actorID, email, role string) (Member, error) {
	if err := s.RequireOwner(spaceID, actorID); err != nil {
		return Member{}, err
	}
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		return Member{}, fmt.Errorf("%w: email", ErrInvalid)
	}
	var m Member
	err := s.DB.QueryRow(`SELECT id, email FROM users WHERE email = ?`, email).Scan(&m.UserID, &m.Email)
	if errors.Is(err, sql.ErrNoRows) {
		return Member{}, ErrNotFound
	}
	if err != nil {
		return Member{}, err
	}
	m.Role = normalizeRole(role)
	_, err = s.DB.Exec(`
		INSERT INTO space_members (space_id, user_id, role) VALUES (?, ?, ?)
		ON CONFLICT(space_id, user_id) DO UPDATE SET role = excluded.role`,
		spaceID, m.UserID, m.Role,
	)
	return m, err
}

// RemoveMember drops someone from a space. The owner stays: a space with no
// owner is a space nobody can administer.
func (s *Store) RemoveMember(spaceID, actorID, userID string) error {
	if err := s.RequireOwner(spaceID, actorID); err != nil {
		return err
	}
	var ownerID string
	if err := s.DB.QueryRow(`SELECT owner_id FROM spaces WHERE id = ?`, spaceID).Scan(&ownerID); err != nil {
		return err
	}
	if ownerID == userID {
		return fmt.Errorf("%w: cannot remove the owner", ErrInvalid)
	}
	_, err := s.DB.Exec(`DELETE FROM space_members WHERE space_id = ? AND user_id = ?`, spaceID, userID)
	return err
}

func (s *Store) CreateInvite(spaceID, actorID, email, role string, ttl time.Duration) (Invite, error) {
	if err := s.RequireOwner(spaceID, actorID); err != nil {
		return Invite{}, err
	}
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		return Invite{}, fmt.Errorf("%w: email", ErrInvalid)
	}
	inv := Invite{
		Code:      NewID(),
		Email:     email,
		SpaceID:   spaceID,
		Role:      normalizeRole(role),
		CreatedAt: now(),
		ExpiresAt: time.Now().UTC().Add(ttl).Format(time.RFC3339Nano),
	}
	// One live invite per address per space: re-inviting reissues the code
	// rather than leaving a trail of valid ones.
	if _, err := s.DB.Exec(
		`DELETE FROM invites WHERE space_id = ? AND email = ? AND redeemed_at IS NULL`,
		spaceID, email,
	); err != nil {
		return Invite{}, err
	}
	_, err := s.DB.Exec(`
		INSERT INTO invites (code, email, space_id, role, created_by, created_at, expires_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		inv.Code, inv.Email, inv.SpaceID, inv.Role, actorID, inv.CreatedAt, inv.ExpiresAt,
	)
	return inv, err
}

func (s *Store) ListInvites(spaceID, actorID string) ([]Invite, error) {
	if err := s.RequireOwner(spaceID, actorID); err != nil {
		return nil, err
	}
	rows, err := s.DB.Query(`
		SELECT code, email, space_id, role, created_at, expires_at
		FROM invites
		WHERE space_id = ? AND redeemed_at IS NULL AND expires_at > ?
		ORDER BY created_at DESC`, spaceID, now())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Invite, 0)
	for rows.Next() {
		var inv Invite
		if err := rows.Scan(&inv.Code, &inv.Email, &inv.SpaceID, &inv.Role, &inv.CreatedAt, &inv.ExpiresAt); err != nil {
			return nil, err
		}
		out = append(out, inv)
	}
	return out, rows.Err()
}

func (s *Store) RevokeInvite(spaceID, actorID, code string) error {
	if err := s.RequireOwner(spaceID, actorID); err != nil {
		return err
	}
	res, err := s.DB.Exec(
		`DELETE FROM invites WHERE space_id = ? AND code = ? AND redeemed_at IS NULL`,
		spaceID, code,
	)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// InviteByCode resolves a pending invite for the signup screen. It carries the
// space name so the person can see what they are joining, and nothing else.
func (s *Store) InviteByCode(code string) (Invite, error) {
	var inv Invite
	err := s.DB.QueryRow(`
		SELECT i.code, i.email, i.space_id, COALESCE(p.name, ''), i.role, i.created_at, i.expires_at
		FROM invites i LEFT JOIN spaces p ON p.id = i.space_id
		WHERE i.code = ? AND i.redeemed_at IS NULL`, code,
	).Scan(&inv.Code, &inv.Email, &inv.SpaceID, &inv.SpaceName, &inv.Role, &inv.CreatedAt, &inv.ExpiresAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Invite{}, ErrNotFound
	}
	if err != nil {
		return Invite{}, err
	}
	if inv.ExpiresAt <= now() {
		return Invite{}, ErrNotFound
	}
	return inv, nil
}

// RedeemInvite turns a pending invite into an account joined to its space. The
// email comes from the invite, never from the request, so a code cannot be used
// to claim a different address.
func (s *Store) RedeemInvite(code, password string) (User, error) {
	inv, err := s.InviteByCode(code)
	if err != nil {
		return User{}, err
	}
	u, err := s.CreateUser(inv.Email, password)
	if err != nil {
		return User{}, err
	}
	tx, err := s.DB.Begin()
	if err != nil {
		return User{}, err
	}
	defer func() { _ = tx.Rollback() }()
	if inv.SpaceID != "" {
		if _, err := tx.Exec(
			`INSERT INTO space_members (space_id, user_id, role) VALUES (?, ?, ?)
			 ON CONFLICT(space_id, user_id) DO UPDATE SET role = excluded.role`,
			inv.SpaceID, u.ID, inv.Role,
		); err != nil {
			return User{}, err
		}
	}
	if _, err := tx.Exec(
		`UPDATE invites SET redeemed_at = ?, redeemed_by = ? WHERE code = ?`,
		now(), u.ID, code,
	); err != nil {
		return User{}, err
	}
	if err := tx.Commit(); err != nil {
		return User{}, err
	}
	return u, nil
}
