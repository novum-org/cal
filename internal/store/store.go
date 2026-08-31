package store

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/novum-org/cal/internal/engine"
	"golang.org/x/crypto/bcrypt"

	_ "modernc.org/sqlite"
)

var (
	ErrNotFound       = errors.New("not found")
	ErrUnauthorized   = errors.New("unauthorized")
	ErrConflict       = errors.New("conflict")
	ErrForbidden      = errors.New("forbidden")
	ErrAlreadySetup   = errors.New("already setup")
	ErrStaleRevision  = errors.New("stale revision")
	ErrInvalid        = errors.New("invalid")
)

const schema = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS spaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id),
  policy_json TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS space_members (
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  PRIMARY KEY (space_id, user_id)
);

CREATE TABLE IF NOT EXISTS months (
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  inputs_json TEXT NOT NULL,
  actuals_json TEXT,
  planned_json TEXT,
  status TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  PRIMARY KEY (space_id, month)
);

CREATE TABLE IF NOT EXISTS source_secrets (
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  config_json TEXT NOT NULL,
  PRIMARY KEY (space_id, source_id)
);
`

type Store struct {
	DB *sql.DB
}

type User struct {
	ID           string `json:"id"`
	Email        string `json:"email"`
	PasswordHash string `json:"-"`
	CreatedAt    string `json:"created_at"`
}

type Space struct {
	ID        string         `json:"id"`
	Name      string         `json:"name"`
	OwnerID   string         `json:"owner_id"`
	Policy    engine.Policy  `json:"policy"`
	Archived  bool           `json:"archived"`
	Revision  int            `json:"revision"`
	CreatedAt string         `json:"created_at"`
	Role      string         `json:"role,omitempty"`
}

type Month struct {
	SpaceID   string          `json:"space_id"`
	Month     string          `json:"month"`
	Inputs    engine.Inputs   `json:"inputs"`
	Actuals   map[string]float64 `json:"actuals,omitempty"`
	Planned   *engine.Result  `json:"planned,omitempty"`
	Status    string          `json:"status"`
	Revision  int             `json:"revision"`
	UpdatedAt string          `json:"updated_at"`
	UpdatedBy string          `json:"updated_by"`
}

type Dump struct {
	Version    int          `json:"version"`
	ExportedAt string       `json:"exported_at"`
	Users      []DumpUser   `json:"users"`
	Spaces     []DumpSpace  `json:"spaces"`
}

type DumpUser struct {
	ID           string `json:"id"`
	Email        string `json:"email"`
	PasswordHash string `json:"password_hash"`
	CreatedAt    string `json:"created_at"`
}

type DumpSpace struct {
	Space   Space            `json:"space"`
	Members []DumpMember     `json:"members"`
	Months  []Month          `json:"months"`
	Secrets []DumpSecret     `json:"secrets"`
}

type DumpMember struct {
	UserID string `json:"user_id"`
	Role   string `json:"role"`
}

type DumpSecret struct {
	SourceID string          `json:"source_id"`
	Config   json.RawMessage `json:"config"`
}

func NewID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func Open(path string) (*Store, error) {
	if dir := filepath.Dir(path); dir != "." && dir != "" {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return nil, err
		}
	}
	dsn := path + "?_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)"
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(schema); err != nil {
		_ = db.Close()
		return nil, err
	}
	return &Store{DB: db}, nil
}

func (s *Store) Close() error { return s.DB.Close() }

func now() string { return time.Now().UTC().Format(time.RFC3339Nano) }

func (s *Store) UserCount() (int, error) {
	var n int
	err := s.DB.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&n)
	return n, err
}

func (s *Store) CreateUser(email, password string) (User, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" || len(password) < 8 {
		return User{}, fmt.Errorf("%w: email or password", ErrInvalid)
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return User{}, err
	}
	u := User{ID: NewID(), Email: email, CreatedAt: now()}
	_, err = s.DB.Exec(
		`INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)`,
		u.ID, u.Email, string(hash), u.CreatedAt,
	)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			return User{}, ErrConflict
		}
		return User{}, err
	}
	return u, nil
}

func (s *Store) Authenticate(email, password string) (User, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	var u User
	var hash string
	err := s.DB.QueryRow(
		`SELECT id, email, password_hash, created_at FROM users WHERE email = ?`, email,
	).Scan(&u.ID, &u.Email, &hash, &u.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, ErrUnauthorized
	}
	if err != nil {
		return User{}, err
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) != nil {
		return User{}, ErrUnauthorized
	}
	return u, nil
}

func (s *Store) UserByID(id string) (User, error) {
	var u User
	err := s.DB.QueryRow(`SELECT id, email, created_at FROM users WHERE id = ?`, id).
		Scan(&u.ID, &u.Email, &u.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, ErrNotFound
	}
	return u, err
}

func (s *Store) CreateAuth(userID string, ttl time.Duration) (string, error) {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	token := hex.EncodeToString(b)
	exp := time.Now().UTC().Add(ttl).Format(time.RFC3339Nano)
	_, err := s.DB.Exec(
		`INSERT INTO auth_sessions (token, user_id, expires_at) VALUES (?, ?, ?)`,
		token, userID, exp,
	)
	return token, err
}

func (s *Store) UserByToken(token string) (User, error) {
	if token == "" {
		return User{}, ErrUnauthorized
	}
	var u User
	var exp string
	err := s.DB.QueryRow(`
		SELECT u.id, u.email, u.created_at, s.expires_at
		FROM auth_sessions s JOIN users u ON u.id = s.user_id
		WHERE s.token = ?`, token,
	).Scan(&u.ID, &u.Email, &u.CreatedAt, &exp)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, ErrUnauthorized
	}
	if err != nil {
		return User{}, err
	}
	t, err := time.Parse(time.RFC3339Nano, exp)
	if err != nil || t.Before(time.Now().UTC()) {
		_, _ = s.DB.Exec(`DELETE FROM auth_sessions WHERE token = ?`, token)
		return User{}, ErrUnauthorized
	}
	return u, nil
}

func (s *Store) DeleteAuth(token string) error {
	_, err := s.DB.Exec(`DELETE FROM auth_sessions WHERE token = ?`, token)
	return err
}

func (s *Store) CreateSpace(ownerID, name, preset string) (Space, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return Space{}, fmt.Errorf("%w: name", ErrInvalid)
	}
	policy := engine.NovumPreset()
	if strings.EqualFold(preset, "generic") {
		policy = engine.GenericPreset()
	}
	raw, err := json.Marshal(policy)
	if err != nil {
		return Space{}, err
	}
	sp := Space{
		ID: NewID(), Name: name, OwnerID: ownerID,
		Policy: policy, Revision: 1, CreatedAt: now(), Role: "owner",
	}
	tx, err := s.DB.Begin()
	if err != nil {
		return Space{}, err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err := tx.Exec(
		`INSERT INTO spaces (id, name, owner_id, policy_json, archived, revision, created_at)
		 VALUES (?, ?, ?, ?, 0, 1, ?)`,
		sp.ID, sp.Name, ownerID, string(raw), sp.CreatedAt,
	); err != nil {
		return Space{}, err
	}
	if _, err := tx.Exec(
		`INSERT INTO space_members (space_id, user_id, role) VALUES (?, ?, 'owner')`,
		sp.ID, ownerID,
	); err != nil {
		return Space{}, err
	}
	if err := tx.Commit(); err != nil {
		return Space{}, err
	}
	return sp, nil
}

func scanSpace(row interface {
	Scan(dest ...any) error
}) (Space, error) {
	var sp Space
	var raw string
	var archived int
	if err := row.Scan(&sp.ID, &sp.Name, &sp.OwnerID, &raw, &archived, &sp.Revision, &sp.CreatedAt, &sp.Role); err != nil {
		return Space{}, err
	}
	if err := json.Unmarshal([]byte(raw), &sp.Policy); err != nil {
		return Space{}, err
	}
	sp.Archived = archived != 0
	return sp, nil
}

func (s *Store) ListSpaces(userID string) ([]Space, error) {
	rows, err := s.DB.Query(`
		SELECT p.id, p.name, p.owner_id, p.policy_json, p.archived, p.revision, p.created_at, m.role
		FROM spaces p JOIN space_members m ON m.space_id = p.id
		WHERE m.user_id = ? AND p.archived = 0
		ORDER BY p.created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Space, 0)
	for rows.Next() {
		sp, err := scanSpace(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, sp)
	}
	return out, rows.Err()
}

