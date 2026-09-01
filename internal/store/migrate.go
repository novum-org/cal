package store

import (
	"database/sql"
	"fmt"
)

// migrations are the columns that were added after a table already shipped.
// `CREATE TABLE IF NOT EXISTS` does nothing to a table that exists, so a new
// column on somebody's existing database has to be asked for by name. SQLite
// can only add columns, never change or drop them, which is why this list is
// append-only and every entry has to be nullable or carry a default.
var migrations = []struct {
	table  string
	column string
	decl   string
}{
	{"months", "sources_json", "TEXT"},
}

func migrate(db *sql.DB) error {
	for _, m := range migrations {
		has, err := hasColumn(db, m.table, m.column)
		if err != nil {
			return err
		}
		if has {
			continue
		}
		stmt := fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s", m.table, m.column, m.decl)
		if _, err := db.Exec(stmt); err != nil {
			return fmt.Errorf("migrate %s.%s: %w", m.table, m.column, err)
		}
	}
	return nil
}

func hasColumn(db *sql.DB, table, column string) (bool, error) {
	rows, err := db.Query(fmt.Sprintf("PRAGMA table_info(%s)", table))
	if err != nil {
		return false, err
	}
	defer func() { _ = rows.Close() }()
	for rows.Next() {
		var (
			cid        int
			name       string
			typ        string
			notNull    int
			dflt       sql.NullString
			primaryKey int
		)
		if err := rows.Scan(&cid, &name, &typ, &notNull, &dflt, &primaryKey); err != nil {
			return false, err
		}
		if name == column {
			return true, nil
		}
	}
	return false, rows.Err()
}
