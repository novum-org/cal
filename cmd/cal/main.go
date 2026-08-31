package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/novum-org/cal/internal/httpapi"
	"github.com/novum-org/cal/internal/store"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	switch os.Args[1] {
	case "serve":
		serve(os.Args[2:])
	case "export":
		exportCmd(os.Args[2:])
	case "import":
		importCmd(os.Args[2:])
	default:
		usage()
		os.Exit(2)
	}
}

func usage() {
	fmt.Fprint(os.Stderr, `cal — game-server finance engine

Usage:
  cal serve  [--addr :8080] [--db data/cal.db] [--web web/dist]
  cal export [--db data/cal.db] > dump.json
  cal import [--db data/cal.db] dump.json

Env:
  CAL_ADDR, CAL_DB, CAL_WEB
  CAL_ADMIN_EMAIL, CAL_ADMIN_PASSWORD  bootstrap first user
  CAL_SIGNUP=setup|invite
  CAL_SECURE=1                         cookie Secure flag
`)
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func serve(args []string) {
	fs := flag.NewFlagSet("serve", flag.ExitOnError)
	addr := fs.String("addr", env("CAL_ADDR", ":8080"), "listen address")
	dbPath := fs.String("db", env("CAL_DB", "data/cal.db"), "sqlite path")
	web := fs.String("web", env("CAL_WEB", "web/dist"), "static web dir (empty to disable)")
	_ = fs.Parse(args)

	st, err := store.Open(*dbPath)
	if err != nil {
		fatal(err)
	}
	defer st.Close()

	cfg := httpapi.Config{
		Signup:       env("CAL_SIGNUP", "setup"),
		AdminEmail:   os.Getenv("CAL_ADMIN_EMAIL"),
		AdminPass:    os.Getenv("CAL_ADMIN_PASSWORD"),
		CookieSecure: os.Getenv("CAL_SECURE") == "1",
		WebDir:       *web,
	}
	if _, err := os.Stat(*web); err != nil {
		cfg.WebDir = ""
	}
	srv := httpapi.New(st, cfg)
	if err := srv.Bootstrap(); err != nil {
		fatal(err)
	}

	httpSrv := &http.Server{
		Addr:              *addr,
		Handler:           srv.Router(),
		ReadHeaderTimeout: 10 * time.Second,
	}
	fmt.Fprintf(os.Stderr, "cal listening on %s (db %s)\n", *addr, *dbPath)
	if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		fatal(err)
	}
}

func exportCmd(args []string) {
	fs := flag.NewFlagSet("export", flag.ExitOnError)
	dbPath := fs.String("db", env("CAL_DB", "data/cal.db"), "sqlite path")
	_ = fs.Parse(args)
	st, err := store.Open(*dbPath)
	if err != nil {
		fatal(err)
	}
	defer st.Close()
	d, err := st.Export()
	if err != nil {
		fatal(err)
	}
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	if err := enc.Encode(d); err != nil {
		fatal(err)
	}
}

func importCmd(args []string) {
	fs := flag.NewFlagSet("import", flag.ExitOnError)
	dbPath := fs.String("db", env("CAL_DB", "data/cal.db"), "sqlite path")
	_ = fs.Parse(args)
	if fs.NArg() != 1 {
		fmt.Fprintln(os.Stderr, "usage: cal import [--db data/cal.db] dump.json")
		os.Exit(2)
	}
	raw, err := os.ReadFile(fs.Arg(0))
	if err != nil {
		fatal(err)
	}
	var d store.Dump
	if err := json.Unmarshal(raw, &d); err != nil {
		fatal(err)
	}
	st, err := store.Open(*dbPath)
	if err != nil {
		fatal(err)
	}
	defer st.Close()
	if err := st.Import(d); err != nil {
		fatal(err)
	}
	fmt.Fprintf(os.Stderr, "imported %s\n", fs.Arg(0))
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}
