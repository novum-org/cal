package store

import (
	"path/filepath"
	"testing"

	"github.com/novum-org/cal/internal/engine"
)

func monthInputs(month string) engine.Inputs {
	in := engine.DefaultInputs()
	in.Month = month
	return in
}

func open(t *testing.T, name string) *Store {
	t.Helper()
	st, err := Open(filepath.Join(t.TempDir(), name))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = st.Close() })
	return st
}

// The hosted → self-host path: everything the team owns has to survive a dump
// into an empty box, or "you can take your data with you" is not true. (#9)
func TestExportImportRoundTrip(t *testing.T) {
	src := open(t, "src.db")

	owner, err := src.CreateUser("owner@novum.gg", "password1")
	if err != nil {
		t.Fatal(err)
	}
	sp, err := src.CreateSpace(owner.ID, "Novum", "novum")
	if err != nil {
		t.Fatal(err)
	}
	editor, err := src.CreateUser("bob@novum.gg", "password2")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := src.AddMemberByEmail(sp.ID, owner.ID, editor.Email, RoleEditor); err != nil {
		t.Fatal(err)
	}

	in := engine.DefaultInputs()
	in.Month = "2026-03"
	in.CashInMonth = 1035
	saved, err := src.UpsertMonth(owner.ID, Month{SpaceID: sp.ID, Month: "2026-03", Inputs: in}, 0)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := src.DB.Exec(
		`INSERT INTO source_secrets (space_id, source_id, config_json) VALUES (?, 'tebex', '{"secret":"abc"}')`,
		sp.ID,
	); err != nil {
		t.Fatal(err)
	}

	dump, err := src.Export()
	if err != nil {
		t.Fatal(err)
	}

	dst := open(t, "dst.db")
	if err := dst.Import(dump); err != nil {
		t.Fatal(err)
	}

	spaces, err := dst.ListSpaces(owner.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(spaces) != 1 || spaces[0].Name != "Novum" {
		t.Fatalf("spaces %+v", spaces)
	}
	if got := len(spaces[0].Policy.Bands); got != len(sp.Policy.Bands) {
		t.Fatalf("policy bands %d want %d", got, len(sp.Policy.Bands))
	}

	months, err := dst.ListMonths(sp.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(months) != 1 || months[0].Inputs.CashInMonth != 1035 {
		t.Fatalf("months %+v", months)
	}
	if months[0].Revision != saved.Revision {
		t.Fatalf("revision %d want %d", months[0].Revision, saved.Revision)
	}

	members, err := dst.ListMembers(sp.ID, owner.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(members) != 2 {
		t.Fatalf("members %+v", members)
	}

	// The editor's password survives, so they can log in on the new box.
	if _, err := dst.Authenticate("bob@novum.gg", "password2"); err != nil {
		t.Fatalf("editor cannot log in after migration: %v", err)
	}

	var secret string
	if err := dst.DB.QueryRow(
		`SELECT config_json FROM source_secrets WHERE space_id = ? AND source_id = 'tebex'`, sp.ID,
	).Scan(&secret); err != nil {
		t.Fatalf("source config lost: %v", err)
	}
}

// Import runs once on a fresh instance, but running it twice must not double
// anything or fail outright. (#9)
func TestImportIsIdempotent(t *testing.T) {
	src := open(t, "src.db")
	owner, err := src.CreateUser("owner@novum.gg", "password1")
	if err != nil {
		t.Fatal(err)
	}
	sp, err := src.CreateSpace(owner.ID, "Novum", "novum")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := src.UpsertMonth(owner.ID,
		Month{SpaceID: sp.ID, Month: "2026-03", Inputs: monthInputs("2026-03")}, 0); err != nil {
		t.Fatal(err)
	}
	dump, err := src.Export()
	if err != nil {
		t.Fatal(err)
	}

	dst := open(t, "dst.db")
	if err := dst.Import(dump); err != nil {
		t.Fatal(err)
	}
	if err := dst.Import(dump); err != nil {
		t.Fatalf("second import: %v", err)
	}
	spaces, err := dst.ListSpaces(owner.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(spaces) != 1 {
		t.Fatalf("import duplicated spaces: %+v", spaces)
	}
	months, err := dst.ListMonths(sp.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(months) != 1 {
		t.Fatalf("import duplicated months: %+v", months)
	}
}