func (s *Store) SpaceForUser(spaceID, userID string) (Space, error) {
	row := s.DB.QueryRow(`
		SELECT p.id, p.name, p.owner_id, p.policy_json, p.archived, p.revision, p.created_at, m.role
		FROM spaces p JOIN space_members m ON m.space_id = p.id
		WHERE p.id = ? AND m.user_id = ?`, spaceID, userID)
	sp, err := scanSpace(row)
	if errors.Is(err, sql.ErrNoRows) {
		return Space{}, ErrNotFound
	}
	return sp, err
}

func (s *Store) UpdateSpace(userID string, sp Space, expectedRev int) (Space, error) {
	cur, err := s.SpaceForUser(sp.ID, userID)
	if err != nil {
		return Space{}, err
	}
	if expectedRev != 0 && cur.Revision != expectedRev {
		return Space{}, ErrStaleRevision
	}
	raw, err := json.Marshal(sp.Policy)
	if err != nil {
		return Space{}, err
	}
	archived := 0
	if sp.Archived {
		archived = 1
	}
	name := strings.TrimSpace(sp.Name)
	if name == "" {
		name = cur.Name
	}
	_, err = s.DB.Exec(`
		UPDATE spaces SET name = ?, policy_json = ?, archived = ?, revision = revision + 1
		WHERE id = ?`, name, string(raw), archived, sp.ID)
	if err != nil {
		return Space{}, err
	}
	return s.SpaceForUser(sp.ID, userID)
}

