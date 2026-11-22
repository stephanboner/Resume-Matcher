# Resume Matcher: mein Fork (macOS, Backend + Frontend separat)

> Ziel: Eigene Erweiterungen (Bewerbungsfoto, CV-Designs) pflegen, Updates aus dem Original kontrolliert übernehmen und die persönlichen Daten sicher sichern. Diese Anleitung geht von einer bestehenden lokalen Installation ohne Docker aus. Sie wurde anhand des Upstream-Standes vom 22.11.2026 erstellt; vor grösseren Updates die aktuellen Projektanweisungen prüfen.

**Original:** https://github.com/srbhr/Resume-Matcher  
**Foto-Vorlage:** https://github.com/srbhr/Resume-Matcher/pull/891  
**Mein Fork (nach Erstellung):** https://github.com/stephanboner/Resume-Matcher

## Grundregeln

- `upstream` = Originalprojekt; `origin` = mein Fork.
- `main` bleibt möglichst nahe an `upstream/main`. Jede eigene Funktion wird in einem Feature-Branch entwickelt und über einen PR in meinen `main` integriert.
- Keine direkten Merges eines alten PRs ohne Code-Review: PR #891 basiert auf einer aelteren Version. Die Funktionen werden auf den aktuellen Stand *portiert*.
- `apps/backend/data/`, `.env`, `.secret_key`, API-Keys, CVs und Bewerbungsfotos gehören **nie** in Git. GitHub ist Quellcode-Sicherung, kein Datenbank-Backup.
- Vor Migrationen und Upstream-Updates: Backup und mindestens ein PDF-Export-Test. Kein `git reset --hard`, kein Force-Push, kein Löschen des Datenordners.

## 0. Bestehende Installation finden und prüfen

1. Laufendes Backend und Frontend jeweils mit `Ctrl+C` stoppen, bevor du Ordner verschiebst oder Daten migrierst.
2. Im Terminal in den **bestehenden** Resume-Matcher-Projektordner wechseln (den Pfad anpassen):

   ```bash
   cd /PFAD/ZU/Resume-Matcher
   pwd
   git status --short
   git remote -v
   ```

3. Prüfen, **welchen** Datenordner dein Backend verwendet. `Settings` verwendet standardmässig `apps/backend/data`; eine `DATA_DIR`-Umgebungsvariable kann das aendern:

   ```bash
   cd apps/backend
   uv run python - <<'PY'
   from app.config import settings
   print('Datenordner:', settings.data_dir.resolve())
   print('Datenbank:', 'PostgreSQL' if settings.database_url else settings.sqlite_path.resolve())
   PY
   cd ../..
   ```

   **Diese Anleitung nimmt SQLite an.** Falls `PostgreSQL` erscheint, hier anhalten und ein PostgreSQL-Backup einrichten. Wenn der Datenordner ausserhalb des Projekts liegt, beim Backup-Skript später `--data-dir "/ABSOLUTER/PFAD"` mitgeben.

4. Vorhandene lokale Codeänderungen prüfen. Falls `git status --short` etwas anzeigt, zuerst `git diff` anschauen. Nicht blind überschreiben. Für einen sauberen Umstieg kannst du sie vorübergehend mit `git stash push -u -m "pre-fork local changes"` sichern (`git stash list` zeigt sie danach). **Wichtig:** Ignore-Dateien wie `.env` und `data/` werden nicht gestasht; dafür ist das getrennte Backup da.

## 1. Vor allem anderen: Daten sichern

Am sichersten ist ein Erstbackup bei **gestopptem** Backend. Im bestehenden Projektordner:

```bash
umask 077
mkdir -p "$HOME/Backups/ResumeMatcher"
tar -czf "$HOME/Backups/ResumeMatcher/initial-data-$(date +%Y%m%d-%H%M%S).tar.gz" -C apps/backend data
ls -lh "$HOME/Backups/ResumeMatcher"/initial-data-*.tar.gz
```

- Das Archiv enthält den gesamten `data/`-Ordner, insbesondere `resume_matcher.db`, `config.json` und `.secret_key`, sofern vorhanden. Falls das Backend einen anderen `DATA_DIR` nutzt, stattdessen **diesen** gesamten Ordner sichern.
- Eine eventuell vorhandene `apps/backend/.env` ebenfalls separat an einen geschützten Ort sichern (`cp -p apps/backend/.env "$HOME/Backups/ResumeMatcher/backend.env.backup"`). Darin können Zugangsschlüssel stehen.
- Ein lokales, unverschlüsseltes Archiv ist **noch kein vollwertiges Offsite-Backup**. Nutze verschlüsseltes Time Machine oder Restic auf getrenntem Speicher.
- Falls `resume_matcher.db` nicht existiert, aber `database.json`, hast du möglicherweise eine aeltere Datenbankversion. Die Daten zuerst sichern und die Migration beim Update separat testen.

## 2. Fork auf GitHub anlegen

