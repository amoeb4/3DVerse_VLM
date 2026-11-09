"""Python → navigateur, sans gRPC.

Ce script EST le serveur WebSocket (port 8767) auquel le navigateur se connecte
(src/webSockets.tsx). Il remplace toute la chaîne gRPC :

    avant :  server.py (gRPC) ──► server.js / grpc_proxy.ts ──► navigateur
    ici   :  ws_bridge.py ─────────────────────────────────────► navigateur

Il envoie, comme grpc_proxy.ts, un message par articulation :
    {"name": "part_N", "location": [x, y, z]}     (Euler absolu, degrés, ordre ZYX)
et le navigateur fait `eulerOrientation = location`.

Sources des angles :
    --source simulated   mouvement sinusoïdal autour de la pose de la scène (défaut)
    --source robot       le contrôleur du robot se connecte en TCP et envoie une
                         ligne par échantillon : "j1;j2;j3;j4;j5;j6\\n" (degrés)

Lancement (voir aussi `make python` / `make python-robot`) :
    pip install -r requirements.txt
    python ws_bridge.py                     # simulé
    python ws_bridge.py --source robot      # robot réel (TCP 0.0.0.0:50051)
    python ws_bridge.py --sweep part_2      # n'anime qu'une articulation (debug)

Note : ne pas lancer en même temps src/server.js, qui écoute aussi sur 8767.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import math
import socket
import sys
import threading
import time

# Logs visibles tout de suite, même redirigés vers un fichier ou lancés par make.
sys.stdout.reconfigure(line_buffering=True)

try:  # websockets >= 13
    from websockets.asyncio.server import serve
except ImportError:  # pragma: no cover - anciennes versions
    from websockets.server import serve  # type: ignore

JOINT_NAMES = [f"part_{i}" for i in range(1, 7)]

# --- Conversion angle → orientation -----------------------------------------
# Exactement la table `orientationMap` de grpc_proxy.ts (NJ130 2.05) : la valeur
# de l'axe, telle que la renvoie le contrôleur, devient l'Euler absolu de la pièce.
ORIENTATION_MAP = {
    "part_1": lambda v: [90.0, 0.0, -v],
    "part_2": lambda v: [-90.0, -v + 270.0, 90.0],
    "part_3": lambda v: [0.0, 0.0, v - 180.0],
    "part_4": lambda v: [-v, 0.0, 90.0],
    "part_5": lambda v: [-180.0, 0.0, -v + 180.0],
    "part_6": lambda v: [-v + 180.0, 0.0, 180.0],
}

# Valeurs d'axe qui redonnent, à travers ORIENTATION_MAP, la pose de repos
# enregistrée dans la scène NJ130 (eulerOrientation de chaque part_N). Le mouvement
# simulé oscille autour : à 0, le bras est tel qu'on le voit dans l'éditeur.
SCENE_POSE = {
    "part_1": -1.0,
    "part_2": 0.0,
    "part_3": 270.0,
    "part_4": -180.0,
    "part_5": -13.8,
    "part_6": 180.0,
}

# Mouvement simulé, repris de server.py : (amplitude °, pulsation, phase)
SIMULATED_MOTION = [
    (45.0, 0.5, 0.0),
    (30.0, 0.4, 1.0),
    (40.0, 0.3, 2.0),
    (90.0, 0.6, 0.0),
    (30.0, 0.7, 0.5),
    (180.0, 0.2, 0.0),
]

EPSILON_DEG = 0.01  # en dessous, on n'envoie rien


# --- Source "robot" : flux TCP du contrôleur ---------------------------------
_latest = {"angles": [0.0] * 6, "ts": 0.0, "packets": 0}
_lock = threading.Lock()


def _handle_robot_conn(conn: socket.socket, addr) -> None:
    print(f"🤖 Robot connecté depuis {addr[0]}:{addr[1]}")
    buf = b""
    try:
        while True:
            data = conn.recv(4096)
            if not data:
                break
            buf += data
            while b"\n" in buf:
                line, buf = buf.split(b"\n", 1)
                text = line.decode(errors="replace").strip()
                if not text:
                    continue
                try:
                    vals = [float(v) for v in text.replace(",", ".").split(";")]
                except ValueError:
                    print(f"⚠️ Trame invalide : {text!r}")
                    continue
                if len(vals) < 6:
                    print(f"⚠️ Trame incomplète ({len(vals)} valeurs au lieu de 6)")
                    continue
                with _lock:
                    _latest["angles"] = vals[:6]
                    _latest["ts"] = time.time()
                    _latest["packets"] += 1
    except OSError as e:
        print(f"❌ Connexion robot {addr[0]} : {e}")
    finally:
        conn.close()
        print(f"🤖 Robot déconnecté ({addr[0]})")


def robot_tcp_listener(host: str, port: int) -> None:
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind((host, port))
    srv.listen(1)
    print(f"📡 En attente du robot sur {host}:{port}")
    while True:
        conn, addr = srv.accept()
        threading.Thread(target=_handle_robot_conn, args=(conn, addr), daemon=True).start()


# --- Calcul des angles --------------------------------------------------------
def joint_values(args, t: float) -> dict[str, float]:
    """Valeurs d'axe (convention contrôleur) de chaque articulation à l'instant t."""
    if args.source == "robot":
        with _lock:
            if not _latest["ts"]:
                # Rien reçu du robot : ne pas envoyer des zéros, qui tordraient le bras
                # (même règle que grpc_proxy.ts, qui ignore les valeurs nulles).
                return {}
            angles = list(_latest["angles"])
        if args.relative:
            angles = [SCENE_POSE[n] + a for n, a in zip(JOINT_NAMES, angles)]
        return dict(zip(JOINT_NAMES, angles))

    values = {}
    for name, (amp, omega, phase) in zip(JOINT_NAMES, SIMULATED_MOTION):
        moving = args.sweep is None or args.sweep == name
        offset = args.amplitude * amp * math.sin(omega * t * args.speed + phase) if moving else 0.0
        values[name] = SCENE_POSE[name] + offset
    return values


# --- Serveur WebSocket --------------------------------------------------------
CLIENTS: set = set()
_last_sent: dict[str, float] = {}
_last_messages: dict[str, str] = {}


def message_for(name: str, value: float) -> str:
    return json.dumps({"name": name, "location": ORIENTATION_MAP[name](value)})


async def handler(ws, *_args) -> None:
    CLIENTS.add(ws)
    print(f"✅ Navigateur connecté ({len(CLIENTS)} au total)")
    try:
        # Pose courante tout de suite, même si le robot est à l'arrêt.
        for text in list(_last_messages.values()):
            await ws.send(text)
        async for _message in ws:
            pass  # le navigateur envoie "select part_N" : ignoré ici
    except Exception:
        pass
    finally:
        CLIENTS.discard(ws)
        print(f"❌ Navigateur déconnecté ({len(CLIENTS)} restant)")


async def _send_all(text: str) -> None:
    for ws in list(CLIENTS):
        try:
            await ws.send(text)
        except Exception:
            CLIENTS.discard(ws)


async def stream(args) -> None:
    period = 1.0 / args.rate
    start = time.monotonic()
    next_tick = start
    last_log = start
    sent = 0
    while True:
        t = time.monotonic() - start
        for name, value in joint_values(args, t).items():
            if abs(_last_sent.get(name, math.inf) - value) < EPSILON_DEG:
                continue
            _last_sent[name] = value
            text = message_for(name, value)
            _last_messages[name] = text
            await _send_all(text)
            sent += 1

        now = time.monotonic()
        if now - last_log >= 2.0:
            extra = ""
            if args.source == "robot":
                with _lock:
                    age = time.time() - _latest["ts"] if _latest["ts"] else None
                    extra = f" | trames robot : {_latest['packets']}" + (
                        f" (dernière il y a {age:.1f}s)" if age is not None else " (aucune)"
                    )
            print(f"📤 {sent} messages envoyés | {len(CLIENTS)} navigateur(s){extra}")
            last_log = now

        # cadence stable, sans dérive cumulée
        next_tick += period
        await asyncio.sleep(max(0.0, next_tick - time.monotonic()))


async def main(args) -> None:
    if args.source == "robot":
        threading.Thread(
            target=robot_tcp_listener, args=(args.robot_host, args.robot_port), daemon=True
        ).start()
    async with serve(handler, args.host, args.port):
        mode = f"{args.source}" + (f", sweep {args.sweep}" if args.sweep else "")
        print(f"🚀 WebSocket sur ws://{args.host}:{args.port} ({mode}, {args.rate:.0f} Hz)")
        await stream(args)


def parse_args():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--source", choices=["simulated", "robot"], default="simulated")
    p.add_argument("--host", default="localhost", help="adresse du serveur WebSocket")
    p.add_argument("--port", type=int, default=8767, help="port du serveur WebSocket")
    p.add_argument("--rate", type=float, default=30.0, help="fréquence d'envoi (Hz)")
    p.add_argument("--amplitude", type=float, default=0.3, help="simulé : échelle d'amplitude")
    p.add_argument("--speed", type=float, default=0.4, help="simulé : échelle de vitesse")
    p.add_argument("--sweep", choices=JOINT_NAMES, help="simulé : n'animer que cette articulation")
    p.add_argument("--robot-host", default="0.0.0.0", help="robot : adresse d'écoute TCP")
    p.add_argument("--robot-port", type=int, default=50051, help="robot : port d'écoute TCP")
    p.add_argument(
        "--relative",
        action="store_true",
        help="robot : angles relatifs à la pose de la scène (0 = pose de l'éditeur)",
    )
    return p.parse_args()


if __name__ == "__main__":
    try:
        asyncio.run(main(parse_args()))
    except KeyboardInterrupt:
        print("\nArrêt.")