func (s *Store) GetMonth(spaceID, month string) (Month, error) {
	var m Month
	var inputs, actuals, planned sql.NullString
	err := s.DB.QueryRow(`
		SELECT space_id, month, inputs_json, actuals_json, planned_json, status, revision, updated_at, updated_by
		FROM months WHERE space_id = ? AND month = ?`, spaceID, month,
	).Scan(&m.SpaceID, &m.Month, &inputs, &actuals, &planned, &m.Status, &m.Revision, &m.UpdatedAt, &m.UpdatedBy)
	if errors.Is(err, sql.ErrNoRows) {
		return Month{}, ErrNotFound
	}
	if err != nil {
		return Month{}, err
	}
	if err := json.Unmarshal([]byte(inputs.String), &m.Inputs); err != nil {
		return Month{}, err
	}
	if actuals.Valid && actuals.String != "" {
		_ = json.Unmarshal([]byte(actuals.String), &m.Actuals)
	}
	if planned.Valid && planned.String != "" {
		var r engine.Result
		if err := json.Unmarshal([]byte(planned.String), &r); err == nil {
			m.Planned = &r
		}
	}
	return m, nil
}

func (s *Store) UpsertMonth(userID string, m Month, expectedRev int) (Month, error) {
	if m.Month == "" {
		return Month{}, fmt.Errorf("%w: month", ErrInvalid)
	}
	cur, err := s.GetMonth(m.SpaceID, m.Month)
	if err != nil && !errors.Is(err, ErrNotFound) {
		return Month{}, err
	}
	if err == nil && expectedRev != 0 && cur.Revision != expectedRev {
		return Month{}, ErrStaleRevision
	}
	inRaw, err := json.Marshal(m.Inputs)
	if err != nil {
		return Month{}, err
	}
	var act any
	var plan any
	if m.Actuals != nil {
		act, _ = json.Marshal(m.Actuals)
	}
	if m.Planned != nil {
		plan, _ = json.Marshal(m.Planned)
	}
	status := m.Status
	if status == "" {
		status = "draft"
		if err == nil {
			status = cur.Status
		}
	}
	_, err = s.DB.Exec(`
		INSERT INTO months (space_id, month, inputs_json, actuals_json, planned_json, status, revision, updated_at, updated_by)
		VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
		ON CONFLICT(space_id, month) DO UPDATE SET
		  inputs_json = excluded.inputs_json,
		  actuals_json = COALESCE(excluded.actuals_json, months.actuals_json),
		  planned_json = COALESCE(excluded.planned_json, months.planned_json),
		  status = excluded.status,
		  revision = months.revision + 1,
		  updated_at = excluded.updated_at,
		  updated_by = excluded.updated_by
	`, m.SpaceID, m.Month, string(inRaw), act, plan, status, now(), userID)
	if err != nil {
		return Month{}, err
	}
	return s.GetMonth(m.SpaceID, m.Month)
}