1. https://github.com/srbhr/Resume-Matcher oeffnen.
2. Rechts oben **Fork** auswählen.
3. Owner `stephanboner`, Repository `Resume-Matcher`, Hauptbranch `main` übernehmen und Fork erstellen.
4. Prüfen, dass `https://github.com/stephanboner/Resume-Matcher` existiert.

**Nicht** die bestehende lokale Installation löschen und nicht sofort neu klonen: Wir wollen den bisherigen Datenordner behalten.

## 3. Bestehende lokale Installation mit Fork verbinden

Die folgenden Befehle gelten, wenn `git remote -v` bisher `origin -> srbhr/Resume-Matcher` zeigt. Falls `origin` bereits auf einen eigenen Fork verweist, die Remotes erst prüfen und entsprechend anpassen.

```bash
cd /PFAD/ZU/Resume-Matcher
git remote rename origin upstream
git remote add origin https://github.com/stephanboner/Resume-Matcher.git
git fetch upstream
git fetch origin
git remote -v
```

Jetzt **nur mit sauberem Arbeitsverzeichnis** den bestehenden `main`-Branch auf die aktuelle Upstream-Version bringen:

```bash
git switch main
git merge --ff-only upstream/main
git push -u origin main
```

Wenn `--ff-only` nicht klappt: **nicht** `reset --hard` oder `push --force` verwenden. Das bedeutet, dass der lokale Branch anders ist (z. B. bereits eigene Commits besitzt). `git log --oneline --graph --decorate -15` ansehen und die Abweichung zuerst bereinigen. Wenn `git push` vom Remote abgewiesen wird, ebenfalls erst den Stand von `origin/main` vergleichen.

## 4. Backend und Frontend starten (ohne Docker)

Die bestehende `apps/backend/.env` und `apps/backend/data/` bleiben in demselben lokalen Projektordner bestehen. Das ist der einfachste Weg, bestehende CVs und Konfigurationen weiterzuverwenden.

**Terminal 1 - Backend**

```bash
cd /PFAD/ZU/Resume-Matcher/apps/backend
uv sync
uv run app
```

**Terminal 2 - Frontend**

```bash
cd /PFAD/ZU/Resume-Matcher
# Falls nvm installiert ist und die Node-Version des Projekts genutzt wird:
nvm use
cd apps/frontend
npm ci
npm run dev
```

Dann http://localhost:3000 oeffnen. Standardmässig läuft das Backend auf `127.0.0.1:8000`. `uv sync` verwendet die zum aktuellen Projekt passenden Python-Abhängigkeiten (aktueller Upstream setzt Python 3.14 voraus). `npm ci` setzt eine passende `package-lock.json` voraus. Falls dein Branch keine Lockdatei hat, stattdessen `npm install` verwenden.

**Prüfen:** Sind dein bisheriger Master-CV, Stellen und Einstellungen vorhanden? Falls eine leere App angezeigt wird, **nicht** weiterarbeiten und keine Daten überschreiben: Die Datenordner-/DB-Konfiguration prüfen.

## 5. Foto-Funktion als eigenes Feature entwickeln

```bash
cd /PFAD/ZU/Resume-Matcher
git switch main
git switch -c feature/profile-photo
```

Der Foto-PR #891 ist eine **Implementierungsvorlage**, keine sichere Drop-in-Aenderung für die aktuelle Version. Anforderungen für den Coding-Agent:

1. Bestehenden PR lesen und gezielt auf aktuellen Backend-/Frontend-Code portieren, keine Abhängigkeiten downgraden.
2. Optionales Foto in Personal Information: JPEG/PNG/WebP, Upload, Zuschneiden, Grösse, Ersetzen und Entfernen.
3. Schalter `Show photo` / `Foto anzeigen`, ohne Bilddaten zu löschen.
4. Dasselbe Foto in Vorschau, Print-Route und PDF. Kein Verschieben von Kontaktzeile oder CV-Abschnitten; kein Overlap mit Text.
5. Die Bilddaten **serverseitig** speichern, nicht im LLM-Kontext; Bildmetadaten aus Tailoring-Prompts entfernen.
6. Beim Erstellen abgeleiteter Lebensläufe sicher kopieren; bestehende Resumes ohne Foto müssen unverändert funktionieren.
7. Bildvalidierung, Grössenlimits, Metadaten-/EXIF-Entfernung, korrekte Server-/Client-URLs, PDF-Rendering und Tests implementieren.
8. Migrations- und Rollback-Strategie dokumentieren. Vor Schemaänderungen Backup erstellen.
9. `uv run pytest` im Backend sowie `npm test`, `npx tsc --noEmit` und `npm run lint` im Frontend ausführen; PDF mit/ohne Foto visuell und mit ATS-Textauslesung testen.

Nach erfolgreichem Test:

```bash
git add apps/backend apps/frontend
# Nur gewollte Code-Dateien kontrollieren; keine Daten oder Secrets committen!
git status --short
git commit -m "feat: add optional resume profile photos"
git push -u origin feature/profile-photo
```

