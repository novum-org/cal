package store

import (
	"fmt"
	"strings"
)

// A month walks draft -> planned -> closed. Closing freezes the inputs and the
// plan that was computed from them; reopening puts it back where it was so the
// numbers can be corrected.
const (
	StatusDraft   = "draft"
	StatusPlanned = "planned"
	StatusClosed  = "closed"
)

// MonthComment is a note left on a month by a person. Comments live beside the
// month rather than inside it, so writing one never touches the closed
// snapshot.
type MonthComment struct {
	ID        string `json:"id"`
	SpaceID   string `json:"space_id"`
	Month     string `json:"month"`
	UserID    string `json:"user_id"`
	Email     string `json:"email"`
	Body      string `json:"body"`
	CreatedAt string `json:"created_at"`
}

// ErrMonthClosed is what an input write to a closed month gets. It is separate
// from ErrStaleRevision because the fix is different: reopen the month, do not
// reload it.
var ErrMonthClosed = fmt.Errorf("%w: el mes está cerrado", ErrInvalid)

// ReopenMonth moves a closed month back to planned, or to draft if it never had
// a plan. The planned snapshot and the actuals are left exactly as they are:
// reopening is permission to edit, not an undo.
func (s *Store) ReopenMonth(userID, spaceID, month string, expectedRev int) (Month, error) {
	m, err := s.GetMonth(spaceID, month)
	if err != nil {
		return Month{}, err
	}
	if m.Status != StatusClosed {
		return m, nil
	}
	m.Status = StatusDraft
	if m.Planned != nil {
		m.Status = StatusPlanned
	}
	return s.UpsertMonth(userID, m, expectedRev)
}

func (s *Store) AddMonthComment(userID, spaceID, month, body string) (MonthComment, error) {
	body = strings.TrimSpace(body)
	if body == "" {
		return MonthComment{}, fmt.Errorf("%w: body", ErrInvalid)
	}
	c := MonthComment{
		ID:        NewID(),
		SpaceID:   spaceID,
		Month:     month,
		UserID:    userID,
		Body:      body,
		CreatedAt: now(),
	}
	if _, err := s.DB.Exec(
		`INSERT INTO month_comments (id, space_id, month, user_id, body, created_at)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		c.ID, c.SpaceID, c.Month, c.UserID, c.Body, c.CreatedAt,
	); err != nil {
		return MonthComment{}, err
	}
	if err := s.DB.QueryRow(`SELECT email FROM users WHERE id = ?`, userID).Scan(&c.Email); err != nil {
		return MonthComment{}, err
	}
	return c, nil
}

func (s *Store) ListMonthComments(spaceID, month string) ([]MonthComment, error) {
	rows, err := s.DB.Query(
		`SELECT c.id, c.space_id, c.month, c.user_id, u.email, c.body, c.created_at
		   FROM month_comments c JOIN users u ON u.id = c.user_id
		  WHERE c.space_id = ? AND c.month = ?
		  ORDER BY c.created_at`,
		spaceID, month,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []MonthComment{}
	for rows.Next() {
		var c MonthComment
		if err := rows.Scan(&c.ID, &c.SpaceID, &c.Month, &c.UserID, &c.Email, &c.Body, &c.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}