func (s *Store) ListMonths(spaceID string) ([]Month, error) {
	rows, err := s.DB.Query(`
		SELECT space_id, month, inputs_json, actuals_json, planned_json, status, revision, updated_at, updated_by
		FROM months WHERE space_id = ? ORDER BY month DESC`, spaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Month, 0)
	for rows.Next() {
		var m Month
		var inputs, actuals, planned sql.NullString
		if err := rows.Scan(&m.SpaceID, &m.Month, &inputs, &actuals, &planned, &m.Status, &m.Revision, &m.UpdatedAt, &m.UpdatedBy); err != nil {
			return nil, err
		}
		_ = json.Unmarshal([]byte(inputs.String), &m.Inputs)
		if actuals.Valid && actuals.String != "" {
			_ = json.Unmarshal([]byte(actuals.String), &m.Actuals)
		}
		if planned.Valid && planned.String != "" {
			var r engine.Result
			if json.Unmarshal([]byte(planned.String), &r) == nil {
				m.Planned = &r
			}
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (s *Store) Export() (Dump, error) {
	d := Dump{Version: 2, ExportedAt: now()}
	urows, err := s.DB.Query(`SELECT id, email, password_hash, created_at FROM users`)
	if err != nil {
		return Dump{}, err
	}
	defer urows.Close()
	for urows.Next() {
		var u DumpUser
		if err := urows.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.CreatedAt); err != nil {
			return Dump{}, err
		}
		d.Users = append(d.Users, u)
	}
	srows, err := s.DB.Query(`SELECT id FROM spaces`)
	if err != nil {
		return Dump{}, err
	}
	defer srows.Close()
	var ids []string
	for srows.Next() {
		var id string
		if err := srows.Scan(&id); err != nil {
			return Dump{}, err
		}
		ids = append(ids, id)
	}
	for _, id := range ids {
		row := s.DB.QueryRow(`
			SELECT id, name, owner_id, policy_json, archived, revision, created_at, 'owner'
			FROM spaces WHERE id = ?`, id)
		sp, err := scanSpace(row)
		if err != nil {
			return Dump{}, err
		}
		ds := DumpSpace{Space: sp}
		mrows, err := s.DB.Query(`SELECT user_id, role FROM space_members WHERE space_id = ?`, id)
		if err != nil {
			return Dump{}, err
		}
		for mrows.Next() {
			var m DumpMember
			if err := mrows.Scan(&m.UserID, &m.Role); err != nil {
				mrows.Close()
				return Dump{}, err
			}
			ds.Members = append(ds.Members, m)
		}
		mrows.Close()
		months, err := s.ListMonths(id)
		if err != nil {
			return Dump{}, err
		}
		ds.Months = months
		sec, err := s.DB.Query(`SELECT source_id, config_json FROM source_secrets WHERE space_id = ?`, id)
		if err != nil {
			return Dump{}, err
		}
		for sec.Next() {
			var sc DumpSecret
			var raw string
			if err := sec.Scan(&sc.SourceID, &raw); err != nil {
				sec.Close()
				return Dump{}, err
			}
			sc.Config = json.RawMessage(raw)
			ds.Secrets = append(ds.Secrets, sc)
		}
		sec.Close()
		d.Spaces = append(d.Spaces, ds)
	}
	return d, nil
}

func (s *Store) Import(d Dump) error {
	tx, err := s.DB.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	for _, u := range d.Users {
		_, err := tx.Exec(
			`INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)
			 ON CONFLICT(email) DO NOTHING`,
			u.ID, u.Email, u.PasswordHash, u.CreatedAt,
		)
		if err != nil {
			return err
		}
	}
	for _, ds := range d.Spaces {
		sp := ds.Space
		raw, err := json.Marshal(sp.Policy)
		if err != nil {
			return err
		}
		archived := 0
		if sp.Archived {
			archived = 1
		}
		if _, err := tx.Exec(
			`INSERT INTO spaces (id, name, owner_id, policy_json, archived, revision, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(id) DO UPDATE SET name=excluded.name, policy_json=excluded.policy_json`,
			sp.ID, sp.Name, sp.OwnerID, string(raw), archived, sp.Revision, sp.CreatedAt,
		); err != nil {
			return err
		}
		for _, m := range ds.Members {
			if _, err := tx.Exec(
				`INSERT INTO space_members (space_id, user_id, role) VALUES (?, ?, ?)
				 ON CONFLICT(space_id, user_id) DO UPDATE SET role=excluded.role`,
				sp.ID, m.UserID, m.Role,
			); err != nil {
				return err
			}
		}
		for _, mo := range ds.Months {
			inRaw, _ := json.Marshal(mo.Inputs)
			var act any
			var plan any
			if mo.Actuals != nil {
				act, _ = json.Marshal(mo.Actuals)
			}
			if mo.Planned != nil {
				plan, _ = json.Marshal(mo.Planned)
			}
			if _, err := tx.Exec(
				`INSERT INTO months (space_id, month, inputs_json, actuals_json, planned_json, status, revision, updated_at, updated_by)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
				 ON CONFLICT(space_id, month) DO UPDATE SET
				   inputs_json=excluded.inputs_json,
				   actuals_json=excluded.actuals_json,
				   planned_json=excluded.planned_json,
				   status=excluded.status,
				   revision=excluded.revision,
				   updated_at=excluded.updated_at,
				   updated_by=excluded.updated_by`,
				mo.SpaceID, mo.Month, string(inRaw), act, plan, mo.Status, mo.Revision, mo.UpdatedAt, mo.UpdatedBy,
			); err != nil {
				return err
			}
		}
		for _, sc := range ds.Secrets {
			if _, err := tx.Exec(
				`INSERT INTO source_secrets (space_id, source_id, config_json) VALUES (?, ?, ?)
				 ON CONFLICT(space_id, source_id) DO UPDATE SET config_json=excluded.config_json`,
				sp.ID, sc.SourceID, string(sc.Config),
			); err != nil {
				return err
			}
		}
	}
	return tx.Commit()
}
