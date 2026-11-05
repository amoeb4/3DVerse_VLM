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
