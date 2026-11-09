# Makefile

# Default browser URL
BROWSER_URL := http://localhost:5173

# Helper to open browser if possible
define open_browser
	@if command -v xdg-open > /dev/null; then \
		xdg-open $(BROWSER_URL); \
	else \
		echo "xdg-open not found, open $(BROWSER_URL) manually."; \
	fi
endef

run:
	@echo "🚀 Lancement de l'application classique"
	gnome-terminal --tab -- bash -c "npm run dev -- --host; exec bash"
	gnome-terminal --tab -- bash -c "cd src && node server.js; exec bash"
	sleep 0.1
	gnome-terminal --tab -- bash -c "cd server_blender && python3 client.py; exec bash"
	sleep 1
	$(open_browser)

opcua:	
	gnome-terminal --tab -- bash -c "npm run dev; exec bash"
	gnome-terminal --tab -- bash -c "cd src && node server.js; exec bash"
	sleep 0.1
	gnome-terminal --tab -- bash -c "npx tsx OPC-UA/opcua-proxy.ts"
	gnome-terminal --tab -- bash -c "npx tsx OPC-UA/server-opcua.ts; exec bash"
	sleep 1
	@echo "🚀 Launching OPC-UA client..."
	gnome-terminal --tab -- bash -c "npx tsx OPC-UA/test-ws.ts; exec bash"
	sleep 1
	gnome-terminal --tab -- bash -c "npx tsx OPC-UA/client-opcua.ts; exec bash"
	gnome-terminal --tab -- bash -c "cd server_blender && python3 client.py; exec bash"
	$(open_browser)

grpc:
	gnome-terminal --tab -- bash -c "npm run dev; exec bash"
	gnome-terminal --tab -- bash -c "cd src && node server.js; exec bash"
	sleep 0.1
#	gnome-terminal --tab -- bash -c "source /home/obedience/latest/GRPC/venv/bin/activate && python OPC-UA/server_grpc.py; exec bash"
	gnome-terminal --tab -- bash -c "npx tsx grpc_proxy.ts; exec bash"
	$(open_browser)

test:
	gnome-terminal --tab -- bash -c "npm run dev; exec bash"
#	gnome-terminal --tab -- bash -c "cd tester_python && source .venv/bin/activate && python server.py; exec bash"
	sleep 0.1
	gnome-terminal --tab -- bash -c "node src/server.js; exec bash"
	gnome-terminal --tab -- bash -c "npx tsx grpc_proxy.ts; exec bash"
	$(open_browser)

# -----------------------------------------------------------------------------
# Python → navigateur, sans gRPC (macOS et Linux, un seul terminal)
#
#   make python                 site + flux simulé (le bras bouge, "Start Weld" soude)
#   make python-robot           site + flux du robot réel (TCP 0.0.0.0:50051)
#   make python-feed            flux simulé seul (si le site tourne déjà)
#   make python SWEEP=part_2    n'anime qu'une articulation
#
# Ctrl-C arrête tout. Ne pas lancer src/server.js en même temps (même port 8767).
# -----------------------------------------------------------------------------
PYTHON ?= python3
VENV := tester_python/.venv
BRIDGE = $(VENV)/bin/python tester_python/ws_bridge.py $(if $(SWEEP),--sweep $(SWEEP))
URL := http://localhost:5173

# --clear rebuilds the venv from scratch: an install interrupted halfway (Ctrl-C, git stash…)
# never leaves the marker below, and is then redone cleanly instead of failing on its leftovers.
$(VENV)/.installed: tester_python/requirements.txt
	$(PYTHON) -m venv --clear $(VENV)
	$(VENV)/bin/python -m pip install --quiet --disable-pip-version-check -r tester_python/requirements.txt
	@touch $@

# Lance le site et le flux ensemble ; Ctrl-C arrête les deux.
define run_with_site
	@trap 'kill $$(jobs -p) 2>/dev/null' INT TERM EXIT; \
	npm run dev & \
	$(BRIDGE) $(1) & \
	sleep 2; \
	(command -v open >/dev/null && open $(URL)) || (command -v xdg-open >/dev/null && xdg-open $(URL)) || echo "Ouvrir $(URL)"; \
	wait
endef

python: $(VENV)/.installed
	@echo "🐍 Site + flux Python simulé"
	$(call run_with_site,--source simulated)

python-robot: $(VENV)/.installed
	@echo "🤖 Site + flux Python du robot (TCP)"
	$(call run_with_site,--source robot)

python-feed: $(VENV)/.installed
	$(BRIDGE) --source simulated

.PHONY: run opcua grpc test python python-robot python-feed