Im **eigenen Fork** einen Pull Request `feature/profile-photo -> main` oeffnen. Erst nach Review und Tests mergen. Die gesamte alte PR-Historie von #891 nicht unbesehen nach `main` mergen.

## 6. Später eigene CV-Designs pflegen

- Templates liegen im aktuellen Upstream unter `apps/frontend/components/resume/`; Export/Print-Route und Auswahl-Logik separat prüfen.
- **Neue** Komponente / eigener Template-Key sind besser wartbar als umfangreiche Aenderungen an bestehenden Originaltemplates.
- Layout-Styles möglichst separat halten; gemeinsame Datenstruktur beibehalten.
- Immer Browser-Vorschau und PDF vergleichen (Seitenumbrüche, Schriften, Ausrichtung, ATS-lesbarer Text).
- Eigene Designs in `feature/custom-templates` entwickeln und über PR integrieren.

## 7. Upstream-Updates regelmässig übernehmen

Empfehlung: alle 1-2 Monate oder bei wichtigen Security-Fixes. **Vorher Datenbank-Backup erstellen** und keine ungesicherten lokalen Codeänderungen mitnehmen.

```bash
cd /PFAD/ZU/Resume-Matcher
git status --short
git fetch upstream
git switch main
git merge upstream/main
# Wenn nötig Konflikte bewusst lösen, danach Tests.
git push origin main
```

Bei Konflikten `git status` und `git diff` verwenden. Kein Force-Push. Für grössere Releases zuerst einen Testbranch `chore/upstream-YYYY-MM` erstellen und auf einer **Kopie** der Datenbank testen. Vorsicht: automatisierte Schema-Migrationen können eine alte App-Version inkompatibel machen; Git-Rollback allein stellt die Datenbank nicht zurück.

## 8. Backup ohne Docker (laufender Backend-Prozess erlaubt)

Im Fork liegt `scripts/backup_resume_matcher.py`. Das Skript erstellt für die primäre SQLite-Datei per `sqlite3.Connection.backup()` eine konsistente Online-Kopie und archiviert den restlichen Datenordner. Es ist **kein PostgreSQL-Backup**. Standardmässig liegt die Quelle bei `apps/backend/data` und die Sicherung unter `~/Backups/ResumeMatcher`.

```bash
cd /PFAD/ZU/Resume-Matcher
python3 scripts/backup_resume_matcher.py
```

Bei externem Datenordner:

```bash
python3 scripts/backup_resume_matcher.py --data-dir "/ABSOLUTER/PFAD/ZU/DATA"
```

Falls `python3` nicht vorhanden ist, die Python-Umgebung nutzen:

```bash
cd apps/backend
uv run python ../../scripts/backup_resume_matcher.py
```

Die Sicherung wird als `resume-matcher-YYYYMMDD-HHMMSS.tar.gz` gespeichert. Das Archiv ist **nicht verschlüsselt**; lokale Dateirechte werden restriktiv gesetzt. Es sollte zusätzlich über ein **verschlüsseltes** Time-Machine-Laufwerk oder ein verschlüsseltes Restic-Repository auf einen getrennten Speicher gelangen. Optional `--include-env` für eine Kopie der Backend-`.env` im Archiv verwenden - das Archiv dann besonders schützen.

**Backup prüfen:**

```bash
tar -tzf "$HOME/Backups/ResumeMatcher/DATEINAME.tar.gz" | head
```

**Wiederherstellung (nur bei gestopptem Backend!):**

1. Aktuelle Daten sichern und Anwendung stoppen.
2. Aktuellen `apps/backend/data`-Ordner **umbenennen**, nicht sofort löschen.
3. Archiv mit `tar -xzf /PFAD/ZUR/DATEI.tar.gz -C apps/backend` entpacken (es enthält `data/`).
4. Bei gesichertem `.env` diese im Backend-Ordner wiederherstellen, danach Rechte/Secrets prüfen.
5. Backend/Frontend starten, Master-CV, Foto und PDF-Export kontrollieren. Erst wenn alles passt, alten Ordner entfernen.

Diesen Restore **einmal auf einer separaten Testkopie** durchspielen, bevor du dich auf automatische Backups verlässt.

## 9. Nächste Wartungsschritte

- Einmaliger Erstbackup-/Restore-Test.
- Foto-PR in eigenem Feature-Branch portieren und testen.
- Erste eigene Vorlage später als separaten Template-Baustein erstellen.
- Automatische Sicherung über macOS `launchd` und verschlüsselten Offsite-Speicher (z. B. Restic) einrichten.
- `main` möglichst frei von experimentellen Commits halten.

## Referenzen

- Upstream: https://github.com/srbhr/Resume-Matcher
- Setup: https://github.com/srbhr/Resume-Matcher/blob/main/SETUP.md
- Foto-PR: https://github.com/srbhr/Resume-Matcher/pull/891
- Upstream-Code für Datenpfade: `apps/backend/app/config.py` (`data_dir`, `sqlite_path`) und `apps/backend/app/crypto.py` (`.secret_key`)
