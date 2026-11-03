"""Serveur gRPC (streaming) pour un robot 6 axes — écoute sur 192.168.10.75:50051

Installation :
    pip install grpcio grpcio-tools
Génération des stubs :
    python -m grpc_tools.protoc -I. --python_out=. --grpc_python_out=. robot.proto
Lancement :
    python server.py
"""
import math
import socket
import threading
import time
from concurrent import futures

import grpc

import robot_pb2
import robot_pb2_grpc

HOST = "0.0.0.0"  # écoute aussi sur 192.168.10.75 si cette IP existe sur la machine
PORT = 50051
DEFAULT_RATE_HZ = 30.0
JOINT_NAMES = [f"part_{i}" for i in range(1, 7)]

# --- Source des données ---------------------------------------------------
# "robot"    : le contrôleur du robot (programme PDL2) se connecte en TCP à ce
#              PC et envoie une ligne par échantillon : "j1;j2;j3;j4;j5;j6\n"
#              (angles en degrés).
# "simulated": mouvement sinusoïdal pour tester la chaîne sans robot.
SOURCE = "simulated"
# Réglages du mouvement simulé : 1.0 = valeurs d'origine
AMPLITUDE_SCALE = 0.3   # amplitude des mouvements (0.3 = 30 % de l'original)
SPEED_SCALE = 0.4       # vitesse des mouvements (0.4 = 40 % de l'original)

ROBOT_TCP_HOST = "0.0.0.0"
ROBOT_TCP_PORT = 5000

_latest = {"angles": [0.0] * 6, "ts": 0.0}
_lock = threading.Lock()


def _handle_robot_conn(conn, addr):
    print(f"🤖 Robot connecté : {addr}")
    buf = b""
    try:
        while True:
            data = conn.recv(4096)
            if not data:
                break
            buf += data
            while b"\n" in buf:
                line, buf = buf.split(b"\n", 1)
                try:
                    vals = [float(v) for v in line.decode().strip().replace(",", ".").split(";")]
                except ValueError:
                    continue
                if len(vals) >= 6:
                    with _lock:
                        _latest["angles"] = vals[:6]
                        _latest["ts"] = time.time()
    finally:
        conn.close()
        print("🤖 Robot déconnecté")


def robot_tcp_listener():
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind((ROBOT_TCP_HOST, ROBOT_TCP_PORT))
    srv.listen(1)
    print(f"📡 En attente du robot sur {ROBOT_TCP_HOST}:{ROBOT_TCP_PORT}")
    while True:
        conn, addr = srv.accept()
        threading.Thread(target=_handle_robot_conn, args=(conn, addr), daemon=True).start()


def read_robot_joints(t: float) -> list[float]:
    """Retourne les 6 angles (degrés)."""
    if SOURCE == "robot":
        with _lock:
            return list(_latest["angles"])
    # (amplitude °, pulsation rad/s, phase rad) par axe, puis réduction globale
    amplitude_scale = AMPLITUDE_SCALE
    t = t * SPEED_SCALE
    return [
        amplitude_scale * 45 * math.sin(0.5 * t),
        amplitude_scale * 30 * math.sin(0.4 * t + 1.0),
        amplitude_scale * 40 * math.sin(0.3 * t + 2.0),
        amplitude_scale * 90 * math.sin(0.6 * t),
        amplitude_scale * 30 * math.sin(0.7 * t + 0.5),
        amplitude_scale * 180 * math.sin(0.2 * t),
    ]


class RobotStreamService(robot_pb2_grpc.RobotStreamServicer):
    def StreamJoints(self, request, context):
        rate = request.rate_hz if request.rate_hz > 0 else DEFAULT_RATE_HZ
        period = 1.0 / rate
        print(f"✅ Client connecté : {context.peer()} ({rate:.0f} Hz)")
        start = time.monotonic()
        next_tick = start

        try:
            while context.is_active():
                t = time.monotonic() - start
                angles = read_robot_joints(t)
                yield robot_pb2.RobotState(
                    timestamp_ms=int(time.time() * 1000),
                    joints=[
                        robot_pb2.Joint(name=n, angle_deg=a)
                        for n, a in zip(JOINT_NAMES, angles)
                    ],
                )
                # cadence stable (sans dérive cumulée)
                next_tick += period
                time.sleep(max(0.0, next_tick - time.monotonic()))
        finally:
            print(f"❌ Client déconnecté : {context.peer()}")


def serve():
    if SOURCE == "robot":
        threading.Thread(target=robot_tcp_listener, daemon=True).start()
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=8))
    robot_pb2_grpc.add_RobotStreamServicer_to_server(RobotStreamService(), server)
    server.add_insecure_port(f"{HOST}:{PORT}")
    server.start()
    print(f"🚀 Serveur gRPC en écoute sur {HOST}:{PORT}")
    server.wait_for_termination()


if __name__ == "__main__":
    serve()